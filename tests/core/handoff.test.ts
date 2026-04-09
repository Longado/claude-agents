import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  readHandoff,
  writeHandoff,
  buildHandoffInstructions,
} from '../../src/core/handoff.js';

const TEST_BASE = join('/tmp', 'claude-agents-test-handoff');
const AGENT_NAME = 'test-agent';

beforeEach(() => {
  mkdirSync(join(TEST_BASE, 'agents', AGENT_NAME), { recursive: true });
});

afterEach(() => {
  rmSync(TEST_BASE, { recursive: true, force: true });
});

describe('handoff', () => {
  it('returns empty string for missing handoff', () => {
    expect(readHandoff(AGENT_NAME, TEST_BASE)).toBe('');
  });

  it('writes and reads handoff', () => {
    const content = '# Episode 1 Summary\nDid some work.';
    writeHandoff(AGENT_NAME, content, TEST_BASE);
    expect(readHandoff(AGENT_NAME, TEST_BASE)).toBe(content);
  });

  it('builds instructions with first-episode notice', () => {
    const instructions = buildHandoffInstructions(AGENT_NAME, TEST_BASE);
    expect(instructions).toContain('first episode');
    expect(instructions).toContain('HANDOFF.md');
  });

  it('builds instructions with previous context', () => {
    writeHandoff(AGENT_NAME, '# Previous work done', TEST_BASE);
    const instructions = buildHandoffInstructions(AGENT_NAME, TEST_BASE);
    expect(instructions).toContain('Previous work done');
    expect(instructions).toContain('HANDOFF.md');
  });
});
