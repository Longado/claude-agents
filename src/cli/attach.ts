import type { Command } from 'commander';
import chalk from 'chalk';
import { isTmuxAvailable, sessionExists, attachSession } from '../core/tmux.js';

export function registerAttachCommand(program: Command): void {
  program
    .command('attach <name>')
    .description('Attach to agent tmux session')
    .action(async (name: string) => {
      if (!isTmuxAvailable()) {
        console.error(chalk.red('tmux is not installed. Install with: brew install tmux'));
        process.exit(1);
      }

      if (!sessionExists(name)) {
        console.error(chalk.red(`No tmux session for agent "${name}".`));
        console.log(chalk.dim('tmux sessions are created when agents run. Try: agents run --name ' + name));
        process.exit(1);
      }

      attachSession(name);
    });
}
