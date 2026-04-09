import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getAgentState } from './paths.js';
import { AgentStateSchema, type AgentState } from '../types.js';

export function createInitialState(name: string): AgentState {
  return {
    name,
    status: 'idle',
    currentEpisode: 0,
    totalRuns: 0,
    totalErrors: 0,
    lastRunAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
  };
}

export function readState(agentName: string, baseDir?: string): AgentState {
  const path = getAgentState(agentName, baseDir);
  try {
    const content = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(content);
    return AgentStateSchema.parse(parsed);
  } catch {
    return createInitialState(agentName);
  }
}

export function writeState(agentName: string, state: AgentState, baseDir?: string): void {
  const path = getAgentState(agentName, baseDir);
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });

  // Atomic write: write to tmp, then rename
  const tmpPath = join(dir, `.STATE.json.${process.pid}.tmp`);
  writeFileSync(tmpPath, JSON.stringify(state, null, 2));
  renameSync(tmpPath, path);
}

export function transitionState(
  prev: AgentState,
  update: Partial<AgentState>,
): AgentState {
  return { ...prev, ...update };
}
