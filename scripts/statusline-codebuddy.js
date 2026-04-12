#!/usr/bin/env node
'use strict';

const {
  get, path, fs, os,
  readStdin, parseInput,
  renderLine1, renderLine2, renderLine3, renderLine3NoPlugins,
  countPlugins, renderExtraLines
} = require('./lib');

function main() {
  const input = readStdin();
  if (!input) return;

  const data = parseInput(input);
  if (!data) return;

  // ── Parse fields ───────────────────────────────────────────
  const envHome = path.join(os.homedir(), '.codebuddy');
  const model = get(data, 'model.display_name', 'Codebuddy');
  const used = get(data, 'context_window.used_percentage', null);

  const totalIn = get(data, 'context_window.total_input_tokens', 0);
  const totalOut = get(data, 'context_window.total_output_tokens', 0);

  const costUsd = get(data, 'cost.total_cost_usd', 0);
  const durationMs = get(data, 'cost.total_duration_ms', 0);
  const apiDurationMs = get(data, 'cost.total_api_duration_ms', 0);
  const linesAdded = get(data, 'cost.total_lines_added', 0);
  const linesRemoved = get(data, 'cost.total_lines_removed', 0);

  const projectDir = get(data, 'workspace.project_dir', '');
  const cwd = get(data, 'cwd', process.cwd());

  const usage5h = get(data, 'rate_limits.five_hour.used_percentage', null);
  const usage7d = get(data, 'rate_limits.seven_day.used_percentage', null);
  const resets5h = get(data, 'rate_limits.five_hour.resets_at', null);
  const resets7d = get(data, 'rate_limits.seven_day.resets_at', null);

  const sessionId = get(data, 'session_id', '');

  // ── Count plugins (Codebuddy: only ~/.codebuddy) ──────────
  const { mcpCount, skillCount, cliCount, hookCount, hasPluginData } = countPlugins([envHome], projectDir);

  // ── Render ─────────────────────────────────────────────────
  const line1 = renderLine1(model, used, usage5h, usage7d, resets5h, resets7d, 'N/A');
  const line2 = renderLine2(projectDir, cwd, linesAdded, linesRemoved);
  const line3 = hasPluginData
    ? renderLine3(costUsd, durationMs, apiDurationMs, totalIn, totalOut, mcpCount, skillCount, cliCount, hookCount)
    : renderLine3NoPlugins(costUsd, durationMs, apiDurationMs, totalIn, totalOut);
  const extraLines = renderExtraLines(envHome, sessionId);

  const output = [line1, line2, line3];
  for (const line of extraLines) output.push(line);
  process.stdout.write(output.join('\n') + '\n');
}

try {
  main();
} catch (err) {
  process.stdout.write(`Status HUD error: ${err.message}\n`);
}
