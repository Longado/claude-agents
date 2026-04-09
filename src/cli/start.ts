import type { Command } from 'commander';
import { readFileSync, existsSync } from 'node:fs';
import chalk from 'chalk';
import { getAgentConfig } from '../core/paths.js';
import { AgentConfigSchema } from '../types.js';
import { installAgent, isAgentLoaded } from '../core/launchd.js';

export function registerStartCommand(program: Command): void {
  program
    .command('start <name>')
    .description('Start an agent (install launchd plist)')
    .action(async (name: string) => {
      const configPath = getAgentConfig(name);
      if (!existsSync(configPath)) {
        console.error(chalk.red(`Agent "${name}" not found. Run: agents create`));
        process.exit(1);
      }

      if (isAgentLoaded(name)) {
        console.log(chalk.yellow(`Agent "${name}" is already running.`));
        return;
      }

      const raw = readFileSync(configPath, 'utf-8');
      const config = AgentConfigSchema.parse(JSON.parse(raw));

      const plistPath = installAgent(config);
      console.log(chalk.green(`✅ Agent "${name}" started`));
      console.log(chalk.dim(`  Plist: ${plistPath}`));
      console.log(chalk.dim(`  Interval: every ${config.schedule.intervalSeconds}s`));
      console.log(chalk.dim(`  Hours: ${config.schedule.startHour}:00 - ${config.schedule.endHour}:00`));
      console.log(chalk.dim(`\n  Check status: agents status ${name}`));
      console.log(chalk.dim(`  View logs:    agents logs ${name}`));
    });
}
