import type { Command } from 'commander';
import { mkdirSync, writeFileSync } from 'node:fs';
import { input, select, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { getAgentDir, getAgentConfig, getAgentState, getAgentPrompt, getAgentHandoff } from '../core/paths.js';
import { createInitialState, writeState } from '../core/state.js';
import { getTemplateNames, createAgentConfig } from '../templates/registry.js';
import { PERSONAL_ASSISTANT_PROMPT } from '../templates/personal-assistant.js';
import { CODE_MONITOR_PROMPT } from '../templates/code-monitor.js';
import { INFO_MINER_PROMPT } from '../templates/info-miner.js';
import type { TemplateName, ChannelConfig } from '../types.js';

const TEMPLATE_PROMPTS: Record<string, string> = {
  'personal-assistant': PERSONAL_ASSISTANT_PROMPT,
  'code-monitor': CODE_MONITOR_PROMPT,
  'info-miner': INFO_MINER_PROMPT,
};

async function promptNotificationChannel(): Promise<ChannelConfig | null> {
  const wantNotify = await confirm({
    message: 'Configure notification channel?',
    default: false,
  });

  if (!wantNotify) return null;

  const type = await select({
    message: 'Notification channel:',
    choices: [
      { name: 'Telegram', value: 'telegram' as const },
      { name: 'WeChat Work (企业微信)', value: 'wecom' as const },
      { name: 'Feishu (飞书)', value: 'feishu' as const },
    ],
  });

  switch (type) {
    case 'telegram':
      return {
        type: 'telegram',
        botTokenEnv: await input({
          message: 'Env var name for bot token:',
          default: 'TELEGRAM_BOT_TOKEN',
        }),
        chatIdEnv: await input({
          message: 'Env var name for chat ID:',
          default: 'TELEGRAM_CHAT_ID',
        }),
      };
    case 'wecom':
      return {
        type: 'wecom',
        webhookUrlEnv: await input({
          message: 'Env var name for webhook URL:',
          default: 'WECOM_WEBHOOK_URL',
        }),
      };
    case 'feishu':
      return {
        type: 'feishu',
        webhookUrlEnv: await input({
          message: 'Env var name for webhook URL:',
          default: 'FEISHU_WEBHOOK_URL',
        }),
      };
  }
}

export function registerCreateCommand(program: Command): void {
  program
    .command('create [template]')
    .description('Create a new agent from a template')
    .action(async (templateArg?: string) => {
      console.log(chalk.bold('\n🤖 Create a new Claude Agent\n'));

      // 1. Select template
      const template: TemplateName = templateArg as TemplateName ?? await select({
        message: 'Select template:',
        choices: getTemplateNames().map((t) => ({
          name: t,
          value: t,
        })),
      });

      // 2. Agent name
      const name = await input({
        message: 'Agent name (lowercase, dashes):',
        default: template === 'custom' ? 'my-agent' : template,
        validate: (v) => /^[a-z0-9-]+$/.test(v) || 'Must be lowercase alphanumeric with dashes',
      });

      // 3. Working directory
      const workingDirectory = await input({
        message: 'Working directory:',
        default: process.cwd(),
      });

      // 4. Notification
      const channel = await promptNotificationChannel();

      // 5. Build config
      const config = template === 'custom'
        ? createAgentConfig('personal-assistant', name, {
            template: 'custom',
            workingDirectory,
            notification: {
              channels: channel ? [channel] : [],
              onSuccess: true,
              onFailure: true,
              onDigest: true,
            },
          })
        : createAgentConfig(template, name, {
            workingDirectory,
            notification: {
              channels: channel ? [channel] : [],
              onSuccess: true,
              onFailure: true,
              onDigest: true,
            },
          });

      // 6. Write files
      const agentDir = getAgentDir(name);
      mkdirSync(agentDir, { recursive: true });

      writeFileSync(getAgentConfig(name), JSON.stringify(config, null, 2));
      writeState(name, createInitialState(name));
      writeFileSync(getAgentPrompt(name), TEMPLATE_PROMPTS[template] ?? '# Custom Agent\n\nDescribe your agent prompt here.\n');
      writeFileSync(getAgentHandoff(name), '');

      console.log(chalk.green(`\n✅ Agent "${name}" created at ${agentDir}`));
      console.log(chalk.dim(`\n  Edit prompt:  ${getAgentPrompt(name)}`));
      console.log(chalk.dim(`  Start agent:  agents start ${name}`));
      console.log(chalk.dim(`  Manual run:   agents run --name ${name}\n`));
    });
}
