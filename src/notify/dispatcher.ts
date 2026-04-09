import type { ChannelConfig, NotificationChannel, NotificationMessage } from '../types.js';
import { createTelegramChannel } from './telegram.js';
import { createWecomChannel } from './wecom.js';
import { createFeishuChannel } from './feishu.js';

function createChannel(config: ChannelConfig): NotificationChannel {
  switch (config.type) {
    case 'telegram':
      return createTelegramChannel(config);
    case 'wecom':
      return createWecomChannel(config);
    case 'feishu':
      return createFeishuChannel(config);
  }
}

export interface DispatchResult {
  readonly channel: string;
  readonly success: boolean;
  readonly error?: string;
}

export async function dispatch(
  channels: ReadonlyArray<ChannelConfig>,
  message: NotificationMessage,
): Promise<ReadonlyArray<DispatchResult>> {
  const results = await Promise.allSettled(
    channels.map(async (config) => {
      const channel = createChannel(config);
      await channel.send(message);
      return config.type;
    }),
  );

  return results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return { channel: result.value, success: true };
    }
    return {
      channel: channels[i].type,
      success: false,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    };
  });
}
