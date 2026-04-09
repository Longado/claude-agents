import type { Command } from 'commander';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { getAgentsRoot, getAgentState, getAgentConfig } from '../core/paths.js';
import { readState } from '../core/state.js';
import { isAgentLoaded } from '../core/launchd.js';
import { isLocked } from '../core/lock.js';

function listAgentNames(): ReadonlyArray<string> {
  const agentsDir = join(getAgentsRoot(), 'agents');
  if (!existsSync(agentsDir)) return [];
  return readdirSync(agentsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function formatStatus(name: string): string {
  const state = readState(name);
  const loaded = isAgentLoaded(name);
  const locked = isLocked(name);

  const statusIcon = loaded
    ? (locked ? chalk.green('●') : chalk.green('○'))
    : chalk.dim('○');

  const statusLabel = loaded
    ? (locked ? chalk.green('RUNNING') : chalk.green('SCHEDULED'))
    : chalk.dim('STOPPED');

  const lastRun = state.lastRunAt
    ? new Date(state.lastRunAt).toLocaleString()
    : 'never';

  const errorInfo = state.totalErrors > 0
    ? chalk.yellow(` (${state.totalErrors} errors)`)
    : '';

  return `${statusIcon} ${chalk.bold(name)} ${statusLabel}  ep:${state.currentEpisode}  runs:${state.totalRuns}${errorInfo}  last:${lastRun}`;
}

function formatDetailedStatus(name: string): string {
  const state = readState(name);
  const loaded = isAgentLoaded(name);
  const locked = isLocked(name);

  const configPath = getAgentConfig(name);
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch { /* ignore */ }

  const lines = [
    chalk.bold(`\nAgent: ${name}`),
    `Status: ${loaded ? (locked ? chalk.green('RUNNING') : chalk.green('SCHEDULED')) : chalk.dim('STOPPED')}`,
    `Episode: ${state.currentEpisode}`,
    `Total runs: ${state.totalRuns}`,
    `Total errors: ${state.totalErrors}`,
    `Last run: ${state.lastRunAt ?? 'never'}`,
  ];

  if (state.lastErrorMessage) {
    lines.push(`Last error: ${chalk.red(state.lastErrorMessage)}`);
  }

  if (config.model) lines.push(`Model: ${config.model}`);
  if (config.schedule) {
    const s = config.schedule as Record<string, unknown>;
    lines.push(`Interval: ${s.intervalSeconds}s`);
    lines.push(`Hours: ${s.startHour}:00 - ${s.endHour}:00`);
  }

  return lines.join('\n');
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status [name]')
    .description('Show agent status')
    .action(async (name?: string) => {
      if (name) {
        console.log(formatDetailedStatus(name));
        return;
      }

      const agents = listAgentNames();
      if (agents.length === 0) {
        console.log(chalk.dim('No agents found. Run: agents create'));
        return;
      }

      console.log(chalk.bold('\nAgents:\n'));
      for (const agentName of agents) {
        console.log(`  ${formatStatus(agentName)}`);
      }
      console.log();
    });
}
