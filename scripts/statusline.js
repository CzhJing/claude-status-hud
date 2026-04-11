#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ── ANSI Colors ──────────────────────────────────────────────
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';
const BLUE = '\x1b[34m';
const WHITE = '\x1b[97m';

// ── Helpers ──────────────────────────────────────────────────

function get(obj, path, defaultVal) {
  const keys = path.split('.');
  let cur = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return defaultVal;
    cur = cur[k];
  }
  return cur == null ? defaultVal : cur;
}

function formatTokens(n) {
  n = Number(n) || 0;
  if (n >= 1000000) return (Math.floor(n / 100000) / 10).toFixed(1) + 'M';
  if (n >= 1000) return (Math.floor(n / 100) / 10).toFixed(1) + 'k';
  return String(n);
}

function formatDuration(ms) {
  ms = Number(ms) || 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m${String(s).padStart(2, '0')}s`;
  if (m > 0) return `${m}m${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

function formatCost(c) {
  c = Number(c) || 0;
  if (c >= 1.0) return `$${c.toFixed(2)}`;
  const cents = (c * 100).toFixed(1);
  return `${cents}\u00a2`;
}

function execGit(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function findFiles(dir, filename) {
  let count = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) count += findFiles(full, filename);
      else if (e.name === filename) count++;
    }
  } catch {}
  return count;
}

function findMdFiles(dir) {
  let count = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) count += findMdFiles(full);
      else if (e.name.endsWith('.md')) count++;
    }
  } catch {}
  return count;
}

// ── Main ─────────────────────────────────────────────────────

