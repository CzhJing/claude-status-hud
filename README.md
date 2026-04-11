# claude-status-hud

[English](README.md) | [中文](README.zh-CN.md)

Rich 3-line status HUD for Claude Code. Cross-platform, zero dependencies.

![Status HUD Preview](preview-1.png)

## What it shows

```
Model:Opus 4 ctx:[████░░░░░░]28% | usage:[████░░]75% (2h29m / 5h)|[█░░░░░]12% (3d11h / 7d)
project:my-project | ⎇ feat/my-branch* | update:+126 | delete:-16
cost: $1.84  🕐: 6m11s(2m57s api)  token[⬆ 468/⬇ 6.1k] | 3 Mcps | 174 Skills | 75 Clis | 32 Hooks
```

**Line 1:** Model name, context window usage bar (color-coded), rate limit usage bars with reset countdown (5h / 7d). Shows "For subscribers only" when usage data is unavailable

**Line 2:** Project name, git branch, dirty indicator (`*`), ahead/behind upstream (`↑2 ↓1`), lines added/removed

**Line 3:** Session cost (USD), wall clock duration, API duration, input/output tokens, active MCP servers, installed skills, CLI commands, hooks

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
