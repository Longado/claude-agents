import { execSync } from 'node:child_process';

const SESSION_PREFIX = 'claude-agent-';

function sessionName(agentName: string): string {
  return `${SESSION_PREFIX}${agentName}`;
}

export function isTmuxAvailable(): boolean {
  try {
    execSync('which tmux', { encoding: 'utf-8' });
    return true;
  } catch {
    return false;
  }
}

export function sessionExists(agentName: string): boolean {
  try {
    execSync(`tmux has-session -t "${sessionName(agentName)}" 2>/dev/null`, {
      encoding: 'utf-8',
    });
    return true;
  } catch {
    return false;
  }
}

export function createSession(agentName: string, cwd?: string): void {
  const name = sessionName(agentName);
  const cwdArg = cwd ? `-c "${cwd}"` : '';
  execSync(`tmux new-session -d -s "${name}" ${cwdArg} -x 200 -y 50`, {
    encoding: 'utf-8',
  });
}

export function attachSession(agentName: string): void {
  const name = sessionName(agentName);
  // This replaces the current process
  execSync(`tmux attach-session -t "${name}"`, {
    stdio: 'inherit',
  });
}

export function killSession(agentName: string): void {
  const name = sessionName(agentName);
  try {
    execSync(`tmux kill-session -t "${name}"`, { encoding: 'utf-8' });
  } catch { /* session may not exist */ }
}

export function captureOutput(agentName: string, lines = 100): string {
  const name = sessionName(agentName);
  try {
    return execSync(`tmux capture-pane -t "${name}" -p -S -${lines}`, {
      encoding: 'utf-8',
    });
  } catch {
    return '';
  }
}

export function sendCommand(agentName: string, command: string): void {
  const name = sessionName(agentName);
  execSync(`tmux send-keys -t "${name}" "${command}" Enter`, {
    encoding: 'utf-8',
  });
}

export interface TmuxSessionInfo {
  readonly name: string;
  readonly agentName: string;
  readonly windows: number;
  readonly created: string;
}

export function listSessions(): ReadonlyArray<TmuxSessionInfo> {
  try {
    const output = execSync(
      `tmux list-sessions -F "#{session_name}|#{session_windows}|#{session_created}" 2>/dev/null`,
      { encoding: 'utf-8' },
    );
    return output
      .trim()
      .split('\n')
      .filter((line) => line.startsWith(SESSION_PREFIX))
      .map((line) => {
        const [name, windows, created] = line.split('|');
        return {
          name,
          agentName: name.replace(SESSION_PREFIX, ''),
          windows: parseInt(windows, 10),
          created: new Date(parseInt(created, 10) * 1000).toISOString(),
        };
      });
  } catch {
    return [];
  }
}
