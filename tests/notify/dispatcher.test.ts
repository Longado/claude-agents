import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatch } from '../../src/notify/dispatcher.js';
import type { NotificationMessage, ChannelConfig } from '../../src/types.js';

const MOCK_MESSAGE: NotificationMessage = {
  agentName: 'test-bot',
  title: 'Test Notification',
  body: 'This is a test.',
  level: 'info',
  timestamp: '2026-04-07T10:00:00Z',
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('dispatcher', () => {
  it('returns empty results for no channels', async () => {
    const results = await dispatch([], MOCK_MESSAGE);
    expect(results).toEqual([]);
  });

  it('reports errors without throwing', async () => {
    // Missing env vars will cause errors
    const channels: ReadonlyArray<ChannelConfig> = [
      { type: 'telegram', botTokenEnv: 'MISSING_TOKEN', chatIdEnv: 'MISSING_CHAT' },
    ];

    const results = await dispatch(channels, MOCK_MESSAGE);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('Missing env vars');
  });

  it('handles mixed success and failure', async () => {
    // Both will fail due to missing env vars, but neither should throw
    const channels: ReadonlyArray<ChannelConfig> = [
      { type: 'telegram', botTokenEnv: 'MISSING_1', chatIdEnv: 'MISSING_2' },
      { type: 'wecom', webhookUrlEnv: 'MISSING_3' },
    ];

    const results = await dispatch(channels, MOCK_MESSAGE);
    expect(results).toHaveLength(2);
    expect(results.every((r) => !r.success)).toBe(true);
  });
});
