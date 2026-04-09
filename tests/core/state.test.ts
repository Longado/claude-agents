import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  createInitialState,
  readState,
  writeState,
  transitionState,
} from '../../src/core/state.js';

const TEST_BASE = join('/tmp', 'claude-agents-test-state');
const AGENT_NAME = 'test-agent';

beforeEach(() => {
  mkdirSync(join(TEST_BASE, 'agents', AGENT_NAME), { recursive: true });
});

afterEach(() => {
  rmSync(TEST_BASE, { recursive: true, force: true });
});

describe('state', () => {
  it('creates initial state with zeroed counters', () => {
    const state = createInitialState('my-bot');
    expect(state.name).toBe('my-bot');
    expect(state.status).toBe('idle');
    expect(state.currentEpisode).toBe(0);
    expect(state.totalRuns).toBe(0);
    expect(state.totalErrors).toBe(0);
    expect(state.lastRunAt).toBeNull();
  });

  it('writes and reads state', () => {
    const state = createInitialState(AGENT_NAME);
    writeState(AGENT_NAME, state, TEST_BASE);
    const read = readState(AGENT_NAME, TEST_BASE);
    expect(read).toEqual(state);
  });

  it('returns initial state for missing file', () => {
    const state = readState('nonexistent', TEST_BASE);
    expect(state.status).toBe('idle');
    expect(state.currentEpisode).toBe(0);
  });

  it('transitions state immutably', () => {
    const prev = createInitialState(AGENT_NAME);
    const next = transitionState(prev, { status: 'running', currentEpisode: 1 });

    expect(next.status).toBe('running');
    expect(next.currentEpisode).toBe(1);
    expect(next.name).toBe(AGENT_NAME);
    // Original unchanged
    expect(prev.status).toBe('idle');
    expect(prev.currentEpisode).toBe(0);
  });

  it('persists state across write/read cycles', () => {
    const initial = createInitialState(AGENT_NAME);
    const running = transitionState(initial, {
      status: 'running',
      currentEpisode: 3,
      totalRuns: 2,
      lastRunAt: '2026-04-07T10:00:00Z',
    });
    writeState(AGENT_NAME, running, TEST_BASE);

    const read = readState(AGENT_NAME, TEST_BASE);
    expect(read.status).toBe('running');
    expect(read.currentEpisode).toBe(3);
    expect(read.totalRuns).toBe(2);
    expect(read.lastRunAt).toBe('2026-04-07T10:00:00Z');
  });
});
