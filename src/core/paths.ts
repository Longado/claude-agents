import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_BASE = join(homedir(), '.claude-agents');

export function getAgentsRoot(baseDir = DEFAULT_BASE): string {
  return baseDir;
}

export function getAgentDir(name: string, baseDir = DEFAULT_BASE): string {
  return join(baseDir, 'agents', name);
}

export function getAgentConfig(name: string, baseDir = DEFAULT_BASE): string {
  return join(getAgentDir(name, baseDir), 'config.json');
}

export function getAgentState(name: string, baseDir = DEFAULT_BASE): string {
  return join(getAgentDir(name, baseDir), 'STATE.json');
}

export function getAgentHandoff(name: string, baseDir = DEFAULT_BASE): string {
  return join(getAgentDir(name, baseDir), 'HANDOFF.md');
}

export function getAgentPrompt(name: string, baseDir = DEFAULT_BASE): string {
  return join(getAgentDir(name, baseDir), 'prompt.md');
}

export function getAgentLock(name: string, baseDir = DEFAULT_BASE): string {
  return join(getAgentDir(name, baseDir), '.lock');
}

export function getAgentLogDir(name: string, baseDir = DEFAULT_BASE): string {
  return join(getAgentDir(name, baseDir), 'logs');
}

export function getPlistDir(baseDir = DEFAULT_BASE): string {
  return join(baseDir, 'plists');
}

export function getPlistPath(name: string, baseDir = DEFAULT_BASE): string {
  return join(getPlistDir(baseDir), `com.claude-agents.${name}.plist`);
}

export function getLaunchAgentDir(): string {
  return join(homedir(), 'Library', 'LaunchAgents');
}

export function getLaunchAgentSymlink(name: string): string {
  return join(getLaunchAgentDir(), `com.claude-agents.${name}.plist`);
}

export function getGlobalConfig(baseDir = DEFAULT_BASE): string {
  return join(baseDir, 'config.json');
}
