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

function formatRemaining(sec) {
  if (sec <= 0) return 'now';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d${h}h`;
  if (h > 0) return `${h}h${m}m`;
  return `${m}m`;
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

// ── Rendering Functions ──────────────────────────────────────

function renderLine1(model, used, usage5h, usage7d, resets5h, resets7d, fallbackLabel = 'For subscribers only') {
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
    line1 += ` ${DIM}|${RESET} ${DIM}usage:${RESET} ${DIM}${fallbackLabel}${RESET}`;
  }

  return line1;
}

function renderLine2(projectDir, cwd, linesAdded, linesRemoved) {
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

  line2 += ` ${DIM}|${RESET} ${DIM}update:${RESET}${GREEN}+${linesAdded}${RESET} ${DIM}|${RESET} ${DIM}delete:${RESET}${RED}-${linesRemoved}${RESET}`;

  return line2;
}

function renderLine3(costUsd, durationMs, apiDurationMs, totalIn, totalOut, mcpCount, skillCount, cliCount, hookCount) {
  const costFmt = formatCost(costUsd);
  const durFmt = formatDuration(durationMs);
  const apiFmt = formatDuration(apiDurationMs);
  const inFmt = formatTokens(totalIn);
  const outFmt = formatTokens(totalOut);

  const pluginsPart = ` ${DIM}|${RESET} ${CYAN}${mcpCount} Mcps${RESET} ${DIM}|${RESET} ${GREEN}${skillCount} Skills${RESET} ${DIM}|${RESET} ${YELLOW}${cliCount} Clis${RESET} ${DIM}|${RESET} ${MAGENTA}${hookCount} Hooks${RESET}`;

  return `${DIM}cost:${RESET} ${WHITE}${BOLD}${costFmt}${RESET}  \uD83D\uDD50${DIM}:${RESET} ${durFmt}${DIM}(${apiFmt} api)${RESET}  ${DIM}token[${RESET}${GREEN}\u2B06 ${inFmt}${RESET}${DIM}/${RESET}${YELLOW}\u2B07 ${outFmt}${RESET}${DIM}]${RESET}${pluginsPart}`;
}

function renderLine3NoPlugins(costUsd, durationMs, apiDurationMs, totalIn, totalOut) {
  const costFmt = formatCost(costUsd);
  const durFmt = formatDuration(durationMs);
  const apiFmt = formatDuration(apiDurationMs);
  const inFmt = formatTokens(totalIn);
  const outFmt = formatTokens(totalOut);

  return `${DIM}cost:${RESET} ${WHITE}${BOLD}${costFmt}${RESET}  \uD83D\uDD50${DIM}:${RESET} ${durFmt}${DIM}(${apiFmt} api)${RESET}  ${DIM}token[${RESET}${GREEN}\u2B06 ${inFmt}${RESET}${DIM}/${RESET}${YELLOW}\u2B07 ${outFmt}${RESET}${DIM}]${RESET}`;
}

function countPlugins(homeDirs, projectDir) {
  let mcpCount = 0;
  let skillCount = 0;
  let cliCount = 0;
  let hookCount = 0;
  let hasPluginData = false;

  for (const home of homeDirs) {
    try {
      const mcpCache = JSON.parse(fs.readFileSync(path.join(home, 'mcp-health-cache.json'), 'utf8'));
      mcpCount = Math.max(mcpCount, Object.keys(mcpCache.servers || {}).length);
      hasPluginData = true;
    } catch {}
    const installedPath = path.join(home, 'plugins', 'installed_plugins.json');
    try {
      const installed = JSON.parse(fs.readFileSync(installedPath, 'utf8'));
      for (const entries of Object.values(installed.plugins || {})) {
        const p = entries[0] && entries[0].installPath;
        if (!p) continue;
        try { skillCount += findFiles(path.join(p, 'skills'), 'SKILL.md'); } catch {}
        try { cliCount += findMdFiles(path.join(p, 'commands')); } catch {}
        try {
          const hooksFile = path.join(p, 'hooks', 'hooks.json');
          const hooksData = JSON.parse(fs.readFileSync(hooksFile, 'utf8'));
          for (const arr of Object.values(hooksData.hooks || {})) {
            hookCount += Array.isArray(arr) ? arr.length : 0;
          }
        } catch {}
      }
      hasPluginData = true;
    } catch {}
    try {
      const settings = JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8'));
      for (const arr of Object.values(settings.hooks || {})) {
        hookCount += Array.isArray(arr) ? arr.length : 0;
      }
    } catch {}
    if (projectDir) {
      try {
        const projSettingsDir = projectDir.replace(/^\//, '').replace(/\//g, '-');
        const projSettings = JSON.parse(fs.readFileSync(path.join(home, 'projects', projSettingsDir, 'settings.json'), 'utf8'));
        for (const arr of Object.values(projSettings.hooks || {})) {
          hookCount += Array.isArray(arr) ? arr.length : 0;
        }
      } catch {}
    }
  }

  return { mcpCount, skillCount, cliCount, hookCount, hasPluginData };
}

function renderExtraLines(envHome, sessionId) {
  const extraLines = [];

  // --- Active Tools & Agent Status (from traces) ---
  try {
    let traceDir = null;
    const sessionsDir = path.join(envHome, 'sessions');
    try {
      const sessionFiles = fs.readdirSync(sessionsDir);
      for (const sf of sessionFiles) {
        if (!sf.endsWith('.json')) continue;
        try {
          const sd = JSON.parse(fs.readFileSync(path.join(sessionsDir, sf), 'utf8'));
          if (sd.sessionId === sessionId) {
            traceDir = path.join(envHome, 'traces', String(sd.pid));
            break;
          }
        } catch {}
      }
    } catch {}

    if (traceDir && fs.existsSync(traceDir)) {
      const traceFiles = fs.readdirSync(traceDir).filter(f => f.endsWith('.json'));
      const toolCounts = {};
      const activeTools = [];
      const agentNames = [];
      let hasActiveTrace = false;

      for (const tf of traceFiles) {
        try {
          const td = JSON.parse(fs.readFileSync(path.join(traceDir, tf), 'utf8'));
          const trace = td.trace || {};
          const spans = td.spans || [];

          const isRunning = !trace.endedAt;
          if (isRunning) hasActiveTrace = true;

          if (!isRunning) {
            const endedMs = new Date(trace.endedAt).getTime();
            if (Date.now() - endedMs > 60000) continue;
          }

          for (const span of spans) {
            if (span.type === 'function') {
              const name = span.toolName || span.name;
              toolCounts[name] = (toolCounts[name] || 0) + 1;
              if (!span.endedAt && !activeTools.includes(name)) {
                activeTools.push(name);
              }
            }
            if (span.type === 'agent' && span.agentName) {
              if (!agentNames.includes(span.agentName)) {
                agentNames.push(span.agentName);
              }
            }
          }
        } catch {}
      }

      if (Object.keys(toolCounts).length > 0) {
        const sortedTools = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]);
        const toolStr = sortedTools.map(([name, count]) =>
          count > 1 ? `${CYAN}${name}${RESET}${DIM}\u00d7${count}${RESET}` : `${CYAN}${name}${RESET}`
        ).join(`${DIM},${RESET} `);
        extraLines.push(`${DIM}tools:${RESET}${toolStr}`);
      }

      if (agentNames.length > 0) {
        const agentStr = agentNames.map(a => {
          if (a === 'cli') return `${GREEN}cli${RESET}`;
          if (a === 'cli-silent') return `${DIM}cli-silent${RESET}`;
          return `${MAGENTA}${a}${RESET}`;
        }).join(`${DIM},${RESET} `);
        const statusLabel = hasActiveTrace ? `${YELLOW}\u25cf running${RESET}` : `${GREEN}\u25cf idle${RESET}`;
        extraLines.push(`${DIM}agent:${RESET}${agentStr} ${statusLabel}`);
      }
    }
  } catch {}

  // --- Todo Progress (from tasks) ---
  try {
    const tasksDir = path.join(envHome, 'tasks', sessionId);
    if (fs.existsSync(tasksDir)) {
      const taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));
      let total = 0, completed = 0, inProgress = 0;
      const pendingSubjects = [];
      for (const tf of taskFiles) {
        try {
          const td = JSON.parse(fs.readFileSync(path.join(tasksDir, tf), 'utf8'));
          total++;
          if (td.status === 'completed') completed++;
          else if (td.status === 'in_progress') {
            inProgress++;
            if (td.subject) pendingSubjects.push(td.subject);
          }
        } catch {}
      }
      if (total > 0) {
        const pct = Math.round(completed * 100 / total);
        const todoBarW = 10;
        const todoFilled = Math.round(pct * todoBarW / 100);
        const todoEmpty = todoBarW - todoFilled;
        const todoColor = pct === 100 ? GREEN : pct >= 50 ? YELLOW : RED;
        const todoBar = todoColor + '\u2588'.repeat(todoFilled) + DIM + '\u2591'.repeat(todoEmpty) + RESET;
        let todoStr = `${DIM}todo:${RESET}[${todoBar}]${DIM}${completed}/${total}${RESET} ${DIM}(${pct}%)${RESET}`;
        if (inProgress > 0 && pendingSubjects.length > 0) {
          const subject = pendingSubjects[0].length > 30
            ? pendingSubjects[0].substring(0, 27) + '...'
            : pendingSubjects[0];
          todoStr += ` ${YELLOW}\u25b8${RESET} ${subject}`;
        }
        extraLines.push(todoStr);
      }
    }
  } catch {}

  return extraLines;
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    process.stdout.write('Status HUD: stdin read error\n');
    return null;
  }
}

function parseInput(input) {
  try {
    return JSON.parse(input);
  } catch {
    process.stdout.write('Status HUD: JSON parse error\n');
    return null;
  }
}

module.exports = {
  // ANSI
  RESET, BOLD, DIM, CYAN, GREEN, YELLOW, RED, MAGENTA, BLUE, WHITE,
  // Helpers
  get, formatTokens, formatDuration, formatCost, formatRemaining,
  execGit, findFiles, findMdFiles,
  // Rendering
  renderLine1, renderLine2, renderLine3, renderLine3NoPlugins,
  countPlugins, renderExtraLines,
  // IO
  readStdin, parseInput,
  // Path
  path, fs, os
};
