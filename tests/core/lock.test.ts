import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { acquireLock, releaseLock, readLock, isLocked } from '../../src/core/lock.js';

const TEST_BASE = join('/tmp', 'claude-agents-test-lock');
const AGENT_NAME = 'test-agent';

beforeEach(() => {
  mkdirSync(join(TEST_BASE, 'agents', AGENT_NAME), { recursive: true });
});

afterEach(() => {
  rmSync(TEST_BASE, { recursive: true, force: true });
});

describe('lock', () => {
  it('acquires lock successfully', () => {
    const lock = acquireLock(AGENT_NAME, TEST_BASE);
    expect(lock).not.toBeNull();
    expect(lock!.pid).toBe(process.pid);
    expect(lock!.hostname).toBeTruthy();
  });

  it('prevents double acquire by same process', () => {
    const first = acquireLock(AGENT_NAME, TEST_BASE);
    expect(first).not.toBeNull();

    // Same PID — lock file exists with our PID, process is alive
    // acquireLock checks staleness: our PID is alive, so it returns null
    const second = acquireLock(AGENT_NAME, TEST_BASE);
    expect(second).toBeNull();
  });

  it('reads lock info', () => {
    acquireLock(AGENT_NAME, TEST_BASE);
    const info = readLock(AGENT_NAME, TEST_BASE);
    expect(info).not.toBeNull();
    expect(info!.pid).toBe(process.pid);
  });

  it('releases lock', () => {
    acquireLock(AGENT_NAME, TEST_BASE);
    const released = releaseLock(AGENT_NAME, TEST_BASE);
    expect(released).toBe(true);
    expect(readLock(AGENT_NAME, TEST_BASE)).toBeNull();
  });

  it('reports locked status', () => {
    expect(isLocked(AGENT_NAME, TEST_BASE)).toBe(false);
    acquireLock(AGENT_NAME, TEST_BASE);
    expect(isLocked(AGENT_NAME, TEST_BASE)).toBe(true);
    releaseLock(AGENT_NAME, TEST_BASE);
    expect(isLocked(AGENT_NAME, TEST_BASE)).toBe(false);
  });

  it('returns null for non-existent lock', () => {
    expect(readLock('nonexistent', TEST_BASE)).toBeNull();
  });
});
