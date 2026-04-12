---
name: setup-status-hud
description: Configure the Claude Code / Codebuddy Code status HUD. Automatically updates your settings.json to enable the rich status line display.
argument-hint: ""
allowed-tools:
  - Read
  - Edit
  - Bash
  - Glob
---

# Setup Status HUD

The user wants to configure the claude-status-hud status line.

## Instructions

1. **Detect which tool is running:**
   - Check if `~/.codebuddy/settings.json` exists — if so, the user is likely on Codebuddy Code
   - Check if `~/.claude/settings.json` exists — if so, the user is likely on Claude Code
   - If both exist, ask the user which one they want to configure (or configure both)
   - Set `settingsHome` to `~/.codebuddy` or `~/.claude` accordingly

2. **Find the plugin's statusline script path:**
   - Read `<settingsHome>/plugins/installed_plugins.json`
   - Look for the `claude-status-hud` entry
   - Extract the `installPath` value
   - For Claude Code: `<installPath>/scripts/statusline.js`
   - For Codebuddy Code: `<installPath>/scripts/statusline-codebuddy.js`
   - Verify the file exists
   - If not found in the primary home, also check the other home directory (`~/.claude` or `~/.codebuddy`)

3. **Read the user's current `<settingsHome>/settings.json`**

4. **Add or update ONLY the `statusLine` field:**
   - For Claude Code:
     ```json
     {
       "statusLine": {
         "type": "command",
         "command": "node \"<installPath>/scripts/statusline.js\""
       }
     }
     ```
   - For Codebuddy Code:
     ```json
     {
       "statusLine": {
         "type": "command",
         "command": "node \"<installPath>/scripts/statusline-codebuddy.js\""
       }
     }
     ```

5. **IMPORTANT: Do NOT modify any other settings.** Specifically:
   - Do NOT touch `env` settings
   - Do NOT touch `includeCoAuthoredBy`
   - Do NOT touch any other existing fields
   - Only add/update the `statusLine` field

6. **Show the user the change and confirm.**

7. **Tell the user to restart the tool** or start a new session for the statusline to take effect.

## Troubleshooting

If the plugin is not found in `installed_plugins.json`:
- The user may have installed from a local directory
- Ask them for the path to the plugin, or search for `statusline.js` / `statusline-codebuddy.js` under `~/.claude/plugins/` or `~/.codebuddy/plugins/`
- As a fallback, the user can manually set the command to:
  - Claude Code: `node /path/to/claude-status-hud/scripts/statusline.js`
  - Codebuddy Code: `node /path/to/claude-status-hud/scripts/statusline-codebuddy.js`
