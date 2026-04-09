import type { Command } from 'commander';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { getAgentLogDir } from '../core/paths.js';

export function registerLogsCommand(program: Command): void {
  program
    .command('logs <name>')
    .description('Show agent logs')
    .option('-n, --lines <n>', 'Number of lines', '50')
    .option('--all', 'List all log files')
    .action(async (name: string, opts: { lines: string; all?: boolean }) => {
      const logDir = getAgentLogDir(name);

      if (!existsSync(logDir)) {
        console.log(chalk.dim(`No logs found for agent "${name}".`));
        return;
      }

      if (opts.all) {
        const files = readdirSync(logDir)
          .filter((f) => f.endsWith('.log') && f !== 'latest.log')
          .sort()
          .reverse();

        console.log(chalk.bold(`\nLog files for ${name}:\n`));
        for (const file of files) {
          console.log(`  ${file}`);
        }
        return;
      }

      const latestPath = join(logDir, 'latest.log');
      if (!existsSync(latestPath)) {
        console.log(chalk.dim('No latest log. Agent may not have run yet.'));
        return;
      }

      const content = readFileSync(latestPath, 'utf-8');
      const lines = content.split('\n');
      const n = parseInt(opts.lines, 10);
      const tail = lines.slice(-n).join('\n');

      console.log(tail);
    });
}
