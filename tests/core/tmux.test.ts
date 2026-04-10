import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'node:child_process';
import {
  isTmuxAvailable,
  sessionExists,
  createSession,
  killSession,
  captureOutput,
  sendCommand,
  listSessions,
} from '../../src/core/tmux.js';

const mockedExec = vi.mocked(execSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isTmuxAvailable', () => {
  it('returns true when tmux is installed', () => {
    mockedExec.mockReturnValue('/usr/bin/tmux');
    expect(isTmuxAvailable()).toBe(true);
    expect(mockedExec).toHaveBeenCalledWith('which tmux', { encoding: 'utf-8' });
  });

  it('returns false when tmux is not installed', () => {
    mockedExec.mockImplementation(() => { throw new Error('not found'); });
    expect(isTmuxAvailable()).toBe(false);
  });
});

describe('sessionExists', () => {
  it('returns true when session exists', () => {
    mockedExec.mockReturnValue('');
    expect(sessionExists('my-agent')).toBe(true);
    expect(mockedExec).toHaveBeenCalledWith(
      'tmux has-session -t "claude-agent-my-agent" 2>/dev/null',
      { encoding: 'utf-8' },
    );
  });

  it('returns false when session does not exist', () => {
    mockedExec.mockImplementation(() => { throw new Error('no session'); });
    expect(sessionExists('my-agent')).toBe(false);
  });
});

describe('createSession', () => {
  it('creates session with default options', () => {
    mockedExec.mockReturnValue('');
    createSession('test-agent');
    expect(mockedExec).toHaveBeenCalledWith(
      'tmux new-session -d -s "claude-agent-test-agent"  -x 200 -y 50',
      { encoding: 'utf-8' },
    );
  });

  it('creates session with custom cwd', () => {
    mockedExec.mockReturnValue('');
    createSession('test-agent', '/home/user/project');
    expect(mockedExec).toHaveBeenCalledWith(
      'tmux new-session -d -s "claude-agent-test-agent" -c "/home/user/project" -x 200 -y 50',
      { encoding: 'utf-8' },
    );
  });
});

describe('killSession', () => {
  it('kills existing session', () => {
    mockedExec.mockReturnValue('');
    killSession('test-agent');
    expect(mockedExec).toHaveBeenCalledWith(
      'tmux kill-session -t "claude-agent-test-agent"',
      { encoding: 'utf-8' },
    );
  });

  it('silently handles non-existent session', () => {
    mockedExec.mockImplementation(() => { throw new Error('no session'); });
    expect(() => killSession('test-agent')).not.toThrow();
  });
});

describe('captureOutput', () => {
  it('captures pane output with default lines', () => {
    mockedExec.mockReturnValue('line1\nline2\nline3');
    const output = captureOutput('test-agent');
    expect(output).toBe('line1\nline2\nline3');
    expect(mockedExec).toHaveBeenCalledWith(
      'tmux capture-pane -t "claude-agent-test-agent" -p -S -100',
      { encoding: 'utf-8' },
    );
  });

  it('captures with custom line count', () => {
    mockedExec.mockReturnValue('output');
    captureOutput('test-agent', 50);
    expect(mockedExec).toHaveBeenCalledWith(
      'tmux capture-pane -t "claude-agent-test-agent" -p -S -50',
      { encoding: 'utf-8' },
    );
  });

  it('returns empty string on error', () => {
    mockedExec.mockImplementation(() => { throw new Error('fail'); });
    expect(captureOutput('test-agent')).toBe('');
  });
});

describe('sendCommand', () => {
  it('sends command to session', () => {
    mockedExec.mockReturnValue('');
    sendCommand('test-agent', 'npm test');
    expect(mockedExec).toHaveBeenCalledWith(
      'tmux send-keys -t "claude-agent-test-agent" "npm test" Enter',
      { encoding: 'utf-8' },
    );
  });
});

describe('listSessions', () => {
  it('lists agent sessions filtering by prefix', () => {
    mockedExec.mockReturnValue(
      'claude-agent-builder|1|1712700000\nclaude-agent-reviewer|2|1712700100\nother-session|1|1712700200\n',
    );
    const sessions = listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].agentName).toBe('builder');
    expect(sessions[0].windows).toBe(1);
    expect(sessions[1].agentName).toBe('reviewer');
    expect(sessions[1].windows).toBe(2);
  });

  it('returns empty array when tmux not running', () => {
    mockedExec.mockImplementation(() => { throw new Error('no server'); });
    expect(listSessions()).toEqual([]);
  });

  it('returns empty array when no agent sessions exist', () => {
    mockedExec.mockReturnValue('other-session|1|1712700000\n');
    expect(listSessions()).toEqual([]);
  });
});
