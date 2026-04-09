import type { NotificationChannel, NotificationMessage, TelegramChannelConfig } from '../types.js';

const LEVEL_EMOJI: Record<string, string> = {
  info: 'ℹ️',
  success: '✅',
  error: '❌',
};

function formatMessage(msg: NotificationMessage): string {
  const emoji = LEVEL_EMOJI[msg.level] ?? '';
  return [
    `${emoji} *${msg.title}*`,
    '',
    msg.body,
    '',
    `Agent: \`${msg.agentName}\``,
    `Time: ${msg.timestamp}`,
  ].join('\n');
}

export function createTelegramChannel(config: TelegramChannelConfig): NotificationChannel {
  return {
    type: 'telegram',
    async send(message: NotificationMessage): Promise<void> {
      const token = process.env[config.botTokenEnv];
      const chatId = process.env[config.chatIdEnv];

      if (!token || !chatId) {
        throw new Error(
          `Missing env vars: ${config.botTokenEnv} and/or ${config.chatIdEnv}`,
        );
      }

      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: formatMessage(message),
          parse_mode: 'Markdown',
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Telegram API error ${response.status}: ${body}`);
      }
    },
  };
}
