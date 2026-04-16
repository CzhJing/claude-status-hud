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

  let line1 = `${CYAN}${BOLD}[${model}]${RESET} ${barStr}`;

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

const GIT_CACHE_TTL_MS = 5000;

function getGitCacheFile(cwd) {
  // Use last 40 chars of sanitized cwd as suffix to keep per-repo caches separate
  const suffix = cwd.replace(/[^a-zA-Z0-9]/g, '_').slice(-40);
  return path.join(os.tmpdir(), `statusline-git-cache-${suffix}`);
}

function readGitCache(cacheFile) {
  try {
    const stat = fs.statSync(cacheFile);
    if (Date.now() - stat.mtimeMs < GIT_CACHE_TTL_MS) {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    }
  } catch {}
  return null;
}

function fetchGitInfo(cwd) {
  const result = { branch: '', stagedCount: 0, modifiedCount: 0, ahead: 0, behind: 0 };

  const branch = execGit('git rev-parse --abbrev-ref HEAD', cwd);
  if (!branch) return result;
  result.branch = branch;

  try {
    const statusOut = execSync('git status --porcelain', { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    if (statusOut) {
      for (const line of statusOut.split('\n')) {
        if (!line) continue;
        const x = line[0];
        const y = line[1];
        if (x !== ' ' && x !== '?') result.stagedCount++;
        if (y !== ' ' && y !== '?') result.modifiedCount++;
      }
    }
  } catch {}

  const upstream = execGit('git rev-parse --abbrev-ref @{upstream}', cwd);
  if (upstream) {
    result.ahead = parseInt(execGit(`git rev-list --count ${upstream}..HEAD`, cwd), 10) || 0;
    result.behind = parseInt(execGit(`git rev-list --count HEAD..${upstream}`, cwd), 10) || 0;
  }

  return result;
}

function getGitInfo(cwd) {
  const cacheFile = getGitCacheFile(cwd);
  const cached = readGitCache(cacheFile);
  if (cached) return cached;

  const info = fetchGitInfo(cwd);
  try { fs.writeFileSync(cacheFile, JSON.stringify(info)); } catch {}
  return info;
}

function renderLine2(projectDir, cwd, linesAdded, linesRemoved) {
  let line2 = '';

  if (projectDir) {
    const projName = projectDir.split(/[/\\]/).filter(Boolean).pop() || '';
    if (projName) {
      line2 = `\uD83D\uDCC1 ${BLUE}${BOLD}${projName}${RESET}`;
    }
  }

  const { branch, stagedCount, modifiedCount, ahead, behind } = getGitInfo(cwd);
  if (branch) {
    let ab = '';
    if (ahead > 0) ab += `${GREEN}\u2191${ahead}${RESET}`;
    if (behind > 0) ab += `${RED}\u2193${behind}${RESET}`;

    if (line2) line2 += ` ${DIM}|${RESET} `;
    line2 += `${MAGENTA}${BOLD}\u2387 ${branch}${RESET}${ab ? ' ' + ab : ''} ${GREEN}+${stagedCount}${RESET} ${YELLOW}~${modifiedCount}${RESET}`;
  }

  return line2;
}

function renderLine3(costUsd, durationMs, apiDurationMs, totalIn, totalOut, mcpCount, skillCount, cliCount, hookCount) {
  const costFmt = formatCost(costUsd);
  const durFmt = formatDuration(durationMs);
  const apiFmt = formatDuration(apiDurationMs);
  const inFmt = formatTokens(totalIn);
  const outFmt = formatTokens(totalOut);

  const pluginsPart = ` ${DIM}|${RESET} ${CYAN}${mcpCount} Mcps${RESET} ${DIM}|${RESET} ${GREEN}${skillCount} Skills${RESET} ${DIM}|${RESET} ${YELLOW}${cliCount} Clis${RESET} ${DIM}|${RESET} ${MAGENTA}${hookCount} Hooks${RESET}`;

  return `\uD83D\uDCB0${DIM}:${RESET} ${WHITE}${BOLD}${costFmt}${RESET}  ⏱︎${DIM}:${RESET} ${durFmt}${DIM}(${apiFmt} api)${RESET}  ${DIM}token[${RESET}${GREEN}\u2B06 ${inFmt}${RESET}${DIM}/${RESET}${YELLOW}\u2B07 ${outFmt}${RESET}${DIM}]${RESET}${pluginsPart}`;
}

function renderLine3NoPlugins(costUsd, durationMs, apiDurationMs, totalIn, totalOut) {
  const costFmt = formatCost(costUsd);
  const durFmt = formatDuration(durationMs);
  const apiFmt = formatDuration(apiDurationMs);
  const inFmt = formatTokens(totalIn);
  const outFmt = formatTokens(totalOut);

  return `\uD83D\uDCB0${DIM}:${RESET} ${WHITE}${BOLD}${costFmt}${RESET}  ⏱︎${DIM}:${RESET} ${durFmt}${DIM}(${apiFmt} api)${RESET}  ${DIM}token[${RESET}${GREEN}\u2B06 ${inFmt}${RESET}${DIM}/${RESET}${YELLOW}\u2B07 ${outFmt}${RESET}${DIM}]${RESET}`;
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

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function toTimestamp(value) {
  if (value == null || value === '') return null;

  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveSessionTraceContext(envHome, sessionId) {
  if (!sessionId) return null;

  const sessionsDir = path.join(envHome, 'sessions');
  const sessionEntries = [];

  try {
    const sessionFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json')).sort();
    for (const sessionFile of sessionFiles) {
      const sessionData = readJsonFile(path.join(sessionsDir, sessionFile));
      if (!sessionData || sessionData.pid == null) continue;

      sessionEntries.push({
        sessionId: String(sessionData.sessionId || sessionData.session_id || ''),
        pid: String(sessionData.pid),
        startedAt: toTimestamp(sessionData.startedAt || sessionData.started_at)
      });
    }
  } catch {
    return null;
  }

  const currentSession = sessionEntries.find(entry => entry.sessionId === sessionId);
  if (!currentSession) return null;

  let nextSessionStartedAt = null;
  if (currentSession.startedAt !== null) {
    for (const entry of sessionEntries) {
      if (entry.pid !== currentSession.pid) continue;
      if (entry.sessionId === currentSession.sessionId) continue;
      if (entry.startedAt === null || entry.startedAt <= currentSession.startedAt) continue;
      if (nextSessionStartedAt === null || entry.startedAt < nextSessionStartedAt) {
        nextSessionStartedAt = entry.startedAt;
      }
    }
  }

  return {
    traceDir: path.join(envHome, 'traces', currentSession.pid),
    sessionStartedAt: currentSession.startedAt,
    nextSessionStartedAt
  };
}

function traceMatchesSession(traceData, sessionId, sessionStartedAt, nextSessionStartedAt) {
  const candidates = [
    get(traceData, 'sessionId', null),
    get(traceData, 'session_id', null),
    get(traceData, 'trace.sessionId', null),
    get(traceData, 'trace.session_id', null),
    get(traceData, 'trace.session.id', null),
    get(traceData, 'trace.metadata.sessionId', null),
    get(traceData, 'trace.metadata.session_id', null),
    get(traceData, 'metadata.sessionId', null),
    get(traceData, 'metadata.session_id', null)
  ];

  let hasExplicitSessionId = false;
  for (const value of candidates) {
    if (value == null || value === '') continue;
    hasExplicitSessionId = true;
    if (String(value) === sessionId) return true;
  }

  if (hasExplicitSessionId || sessionStartedAt === null) return false;

  const traceStartedAt = toTimestamp(get(traceData, 'trace.startedAt', get(traceData, 'startedAt', null)));
  if (traceStartedAt === null || traceStartedAt < sessionStartedAt) return false;
  if (nextSessionStartedAt !== null && traceStartedAt >= nextSessionStartedAt) return false;
  return true;
}

function getTraceSpans(traceData) {
  if (Array.isArray(traceData.spans)) return traceData.spans;

  const nestedSpans = get(traceData, 'trace.spans', null);
  return Array.isArray(nestedSpans) ? nestedSpans : [];
}

function shouldIncludeTrace(traceData, nowMs) {
  const endedAtMs = toTimestamp(get(traceData, 'trace.endedAt', get(traceData, 'endedAt', null)));
  return endedAtMs === null || nowMs - endedAtMs <= 60000;
}

function readSessionTraceSummary(envHome, sessionId) {
  const summary = {
    toolCounts: {},
    agentNames: [],
    hasRunningAgent: false
  };

  const traceContext = resolveSessionTraceContext(envHome, sessionId);
  if (!traceContext || !fs.existsSync(traceContext.traceDir)) return summary;

  const nowMs = Date.now();
  const seenAgents = new Set();

  try {
    const traceFiles = fs.readdirSync(traceContext.traceDir).filter(f => f.endsWith('.json')).sort();
    for (const traceFile of traceFiles) {
      const traceData = readJsonFile(path.join(traceContext.traceDir, traceFile));
      if (!traceData) continue;
      if (!traceMatchesSession(traceData, sessionId, traceContext.sessionStartedAt, traceContext.nextSessionStartedAt)) continue;
      if (!shouldIncludeTrace(traceData, nowMs)) continue;

      const spans = getTraceSpans(traceData);
      for (const span of spans) {
        if (!span || typeof span !== 'object') continue;

        if (span.type === 'function') {
          const toolNameValue = span.toolName || span.name;
          const toolName = typeof toolNameValue === 'string' ? toolNameValue.trim() : '';
          if (!toolName) continue;
          summary.toolCounts[toolName] = (summary.toolCounts[toolName] || 0) + 1;
        }

        if (span.type === 'agent') {
          if (!span.endedAt) summary.hasRunningAgent = true;

          const agentNameValue = span.agentName || span.name;
          const agentName = typeof agentNameValue === 'string' ? agentNameValue.trim() : '';
          if (!agentName || seenAgents.has(agentName)) continue;
          seenAgents.add(agentName);
          summary.agentNames.push(agentName);
        }
      }
    }
  } catch {}

  return summary;
}

function getTaskNumericId(taskData, fileName) {
  const candidates = [taskData && taskData.id, path.basename(fileName, '.json')];
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (/^\d+$/.test(value)) return Number(value);
  }
  return null;
}

function getTaskSortTimestamp(taskData) {
  const candidates = [
    taskData && taskData.updatedAt,
    taskData && taskData.updated_at,
    taskData && taskData.createdAt,
    taskData && taskData.created_at
  ];

  for (const candidate of candidates) {
    const timestamp = toTimestamp(candidate);
    if (timestamp !== null) return timestamp;
  }

  return null;
}

function compareTaskRecords(a, b) {
  if (a.numericId !== null || b.numericId !== null) {
    if (a.numericId !== null && b.numericId !== null && a.numericId !== b.numericId) {
      return a.numericId - b.numericId;
    }
    if (a.numericId !== null) return -1;
    if (b.numericId !== null) return 1;
  }

  if (a.sortTimestamp !== null || b.sortTimestamp !== null) {
    if (a.sortTimestamp !== null && b.sortTimestamp !== null && a.sortTimestamp !== b.sortTimestamp) {
      return a.sortTimestamp - b.sortTimestamp;
    }
    if (a.sortTimestamp !== null) return -1;
    if (b.sortTimestamp !== null) return 1;
  }

  return a.fileName.localeCompare(b.fileName);
}

function readSessionTasks(envHome, sessionId) {
  if (!sessionId) return [];

  const tasksDir = path.join(envHome, 'tasks', sessionId);
  if (!fs.existsSync(tasksDir)) return [];

  const tasks = [];
  try {
    const taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'));
    for (const taskFile of taskFiles) {
      const taskData = readJsonFile(path.join(tasksDir, taskFile));
      if (!taskData || typeof taskData !== 'object') continue;

      const subject = typeof taskData.subject === 'string' ? taskData.subject.trim() : '';
      const status = typeof taskData.status === 'string' ? taskData.status : '';
      if (status !== 'completed' && status !== 'in_progress' && status !== 'pending') continue;

      tasks.push({
        fileName: taskFile,
        numericId: getTaskNumericId(taskData, taskFile),
        sortTimestamp: getTaskSortTimestamp(taskData),
        status,
        subject
      });
    }
  } catch {}

  return tasks.sort(compareTaskRecords);
}

function renderTodoLine(tasks) {
  if (tasks.length === 0) return null;

  let completed = 0;
  let inProgress = 0;
  for (const task of tasks) {
    if (task.status === 'completed') completed++;
    else if (task.status === 'in_progress') inProgress++;
  }

  const total = tasks.length;
  const pct = Math.round(completed * 100 / total);
  const todoBarW = 10;
  const todoFilled = Math.round(pct * todoBarW / 100);
  const todoEmpty = todoBarW - todoFilled;
  const todoColor = pct === 100 ? GREEN : pct >= 50 ? YELLOW : RED;
  const todoBar = todoColor + '\u2588'.repeat(todoFilled) + DIM + '\u2591'.repeat(todoEmpty) + RESET;

  let todoStr = `${DIM}todo:${RESET}[${todoBar}]${DIM}${completed}/${total}${RESET} ${DIM}(${pct}%)${RESET}`;
  const activeTask = tasks.find(task => task.status === 'in_progress' && task.subject);
  if (inProgress > 0 && activeTask) {
    const subject = activeTask.subject.length > 30
      ? activeTask.subject.substring(0, 27) + '...'
      : activeTask.subject;
    todoStr += ` ${YELLOW}\u25b8${RESET} ${subject}`;
  }

  return todoStr;
}

function renderExtraLines(envHome, sessionId) {
  const extraLines = [];

  const { toolCounts, agentNames, hasRunningAgent } = readSessionTraceSummary(envHome, sessionId);

  if (Object.keys(toolCounts).length > 0) {
    const sortedTools = Object.entries(toolCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
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
    const statusLabel = hasRunningAgent ? `${YELLOW}\u25cf running${RESET}` : `${GREEN}\u25cf idle${RESET}`;
    extraLines.push(`${DIM}agent:${RESET}${agentStr} ${statusLabel}`);
  }

  const todoLine = renderTodoLine(readSessionTasks(envHome, sessionId));
  if (todoLine) extraLines.push(todoLine);

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
