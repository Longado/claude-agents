import type { NotificationChannel, NotificationMessage, WecomChannelConfig } from '../types.js';

function formatMarkdown(msg: NotificationMessage): string {
  const levelLabel = msg.level === 'error' ? '<font color="warning">ERROR</font>'
    : msg.level === 'success' ? '<font color="info">SUCCESS</font>'
    : 'INFO';

  return [
    `### ${levelLabel} ${msg.title}`,
    '',
    msg.body,
    '',
    `> Agent: ${msg.agentName}`,
    `> Time: ${msg.timestamp}`,
  ].join('\n');
}

export function createWecomChannel(config: WecomChannelConfig): NotificationChannel {
  return {
    type: 'wecom',
    async send(message: NotificationMessage): Promise<void> {
      const webhookUrl = process.env[config.webhookUrlEnv];

      if (!webhookUrl) {
        throw new Error(`Missing env var: ${config.webhookUrlEnv}`);
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'markdown',
          markdown: { content: formatMarkdown(message) },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`WeChat Work API error ${response.status}: ${body}`);
      }
    },
  };
}
