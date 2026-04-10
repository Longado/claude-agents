import type { Command } from 'commander';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getAgentDir } from '../core/paths.js';
import { createAgentConfig } from '../templates/registry.js';
import { createInitialState, writeState } from '../core/state.js';
import { writeHandoff } from '../core/handoff.js';
import { addTask, readQueue } from '../core/shared.js';
import { readState } from '../core/state.js';
import { BUILDER_PROMPT } from '../templates/builder.js';
import { REVIEWER_PROMPT } from '../templates/reviewer.js';

const TEMPLATE_PROMPTS: Record<'builder' | 'reviewer', string> = {
  builder: BUILDER_PROMPT,
  reviewer: REVIEWER_PROMPT,
};

function initAgent(name: string, template: 'builder' | 'reviewer', projectPath: string): void {
  const config = createAgentConfig(template, name, {
    workingDirectory: projectPath,
  });

  const agentDir = getAgentDir(name);
  mkdirSync(agentDir, { recursive: true });

  writeFileSync(join(agentDir, 'config.json'), JSON.stringify(config, null, 2));
  writeState(name, createInitialState(name));
  writeHandoff(name, '');
  writeFileSync(join(agentDir, 'prompt.md'), TEMPLATE_PROMPTS[template]);
}

export function registerTeamCommand(program: Command): void {
  const team = program
    .command('team')
    .description('Manage builder + reviewer agent team');

  team
    .command('init')
    .description('Create a builder + reviewer team for a project')
    .requiredOption('--project <path>', 'Project working directory')
    .option('--builder-name <name>', 'Builder agent name', 'builder')
    .option('--reviewer-name <name>', 'Reviewer agent name', 'reviewer')
    .action((opts: { project: string; builderName: string; reviewerName: string }) => {
      const projectPath = opts.project.startsWith('/')
        ? opts.project
        : join(process.cwd(), opts.project);

      if (!existsSync(projectPath)) {
        console.error(`Project path does not exist: ${projectPath}`);
        process.exit(1);
      }

      initAgent(opts.builderName, 'builder', projectPath);
      initAgent(opts.reviewerName, 'reviewer', projectPath);

      console.log(`\nTeam created:`);
      console.log(`  Builder: ${opts.builderName} → ${projectPath}`);
      console.log(`  Reviewer: ${opts.reviewerName} → ${projectPath}`);
      console.log(`\nNext steps:`);
      console.log(`  agents team add-task "Your first task"`);
      console.log(`  agents start ${opts.builderName}`);
      console.log(`  agents start ${opts.reviewerName}`);
    });

  team
    .command('add-task')
    .description('Add a task to the team queue')
    .argument('<description>', 'Task description')
    .action((description: string) => {
      const item = addTask(description);
      console.log(`Task added: ${item.id}`);
      console.log(`  "${description}"`);
      console.log(`  Status: queued`);
    });

  team
    .command('status')
    .description('Show team queue and agent status')
    .action(() => {
      const queue = readQueue();

      console.log('\n📋 Task Queue:');
      if (queue.length === 0) {
        console.log('  (empty)');
      } else {
        for (const item of queue) {
          const icon = item.status === 'done' ? '✅'
            : item.status === 'failed' ? '❌'
            : item.status === 'building' ? '🔨'
            : item.status === 'needs_review' ? '👀'
            : item.status === 'needs_fix' ? '🔧'
            : '⏳';
          console.log(`  ${icon} [${item.status}] ${item.task}`);
          if (item.feedback) {
            console.log(`     💬 ${item.feedback}`);
          }
        }
      }

      // Show agent states
      console.log('\n🤖 Agents:');
      for (const name of ['builder', 'reviewer']) {
        try {
          const state = readState(name);
          const statusIcon = state.status === 'running' ? '🟢'
            : state.status === 'error' ? '🔴'
            : '⚪';
          console.log(`  ${statusIcon} ${name}: ${state.status} (episode ${state.currentEpisode}, ${state.totalRuns} runs, ${state.totalErrors} errors)`);
        } catch {
          console.log(`  ⚫ ${name}: not initialized`);
        }
      }
      console.log('');
    });
}
