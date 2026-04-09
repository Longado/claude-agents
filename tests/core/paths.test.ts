import { describe, it, expect } from 'vitest';
import {
  getAgentsRoot,
  getAgentDir,
  getAgentConfig,
  getAgentState,
  getAgentHandoff,
  getAgentPrompt,
  getAgentLock,
  getAgentLogDir,
  getPlistDir,
  getPlistPath,
  getLaunchAgentSymlink,
  getGlobalConfig,
} from '../../src/core/paths.js';

const BASE = '/tmp/test-agents';

describe('paths', () => {
  it('returns agents root', () => {
    expect(getAgentsRoot(BASE)).toBe('/tmp/test-agents');
  });

  it('returns agent directory', () => {
    expect(getAgentDir('my-bot', BASE)).toBe('/tmp/test-agents/agents/my-bot');
  });

  it('returns agent config path', () => {
    expect(getAgentConfig('my-bot', BASE)).toBe('/tmp/test-agents/agents/my-bot/config.json');
  });

  it('returns agent state path', () => {
    expect(getAgentState('my-bot', BASE)).toBe('/tmp/test-agents/agents/my-bot/STATE.json');
  });

  it('returns agent handoff path', () => {
    expect(getAgentHandoff('my-bot', BASE)).toBe('/tmp/test-agents/agents/my-bot/HANDOFF.md');
  });

  it('returns agent prompt path', () => {
    expect(getAgentPrompt('my-bot', BASE)).toBe('/tmp/test-agents/agents/my-bot/prompt.md');
  });

  it('returns agent lock path', () => {
    expect(getAgentLock('my-bot', BASE)).toBe('/tmp/test-agents/agents/my-bot/.lock');
  });

  it('returns agent log directory', () => {
    expect(getAgentLogDir('my-bot', BASE)).toBe('/tmp/test-agents/agents/my-bot/logs');
  });

  it('returns plist directory', () => {
    expect(getPlistDir(BASE)).toBe('/tmp/test-agents/plists');
  });

  it('returns plist path with naming convention', () => {
    expect(getPlistPath('my-bot', BASE)).toBe('/tmp/test-agents/plists/com.claude-agents.my-bot.plist');
  });

  it('returns launch agent symlink in ~/Library/LaunchAgents', () => {
    const path = getLaunchAgentSymlink('my-bot');
    expect(path).toContain('Library/LaunchAgents/com.claude-agents.my-bot.plist');
  });

  it('returns global config path', () => {
    expect(getGlobalConfig(BASE)).toBe('/tmp/test-agents/config.json');
  });
});
