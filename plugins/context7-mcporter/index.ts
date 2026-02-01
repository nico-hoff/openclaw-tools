import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type PluginConfig = {
  mcporterConfigPath: string;
  serverName?: string;
  maxChars?: number;
};

async function mcporterCall(args: string[]): Promise<any> {
  const { stdout } = await execFileAsync("mcporter", args, {
    timeout: 60_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

function clip(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + `\n\n[clipped to ${maxChars} chars]`;
}

export default function (api: any) {
  const cfg: PluginConfig = api.getConfig?.() ?? {};
  const mcporterConfigPath = cfg.mcporterConfigPath ?? "/home/pi/.openclaw/workspace/config/mcporter.json";
  const serverName = cfg.serverName ?? "context7";
  const maxChars = cfg.maxChars ?? 40_000;

  api.registerTool(
    {
      name: "context7",
      description:
        "Look up official library documentation via Context7 (MCP). Uses mcporter under the hood. " +
        "Callers should provide a library name or direct Context7 libraryId, and a query.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          library: {
            type: "string",
            description:
              "Library/package name (e.g. 'FastAPI') OR a Context7 libraryId like '/tiangolo/fastapi'.",
          },
          query: {
            type: "string",
            description: "What you want to know / what to search for in the docs.",
          },
          versionHint: {
            type: "string",
            description:
              "Optional version hint (not always used). If libraryId includes version, this can be omitted.",
          }
        },
        required: ["query"]
      },
      async execute(_id: string, params: any) {
        if (!mcporterConfigPath) {
          return {
            content: [
              {
                type: "text",
                text:
                  "Context7 tool is not configured: missing mcporterConfigPath in plugin config.",
              },
            ],
          };
        }

        const lib = (params.library ?? "").trim();
        const query = String(params.query ?? "").trim();

        if (!query) {
          return { content: [{ type: "text", text: "Missing required field: query" }] };
        }

        // If user passed a Context7 libraryId (/org/project or /org/project/version), skip resolving.
        const looksLikeLibraryId = lib.startsWith("/");

        let libraryId: string | undefined = looksLikeLibraryId ? lib : undefined;
        let resolvedSummary = "";

        if (!libraryId) {
          const q = lib || query;
          const resolved = await mcporterCall([
            "call",
            `${serverName}.resolve-library-id",
            "--config",
            mcporterConfigPath,
            "--args",
            JSON.stringify({ query: q }),
            "--output",
            "json",
          ]);

          // Best-effort extraction (Context7 returns structured text; mcporter returns tool response envelope)
          const text =
            resolved?.content?.find?.((c: any) => c?.type === "text")?.text ??
            JSON.stringify(resolved, null, 2);

          resolvedSummary = text;

          // Try to find a libraryId inside the text.
          const match = String(text).match(/\/(?:[^\s"']+\/)??[^\s"']+/);
          if (match) {
            libraryId = match[0];
          }

          if (!libraryId) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    "Context7: could not confidently resolve a libraryId. Here is the resolver output:\n\n" +
                    clip(String(text), maxChars),
                },
              ],
            };
          }
        }

        const docs = await mcporterCall([
          "call",
          `${serverName}.query-docs",
          "--config",
          mcporterConfigPath,
          "--args",
          JSON.stringify({ libraryId, query }),
          "--output",
          "json",
        ]);

        const docsText =
          docs?.content?.find?.((c: any) => c?.type === "text")?.text ??
          JSON.stringify(docs, null, 2);

        const header = looksLikeLibraryId
          ? `Context7 docs for ${libraryId}\n\n`
          : `Context7 resolved libraryId: ${libraryId}\n\n`;

        const resolverBlock = resolvedSummary
          ? `---\nResolver output (truncated)\n---\n${clip(String(resolvedSummary), 4000)}\n\n`
          : "";

        return {
          content: [
            {
              type: "text",
              text: header + resolverBlock + clip(String(docsText), maxChars),
            },
          ],
        };
      },
    },
    { optional: false },
  );
}
