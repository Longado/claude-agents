import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getAgentHandoff } from './paths.js';

export function readHandoff(agentName: string, baseDir?: string): string {
  const path = getAgentHandoff(agentName, baseDir);
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return '';
  }
}

export function writeHandoff(agentName: string, content: string, baseDir?: string): void {
  const path = getAgentHandoff(agentName, baseDir);
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });

  const tmpPath = join(dir, `.HANDOFF.md.${process.pid}.tmp`);
  writeFileSync(tmpPath, content);
  renameSync(tmpPath, path);
}

export function buildHandoffInstructions(agentName: string, baseDir?: string): string {
  const existing = readHandoff(agentName, baseDir);
  const previousContext = existing
    ? `\n## Previous Episode Handoff\n\n${existing}`
    : '\n## Previous Episode Handoff\n\nThis is the first episode. No previous context.';

  return `${previousContext}

## IMPORTANT: Before finishing, you MUST update HANDOFF.md with:
1. What you accomplished in this episode
2. Key findings or decisions made
3. What the next episode should focus on
4. Any blockers or issues encountered
`;
}
