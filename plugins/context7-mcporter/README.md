# Context7 via mcporter (OpenClaw plugin)

This plugin exposes a `context7` agent tool in OpenClaw by shelling out to `mcporter`.

## Requirements
- `mcporter` installed and configured with a Context7 server entry.

Example (project-local mcporter config):
- `/home/pi/.openclaw/workspace/config/mcporter.json`

## OpenClaw config
Add the plugin to `plugins.entries` and set:
- `mcporterConfigPath`

Example:
```jsonc
{
  "plugins": {
    "entries": {
      "context7-mcporter": {
        "enabled": true,
        "config": {
          "mcporterConfigPath": "/home/pi/.openclaw/workspace/config/mcporter.json",
          "serverName": "context7",
          "maxChars": 40000
        }
      }
    }
  }
}
```

## Tool usage
Call the tool with either a library name OR a Context7 libraryId:

- `context7({ library: "FastAPI", query: "BackgroundTasks" })`
- `context7({ library: "/tiangolo/fastapi", query: "dependency overrides" })`

