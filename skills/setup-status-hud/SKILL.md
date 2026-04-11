---
name: setup-status-hud
description: Configure the Claude Code status HUD. Automatically updates your settings.json to enable the rich status line display.
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

1. **Find the plugin's statusline.js path:**
   - Read `~/.claude/plugins/installed_plugins.json`
   - Look for the `claude-status-hud` entry
   - Extract the `installPath` value
   - The script is at `<installPath>/scripts/statusline.js`
   - Verify the file exists

2. **Read the user's current `~/.claude/settings.json`**

3. **Add or update ONLY the `statusLine` field:**
   ```json
   {
     "statusLine": {
       "type": "command",
       "command": "node \"<installPath>/scripts/statusline.js\""
     }
   }
   ```

4. **IMPORTANT: Do NOT modify any other settings.** Specifically:
   - Do NOT touch `env` settings
   - Do NOT touch `includeCoAuthoredBy`
   - Do NOT touch any other existing fields
   - Only add/update the `statusLine` field

5. **Show the user the change and confirm.**

6. **Tell the user to restart Claude Code** or start a new session for the statusline to take effect.

## Troubleshooting

If the plugin is not found in `installed_plugins.json`:
- The user may have installed from a local directory
- Ask them for the path to the plugin, or search for `statusline.js` under `~/.claude/plugins/`
- As a fallback, the user can manually set the command to: `node /path/to/claude-status-hud/scripts/statusline.js`
