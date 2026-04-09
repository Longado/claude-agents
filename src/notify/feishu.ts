import type { NotificationChannel, NotificationMessage, FeishuChannelConfig } from '../types.js';

function buildCardContent(msg: NotificationMessage): object {
  const color = msg.level === 'error' ? 'red'
    : msg.level === 'success' ? 'green'
    : 'blue';

  return {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: msg.title },
        template: color,
      },
      elements: [
        {
          tag: 'div',
          text: { tag: 'lark_md', content: msg.body },
        },
        {
          tag: 'note',
          elements: [
            {
              tag: 'plain_text',
              content: `Agent: ${msg.agentName} | ${msg.timestamp}`,
            },
          ],
        },
      ],
    },
  };
}

export function createFeishuChannel(config: FeishuChannelConfig): NotificationChannel {
  return {
    type: 'feishu',
    async send(message: NotificationMessage): Promise<void> {
      const webhookUrl = process.env[config.webhookUrlEnv];

      if (!webhookUrl) {
        throw new Error(`Missing env var: ${config.webhookUrlEnv}`);
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCardContent(message)),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Feishu API error ${response.status}: ${body}`);
      }
    },
  };
}
