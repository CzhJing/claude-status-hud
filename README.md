# claude-status-hud

[English](README.md) | [中文](README.zh-CN.md)

Rich 3-line status HUD for Claude Code. Cross-platform, zero dependencies.

![Status HUD Preview](https://github.com/BeiShan/claude-status-hud/raw/main/assets/preview.png)

## What it shows

```
Model:Opus 4  version:v2.1.101  context:[████░░░░░░░░░░░] 28%  token[⬆ 468/⬇ 6.1k] | cache[R:53.0k W:2.2k]
⎇ feat/my-branch*  project:my-project
cost: $1.84  🕐: 6m11s(2m57s api)  update:+126|delete:-16
```

**Line 1:** Model name, version, context window usage bar (color-coded), input/output tokens, cache read/write stats

**Line 2:** Git branch, dirty indicator (`*`), ahead/behind upstream (`↑2 ↓1`), project name

**Line 3:** Session cost (USD), wall clock duration, API duration, lines added/removed

## Install

```bash
claude plugin add github:BeiShan/claude-status-hud
```

## Setup

After installing, run the `/setup-status-hud` command inside Claude Code to auto-configure.

Or manually add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"~/.claude/plugins/cache/claude-status-hud/claude-status-hud/1.0.0/scripts/statusline.js\""
  }
}
```

> Replace the path with your actual plugin install path. Run `/setup-status-hud` to auto-detect it.

## Requirements

- **Claude Code** v2.1+ (with statusLine support)
- **Node.js** (already required by Claude Code)
- **Git** (optional, for branch/status display)

## No external dependencies

This plugin uses only Node.js built-in modules. No `jq`, no `npm install`, no additional tools.

Works on **macOS**, **Linux**, and **Windows**.

## Migrating from a jq-based statusline script

If you were using a bash statusline script that depends on `jq`, this plugin replaces it entirely. The output is visually identical but no longer requires `brew install jq` or any external tool.

## License

[MIT](LICENSE)
