# claude-status-hud

[English](README.md) | [中文](README.zh-CN.md)

Rich 3-line status HUD for Claude Code. Cross-platform, zero dependencies.

![Status HUD Preview](preview-line.png)

## What it shows

```
Model:Opus 4  version:v2.1.101  context:[████░░░░░░░░░░░] 28%  token[⬆ 468/⬇ 6.1k] | cache[R:53.0k W:2.2k]
project:my-project | ⎇ feat/my-branch* | 3 Mcps | 174 Skills | 75 Clis | 32 Hooks
cost: $1.84  🕐: 6m11s(2m57s api)  update:+126|delete:-16
```

**Line 1:** Model name, version, context window usage bar (color-coded), input/output tokens, cache read/write stats

**Line 2:** Project name, git branch, dirty indicator (`*`), ahead/behind upstream (`↑2 ↓1`), active MCP servers, installed skills, CLI commands, hooks

**Line 3:** Session cost (USD), wall clock duration, API duration, lines added/removed

## Install

In a Claude Code session, run the following commands in order:

```
/plugin marketplace add CzhJing/claude-status-hud
/plugin install claude-status-hud
/reload-plugins
```

## Setup

After installing, run the `/setup-status-hud` command inside Claude Code to auto-configure.

## Requirements

- **Claude Code** v2.1+ (with statusLine support)
- **Node.js** (already required by Claude Code)
- **Git** (optional, for branch/status display)

## No external dependencies

This plugin uses only Node.js built-in modules. no additional tools.

Works on **macOS**, **Linux**, and **Windows**.

## License

[MIT](LICENSE)