function main() {
  let input;
  try {
    input = fs.readFileSync(0, 'utf8');
  } catch {
    process.stdout.write('Status HUD: stdin read error\n');
    return;
  }

  let data;
  try {
    data = JSON.parse(input);
  } catch {
    process.stdout.write('Status HUD: JSON parse error\n');
    return;
  }

  // ── Parse fields ───────────────────────────────────────────
  const model = get(data, 'model.display_name', 'Claude');
  const version = get(data, 'version', '');
  const used = get(data, 'context_window.used_percentage', null);

  const totalIn = get(data, 'context_window.total_input_tokens', 0);
  const totalOut = get(data, 'context_window.total_output_tokens', 0);
  const cacheRead = get(data, 'context_window.current_usage.cache_read_input_tokens', 0);
  const cacheCreate = get(data, 'context_window.current_usage.cache_creation_input_tokens', 0);

  const costUsd = get(data, 'cost.total_cost_usd', 0);
  const durationMs = get(data, 'cost.total_duration_ms', 0);
  const apiDurationMs = get(data, 'cost.total_api_duration_ms', 0);
  const linesAdded = get(data, 'cost.total_lines_added', 0);
  const linesRemoved = get(data, 'cost.total_lines_removed', 0);

  const projectDir = get(data, 'workspace.project_dir', '');
  const cwd = get(data, 'cwd', process.cwd());

  // Rate limits (usage)
  const usage5h = get(data, 'rate_limits.five_hour.used_percentage', null);
  const usage7d = get(data, 'rate_limits.seven_day.used_percentage', null);
  const resets5h = get(data, 'rate_limits.five_hour.resets_at', null);
  const resets7d = get(data, 'rate_limits.seven_day.resets_at', null);

  // ── Format tokens & cache ──────────────────────────────────
  const inFmt = formatTokens(totalIn);
  const outFmt = formatTokens(totalOut);
  const cacheRFmt = formatTokens(cacheRead);
  const cacheCFmt = formatTokens(cacheCreate);

  // ── Line 1: Model + Version + Context Bar + Usage ──────────
  const BAR_WIDTH = 10;
  let barStr;

  if (used !== null) {
    const usedInt = Math.round(Number(used));
    const filled = Math.round(usedInt * BAR_WIDTH / 100);
    const empty = BAR_WIDTH - filled;

    let barColor;
    if (usedInt < 50) barColor = GREEN;
    else if (usedInt < 80) barColor = YELLOW;
    else barColor = RED;

    barStr = barColor + '\u2588'.repeat(filled) + DIM + '\u2591'.repeat(empty) + RESET;

    barStr = `${DIM}ctx:${RESET}[${barStr}]${DIM}${usedInt}%${RESET}`;
  } else {
    barStr = `${DIM}ctx:${RESET}[${DIM}${'\u2591'.repeat(BAR_WIDTH)}${RESET}]`;
  }

  let line1 = `${DIM}Model:${RESET}${CYAN}${BOLD}${model}${RESET} ${barStr}`;

  // Append usage (rate limits) if available
  function formatRemaining(sec) {
    if (sec <= 0) return 'now';
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return `${d}d${h}h`;
    if (h > 0) return `${h}h${m}m`;
    return `${m}m`;
  }

  function makeUsageBar(pct, label, resetsAt) {
    const w = 6;
    const f = Math.round(pct * w / 100);
    const e = w - f;
    const c = pct < 50 ? GREEN : pct < 80 ? YELLOW : RED;
    const bar = c + '\u2588'.repeat(f) + DIM + '\u2591'.repeat(e) + RESET;
    if (resetsAt !== null) {
      const remain = Math.floor(Number(resetsAt) - Date.now() / 1000);
      return `[${bar}]${DIM}${pct}%${RESET} ${DIM}(${formatRemaining(remain)} / ${label})${RESET}`;
    }
    return `[${bar}]${DIM}${pct}%${RESET} ${DIM}(${label})${RESET}`;
  }

  if (usage5h !== null || usage7d !== null) {
    const parts = [];
    if (usage5h !== null) parts.push(makeUsageBar(Math.round(Number(usage5h)), '5h', resets5h));
    if (usage7d !== null) parts.push(makeUsageBar(Math.round(Number(usage7d)), '7d', resets7d));
    line1 += ` ${DIM}|${RESET} ${DIM}usage:${RESET}${parts.join(`${DIM}|${RESET}`)}`;
  } else {
    line1 += ` ${DIM}|${RESET} ${DIM}usage: For subscribers only${RESET}`;
  }

  // ── Line 2: Project + Git + MCPs/Skills/CLIs/Hooks ─────────
  let line2 = '';

  if (projectDir) {
    const projName = projectDir.split(/[/\\]/).filter(Boolean).pop() || '';
    if (projName) {
      line2 = `${DIM}project:${RESET}${BLUE}${BOLD}${projName}${RESET}`;
    }
  }

  const branch = execGit('git rev-parse --abbrev-ref HEAD', cwd);
  if (branch) {
    let dirty = '';
    try {
      execSync('git diff --quiet', { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      dirty = `${YELLOW}*${RESET}`;
    }
    if (!dirty) {
      try {
        execSync('git diff --cached --quiet', { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      } catch {
        dirty = `${YELLOW}*${RESET}`;
      }
    }

    let ab = '';
    const upstream = execGit('git rev-parse --abbrev-ref @{upstream}', cwd);
    if (upstream) {
      const ahead = parseInt(execGit(`git rev-list --count ${upstream}..HEAD`, cwd), 10) || 0;
      const behind = parseInt(execGit(`git rev-list --count HEAD..${upstream}`, cwd), 10) || 0;
      if (ahead > 0) ab += `${GREEN}\u2191${ahead}${RESET}`;
      if (behind > 0) ab += `${RED}\u2193${behind}${RESET}`;
    }

    if (line2) line2 += ` ${DIM}|${RESET} `;
    line2 += `${MAGENTA}${BOLD}\u2387 ${branch}${RESET}${dirty}${ab ? ' ' + ab : ''}`;
  }

  // ── Count MCPs / Skills / CLIs / Hooks ─────────────────────
  const claudeHome = path.join(os.homedir(), '.claude');

  // MCPs: from mcp-health-cache.json (reflects all active MCP servers)
  let mcpCount = 0;
  try {
    const mcpCache = JSON.parse(fs.readFileSync(path.join(claudeHome, 'mcp-health-cache.json'), 'utf8'));
    mcpCount = Object.keys(mcpCache.servers || {}).length;
  } catch {}

  // Skills / CLIs / Hooks: from installed plugins
  let skillCount = 0;
  let cliCount = 0;
  let hookCount = 0;

  const installedPath = path.join(claudeHome, 'plugins', 'installed_plugins.json');
  try {
    const installed = JSON.parse(fs.readFileSync(installedPath, 'utf8'));
    for (const entries of Object.values(installed.plugins || {})) {
      const p = entries[0] && entries[0].installPath;
      if (!p) continue;
      // Count skills
      try {
        skillCount += findFiles(path.join(p, 'skills'), 'SKILL.md');
      } catch {}
      // Count commands
      try {
        cliCount += findMdFiles(path.join(p, 'commands'));
      } catch {}
      // Count hooks
      try {
        const hooksFile = path.join(p, 'hooks', 'hooks.json');
        const hooksData = JSON.parse(fs.readFileSync(hooksFile, 'utf8'));
        for (const arr of Object.values(hooksData.hooks || {})) {
          hookCount += Array.isArray(arr) ? arr.length : 0;
        }
      } catch {}
    }
  } catch {}

  // Hooks from global settings
  try {
    const settings = JSON.parse(fs.readFileSync(path.join(claudeHome, 'settings.json'), 'utf8'));
    for (const arr of Object.values(settings.hooks || {})) {
      hookCount += Array.isArray(arr) ? arr.length : 0;
    }
  } catch {}

  // Hooks from project settings
  if (projectDir) {
    try {
      const projSettingsDir = projectDir.replace(/^\//, '').replace(/\//g, '-');
      const projSettings = JSON.parse(fs.readFileSync(path.join(claudeHome, 'projects', projSettingsDir, 'settings.json'), 'utf8'));
      for (const arr of Object.values(projSettings.hooks || {})) {
        hookCount += Array.isArray(arr) ? arr.length : 0;
      }
    } catch {}
  }

  const costFmt = formatCost(costUsd);
  const durFmt = formatDuration(durationMs);
  const apiFmt = formatDuration(apiDurationMs);

  line2 += ` ${DIM}|${RESET} ${DIM}update:${RESET}${GREEN}+${linesAdded}${RESET} ${DIM}|${RESET} ${DIM}delete:${RESET}${RED}-${linesRemoved}${RESET}`;

  // ── Line 3: Cost + Duration + Tokens + MCPs/Skills/CLIs/Hooks ─
  const line3 = `${DIM}cost:${RESET} ${WHITE}${BOLD}${costFmt}${RESET}  \uD83D\uDD50${DIM}:${RESET} ${durFmt}${DIM}(${apiFmt} api)${RESET}  ${DIM}token[${RESET}${GREEN}\u2B06 ${inFmt}${RESET}${DIM}/${RESET}${YELLOW}\u2B07 ${outFmt}${RESET}${DIM}]${RESET} ${DIM}|${RESET} ${CYAN}${mcpCount} Mcps${RESET} ${DIM}|${RESET} ${GREEN}${skillCount} Skills${RESET} ${DIM}|${RESET} ${YELLOW}${cliCount} Clis${RESET} ${DIM}|${RESET} ${MAGENTA}${hookCount} Hooks${RESET}`;

  // ── Output ─────────────────────────────────────────────────
  process.stdout.write(`${line1}\n${line2}\n${line3}\n`);
}

try {
  main();
} catch (err) {
  process.stdout.write(`Status HUD error: ${err.message}\n`);
}
