import type { Command } from 'commander';
import chalk from 'chalk';
import { uninstallAgent, isAgentLoaded } from '../core/launchd.js';
import { releaseLock, isLocked } from '../core/lock.js';
import { killSession, sessionExists } from '../core/tmux.js';

export function registerStopCommand(program: Command): void {
  program
    .command('stop <name>')
    .description('Stop an agent (unload launchd plist)')
    .action(async (name: string) => {
      if (!isAgentLoaded(name)) {
        console.log(chalk.yellow(`Agent "${name}" is not running.`));
        return;
      }

      uninstallAgent(name);

      // Clean up lock if held
      if (isLocked(name)) {
        releaseLock(name);
      }

      // Kill tmux session if exists
      if (sessionExists(name)) {
        killSession(name);
      }

      console.log(chalk.green(`✅ Agent "${name}" stopped`));
    });
}
