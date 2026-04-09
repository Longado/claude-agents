import { describe, it, expect } from 'vitest';
import { buildPlistConfig, generatePlistXml } from '../../src/core/launchd.js';
import type { AgentConfig, PlistConfig } from '../../src/types.js';

const MOCK_CONFIG: AgentConfig = {
  name: 'test-bot',
  template: 'custom',
  schedule: {
    intervalSeconds: 900,
    startHour: 8,
    endHour: 22,
    daysOfWeek: [1, 2, 3, 4, 5],
  },
  notification: {
    channels: [],
    onSuccess: false,
    onFailure: true,
    onDigest: false,
  },
  model: 'claude-sonnet-4-6',
  maxTurns: 10,
  timeoutSeconds: 120,
  allowedTools: ['Read', 'Grep'],
  workingDirectory: '/tmp/test',
  env: { MY_KEY: 'my-value' },
};

describe('launchd', () => {
  it('builds plist config with correct label', () => {
    const config = buildPlistConfig(MOCK_CONFIG);
    expect(config.label).toBe('com.claude-agents.test-bot');
  });

  it('includes run command in program arguments', () => {
    const config = buildPlistConfig(MOCK_CONFIG);
    expect(config.programArguments).toContain('run');
    expect(config.programArguments).toContain('--name');
    expect(config.programArguments).toContain('test-bot');
  });

  it('embeds custom env vars', () => {
    const config = buildPlistConfig(MOCK_CONFIG);
    expect(config.environmentVariables.MY_KEY).toBe('my-value');
    expect(config.environmentVariables.TERM).toBe('dumb');
  });

  it('generates valid plist XML', () => {
    const plist: PlistConfig = {
      label: 'com.claude-agents.test',
      programArguments: ['/usr/bin/node', '/path/to/agents.js', 'run', '--name', 'test'],
      startInterval: 600,
      environmentVariables: { PATH: '/usr/bin', HOME: '/Users/test' },
      standardOutPath: '/tmp/test.out',
      standardErrorPath: '/tmp/test.err',
      workingDirectory: '/tmp',
    };

    const xml = generatePlistXml(plist);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<string>com.claude-agents.test</string>');
    expect(xml).toContain('<integer>600</integer>');
    expect(xml).toContain('<string>/usr/bin/node</string>');
    expect(xml).toContain('<key>RunAtLoad</key>');
    expect(xml).toContain('<true/>');
    expect(xml).toContain('<key>Nice</key>');
  });

  it('escapes XML special characters', () => {
    const plist: PlistConfig = {
      label: 'com.test',
      programArguments: ['/path/with spaces & "quotes"'],
      startInterval: 60,
      environmentVariables: { VAR: 'value<with>special&chars' },
      standardOutPath: '/tmp/out',
      standardErrorPath: '/tmp/err',
      workingDirectory: '/tmp',
    };

    const xml = generatePlistXml(plist);
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;');
    expect(xml).toContain('&gt;');
    expect(xml).toContain('&quot;');
  });
});
