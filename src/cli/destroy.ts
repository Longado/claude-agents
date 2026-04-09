import type { Command } from 'commander';
import { existsSync, rmSync } from 'node:fs';
import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { getAgentDir } from '../core/paths.js';
import { uninstallAgent, isAgentLoaded } from '../core/launchd.js';
import { killSession, sessionExists } from '../core/tmux.js';

export function registerDestroyCommand(program: Command): void {
  program
    .command('destroy <name>')
    .description('Destroy an agent and all its data')
    .option('-f, --force', 'Skip confirmation')
    .action(async (name: string, opts: { force?: boolean }) => {
      const agentDir = getAgentDir(name);
      if (!existsSync(agentDir)) {
        console.error(chalk.red(`Agent "${name}" not found.`));
        process.exit(1);
      }

      if (!opts.force) {
        const ok = await confirm({
          message: `Destroy agent "${name}" and all its data? This cannot be undone.`,
          default: false,
        });
        if (!ok) {
          console.log(chalk.dim('Cancelled.'));
          return;
        }
      }

      // Stop if running
      if (isAgentLoaded(name)) {
        uninstallAgent(name);
      }

      // Kill tmux session
      if (sessionExists(name)) {
        killSession(name);
      }

      // Remove all data
      rmSync(agentDir, { recursive: true, force: true });
      console.log(chalk.green(`✅ Agent "${name}" destroyed.`));
    });
}
