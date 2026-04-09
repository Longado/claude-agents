import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { AgentConfig } from '../../src/types.js';

// Mock child_process.spawn
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'node:child_process';
import { executeAgent } from '../../src/core/executor.js';
import { writeState } from '../../src/core/state.js';

const mockedSpawn = vi.mocked(spawn);

function createMockProcess(exitCode: number, stdout = '', stderr = '') {
  const handlers: Record<string, Function[]> = {};
  const stdoutHandlers: Function[] = [];
  const stderrHandlers: Function[] = [];

  const child = {
    stdout: {
      on: vi.fn((event: string, handler: Function) => {
        stdoutHandlers.push(handler);
      }),
    },
    stderr: {
      on: vi.fn((event: string, handler: Function) => {
        stderrHandlers.push(handler);
      }),
    },
    on: vi.fn((event: string, handler: Function) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),
    kill: vi.fn(),
    pid: 12345,
  };

  // Emit data + close after a tick
  const trigger = () => {
    if (stdout) {
      for (const h of stdoutHandlers) h(Buffer.from(stdout));
    }
    if (stderr) {
      for (const h of stderrHandlers) h(Buffer.from(stderr));
    }
    for (const h of (handlers['close'] ?? [])) h(exitCode);
  };

  return { child, trigger };
}

function createMockErrorProcess(errorMessage: string) {
  const handlers: Record<string, Function[]> = {};

  const child = {
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn((event: string, handler: Function) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),
    kill: vi.fn(),
    pid: 12345,
  };

  const trigger = () => {
    for (const h of (handlers['error'] ?? [])) h(new Error(errorMessage));
  };

  return { child, trigger };
}

function makeConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    name: 'test-agent',
    template: 'custom',
    schedule: {
      intervalSeconds: 300,
      startHour: 0,
      endHour: 23,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    },
    notification: {
      channels: [],
      onSuccess: false,
      onFailure: false,
      onDigest: false,
    },
    model: 'claude-sonnet-4-6',
    maxTurns: 10,
    timeoutSeconds: 60,
    allowedTools: ['Read', 'Grep'],
    workingDirectory: '/tmp',
    env: {},
    ...overrides,
  };
}

describe('executeAgent', () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = join(tmpdir(), `executor-test-${Date.now()}`);
    mkdirSync(join(baseDir, 'agents', 'test-agent'), { recursive: true });

    // Initialize state file
    writeState('test-agent', {
      name: 'test-agent',
      status: 'idle',
      currentEpisode: 0,
      totalRuns: 0,
      totalErrors: 0,
      lastRunAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
    }, baseDir);

    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('returns lock failure when another instance is running', async () => {
    // Create a .lock file with current PID (alive process = lock is held)
    const lockDir = join(baseDir, 'agents', 'test-agent');
    writeFileSync(join(lockDir, '.lock'), JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString(),
      hostname: 'test',
    }));

    const result = await executeAgent(makeConfig(), baseDir);
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('lock');
  });

  it('executes claude with correct args on success', async () => {
    const { child, trigger } = createMockProcess(0, 'Agent output here');
    mockedSpawn.mockReturnValue(child as any);

    const promise = executeAgent(makeConfig(), baseDir);
    // Allow the async flow to reach spawn
    await new Promise(r => setTimeout(r, 10));
    trigger();

    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.episode).toBe(1);
    expect(result.stdout).toBe('Agent output here');
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);

    // Verify spawn was called with correct args
    expect(mockedSpawn).toHaveBeenCalledWith(
      'claude',
      expect.arrayContaining(['--print', '--model', 'claude-sonnet-4-6']),
      expect.objectContaining({
        cwd: '/tmp',
      }),
    );
  });

  it('handles spawn errors gracefully', async () => {
    const { child, trigger } = createMockErrorProcess('Command not found');
    mockedSpawn.mockReturnValue(child as any);

    const promise = executeAgent(makeConfig(), baseDir);
    await new Promise(r => setTimeout(r, 10));
    trigger();

    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.stderr).toContain('Command not found');
    expect(result.exitCode).toBe(null);
  });

  it('updates state to error on non-zero exit', async () => {
    const { child, trigger } = createMockProcess(1, '', 'Some error');
    mockedSpawn.mockReturnValue(child as any);

    const promise = executeAgent(makeConfig(), baseDir);
    await new Promise(r => setTimeout(r, 10));
    trigger();

    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);

    // Verify state was updated
    const stateFile = join(baseDir, 'agents', 'test-agent', 'state.json');
    const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
    expect(state.status).toBe('error');
    expect(state.totalErrors).toBe(1);
  });

  it('increments episode number from previous state', async () => {
    // Set state with episode 5
    writeState('test-agent', {
      name: 'test-agent',
      status: 'idle',
      currentEpisode: 5,
      totalRuns: 5,
      totalErrors: 0,
      lastRunAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
    }, baseDir);

    const { child, trigger } = createMockProcess(0, 'ok');
    mockedSpawn.mockReturnValue(child as any);

    const promise = executeAgent(makeConfig(), baseDir);
    await new Promise(r => setTimeout(r, 10));
    trigger();

    const result = await promise;

    expect(result.episode).toBe(6);
    expect(result.success).toBe(true);
  });

  it('writes log file after execution', async () => {
    const { child, trigger } = createMockProcess(0, 'log output');
    mockedSpawn.mockReturnValue(child as any);

    const promise = executeAgent(makeConfig(), baseDir);
    await new Promise(r => setTimeout(r, 10));
    trigger();

    await promise;

    // Check log directory exists and has files
    const logDir = join(baseDir, 'agents', 'test-agent', 'logs');
    expect(existsSync(logDir)).toBe(true);
  });

  it('removes CLAUDECODE env vars from spawned process', async () => {
    // Set env vars that should be removed
    process.env.CLAUDECODE = 'test-value';
    process.env.CLAUDE_CODE_SESSION = 'session-123';

    const { child, trigger } = createMockProcess(0, 'ok');
    mockedSpawn.mockReturnValue(child as any);

    const promise = executeAgent(makeConfig(), baseDir);
    await new Promise(r => setTimeout(r, 10));
    trigger();

    await promise;

    // Verify env passed to spawn does not contain CLAUDECODE
    const spawnCall = mockedSpawn.mock.calls[0];
    const env = spawnCall[2]?.env as Record<string, string>;
    expect(env.CLAUDECODE).toBeUndefined();
    expect(env.CLAUDE_CODE_SESSION).toBeUndefined();

    // Cleanup
    delete process.env.CLAUDECODE;
    delete process.env.CLAUDE_CODE_SESSION;
  });

  it('includes allowedTools in claude args', async () => {
    const { child, trigger } = createMockProcess(0, 'ok');
    mockedSpawn.mockReturnValue(child as any);

    const config = makeConfig({ allowedTools: ['Read', 'Grep', 'Bash(git *)'] });
    const promise = executeAgent(config, baseDir);
    await new Promise(r => setTimeout(r, 10));
    trigger();

    await promise;

    const spawnCall = mockedSpawn.mock.calls[0];
    const args = spawnCall[1] as string[];
    expect(args).toContain('--allowedTools');
    expect(args).toContain('Read,Grep,Bash(git *)');
  });
});
