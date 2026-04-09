import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, symlinkSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getAgentLogDir } from './paths.js';
import { acquireLock, releaseLock } from './lock.js';
import { readState, writeState, transitionState } from './state.js';
import { readHandoff, buildHandoffInstructions } from './handoff.js';
import type { AgentConfig, ExecutionResult } from '../types.js';

function buildClaudeEnv(config: AgentConfig): Record<string, string> {
  const env: Record<string, string> = {};
  // Copy current env
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v;
  }
  // Apply agent-specific env
  for (const [k, v] of Object.entries(config.env)) {
    env[k] = v;
  }
  // Critical: remove CLAUDECODE to prevent IPC connection to parent
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_SESSION;
  // Prevent ANSI escape codes in logs
  env.TERM = 'dumb';
  return env;
}

function buildClaudeArgs(config: AgentConfig, prompt: string): ReadonlyArray<string> {
  const args: string[] = [
    '--print',
    '--model', config.model,
    '--max-turns', String(config.maxTurns),
  ];

  if (config.allowedTools.length > 0) {
    args.push('--allowedTools', config.allowedTools.join(','));
  }

  args.push('-p', prompt);
  return args;
}

function formatTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export async function executeAgent(
  config: AgentConfig,
  baseDir?: string,
): Promise<ExecutionResult> {
  const startTime = Date.now();

  // 1. Acquire lock
  const lock = acquireLock(config.name, baseDir);
  if (!lock) {
    return {
      success: false,
      episode: 0,
      durationMs: 0,
      stdout: '',
      stderr: 'Failed to acquire lock — another instance may be running',
      exitCode: null,
      timedOut: false,
    };
  }

  try {
    // 2. Read state and transition to running
    const prevState = readState(config.name, baseDir);
    const nextEpisode = prevState.currentEpisode + 1;
    const runningState = transitionState(prevState, {
      status: 'running',
      currentEpisode: nextEpisode,
      lastRunAt: new Date().toISOString(),
    });
    writeState(config.name, runningState, baseDir);

    // 3. Build prompt with handoff context
    const handoffInstructions = buildHandoffInstructions(config.name, baseDir);
    const promptPath = join(
      baseDir ?? `${process.env.HOME}/.claude-agents`,
      'agents', config.name, 'prompt.md',
    );
    let basePrompt: string;
    try {
      const { readFileSync } = await import('node:fs');
      basePrompt = readFileSync(promptPath, 'utf-8');
    } catch {
      basePrompt = 'No prompt template found.';
    }

    const fullPrompt = `Episode ${nextEpisode}\n\n${basePrompt}\n\n${handoffInstructions}`;

    // 4. Prepare log file
    const logDir = getAgentLogDir(config.name, baseDir);
    mkdirSync(logDir, { recursive: true });
    const logFile = join(logDir, `${formatTimestamp()}.log`);
    const latestLink = join(logDir, 'latest.log');

    // 5. Spawn claude process
    const env = buildClaudeEnv(config);
    const args = buildClaudeArgs(config, fullPrompt);

    const result = await new Promise<ExecutionResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let killed = false;

      const child = spawn('claude', args as string[], {
        env,
        cwd: config.workingDirectory,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      // Timeout watchdog
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        // Grace period: SIGKILL after 5s
        setTimeout(() => {
          if (!killed) child.kill('SIGKILL');
        }, 5000);
      }, config.timeoutSeconds * 1000);

      child.on('close', (code) => {
        killed = true;
        clearTimeout(timeout);
        resolve({
          success: code === 0 && !timedOut,
          episode: nextEpisode,
          durationMs: Date.now() - startTime,
          stdout,
          stderr,
          exitCode: code,
          timedOut,
        });
      });

      child.on('error', (err) => {
        killed = true;
        clearTimeout(timeout);
        resolve({
          success: false,
          episode: nextEpisode,
          durationMs: Date.now() - startTime,
          stdout,
          stderr: `Spawn error: ${err.message}`,
          exitCode: null,
          timedOut: false,
        });
      });
    });

    // 6. Write log
    const logContent = [
      `=== Episode ${nextEpisode} ===`,
      `Time: ${new Date().toISOString()}`,
      `Duration: ${result.durationMs}ms`,
      `Exit Code: ${result.exitCode}`,
      `Timed Out: ${result.timedOut}`,
      `Success: ${result.success}`,
      '',
      '=== STDOUT ===',
      result.stdout,
      '',
      '=== STDERR ===',
      result.stderr,
    ].join('\n');

    writeFileSync(logFile, logContent);

    // Update latest.log symlink
    try { unlinkSync(latestLink); } catch { /* ignore */ }
    try { symlinkSync(logFile, latestLink); } catch { /* ignore */ }

    // 7. Update state
    const finalState = result.success
      ? transitionState(runningState, {
          status: 'idle',
          totalRuns: prevState.totalRuns + 1,
        })
      : transitionState(runningState, {
          status: 'error',
          totalRuns: prevState.totalRuns + 1,
          totalErrors: prevState.totalErrors + 1,
          lastErrorAt: new Date().toISOString(),
          lastErrorMessage: result.timedOut
            ? `Timed out after ${config.timeoutSeconds}s`
            : (result.stderr.slice(0, 500) || `Exit code: ${result.exitCode}`),
        });

    writeState(config.name, finalState, baseDir);

    return result;
  } finally {
    // 8. Always release lock
    releaseLock(config.name, baseDir);
  }
}
