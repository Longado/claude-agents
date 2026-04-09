import type { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { getAgentConfig } from '../core/paths.js';
import { AgentConfigSchema, type AgentConfig } from '../types.js';
import { executeAgent } from '../core/executor.js';
import { dispatch } from '../notify/dispatcher.js';

function isWithinActiveHours(config: AgentConfig): boolean {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  if (!config.schedule.daysOfWeek.includes(day)) return false;

  const { startHour, endHour } = config.schedule;
  if (startHour <= endHour) {
    return hour >= startHour && hour < endHour;
  }
  // Wraps midnight (e.g., 22 to 6)
  return hour >= startHour || hour < endHour;
}

function loadConfig(name: string): AgentConfig {
  const path = getAgentConfig(name);
  const raw = readFileSync(path, 'utf-8');
  return AgentConfigSchema.parse(JSON.parse(raw));
}

export function registerRunCommand(program: Command): void {
  program
    .command('run', { hidden: true })
    .description('Run an agent episode (used by launchd)')
    .requiredOption('--name <name>', 'Agent name')
    .action(async (opts: { name: string }) => {
      try {
        const config = loadConfig(opts.name);

        // Check active hours — exit silently if outside window
        if (!isWithinActiveHours(config)) {
          process.exit(0);
        }

        const result = await executeAgent(config);

        // Send notifications
        if (result.success && config.notification.onSuccess) {
          await dispatch(config.notification.channels, {
            agentName: config.name,
            title: `Episode ${result.episode} completed`,
            body: `Duration: ${Math.round(result.durationMs / 1000)}s`,
            level: 'success',
            timestamp: new Date().toISOString(),
          });
        }

        if (!result.success && config.notification.onFailure) {
          await dispatch(config.notification.channels, {
            agentName: config.name,
            title: `Episode ${result.episode} failed`,
            body: result.timedOut
              ? `Timed out after ${config.timeoutSeconds}s`
              : result.stderr.slice(0, 300),
            level: 'error',
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err) {
        // Log but always exit 0 to avoid launchd throttling
        console.error(`[${opts.name}] Fatal:`, err);
      }

      // Always exit 0 — errors tracked in STATE.json
      process.exit(0);
    });
}
