import {
  writeFileSync, mkdirSync, unlinkSync, existsSync,
  symlinkSync, readFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { execSync } from 'node:child_process';
import {
  getPlistPath, getPlistDir, getLaunchAgentDir,
  getLaunchAgentSymlink,
} from './paths.js';
import type { AgentConfig, PlistConfig } from '../types.js';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function resolveNodePath(): string {
  try {
    return execSync('which node', { encoding: 'utf-8' }).trim();
  } catch {
    return '/opt/homebrew/bin/node';
  }
}

function resolveAgentsBinPath(): string {
  // Resolve the installed CLI path
  try {
    return execSync('which agents', { encoding: 'utf-8' }).trim();
  } catch {
    // Fallback: use the local dist path
    const { join } = require('node:path');
    return join(__dirname, '..', '..', 'bin', 'agents.js');
  }
}

export function buildPlistConfig(config: AgentConfig): PlistConfig {
  const label = `com.claude-agents.${config.name}`;
  const nodePath = resolveNodePath();
  const agentsBin = resolveAgentsBinPath();
  const currentPath = process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin';

  return {
    label,
    programArguments: [nodePath, agentsBin, 'run', '--name', config.name],
    startInterval: config.schedule.intervalSeconds,
    environmentVariables: {
      PATH: currentPath,
      HOME: process.env.HOME ?? '',
      TERM: 'dumb',
      ...config.env,
    },
    standardOutPath: `/tmp/claude-agents-${config.name}.out`,
    standardErrorPath: `/tmp/claude-agents-${config.name}.err`,
    workingDirectory: config.workingDirectory,
  };
}

export function generatePlistXml(plist: PlistConfig): string {
  const envEntries = Object.entries(plist.environmentVariables)
    .map(([k, v]) => `      <key>${escapeXml(k)}</key>\n      <string>${escapeXml(v)}</string>`)
    .join('\n');

  const argEntries = plist.programArguments
    .map((a) => `      <string>${escapeXml(a)}</string>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${escapeXml(plist.label)}</string>

    <key>ProgramArguments</key>
    <array>
${argEntries}
    </array>

    <key>StartInterval</key>
    <integer>${plist.startInterval}</integer>

    <key>EnvironmentVariables</key>
    <dict>
${envEntries}
    </dict>

    <key>StandardOutPath</key>
    <string>${escapeXml(plist.standardOutPath)}</string>

    <key>StandardErrorPath</key>
    <string>${escapeXml(plist.standardErrorPath)}</string>

    <key>WorkingDirectory</key>
    <string>${escapeXml(plist.workingDirectory)}</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <false/>

    <key>Nice</key>
    <integer>5</integer>

    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>
`;
}

export function installAgent(config: AgentConfig, baseDir?: string): string {
  const plistConfig = buildPlistConfig(config);
  const xml = generatePlistXml(plistConfig);

  // Write plist file
  const plistPath = getPlistPath(config.name, baseDir);
  mkdirSync(dirname(plistPath), { recursive: true });
  writeFileSync(plistPath, xml);

  // Symlink to ~/Library/LaunchAgents/
  const symlinkPath = getLaunchAgentSymlink(config.name);
  mkdirSync(getLaunchAgentDir(), { recursive: true });
  try { unlinkSync(symlinkPath); } catch { /* ignore */ }
  symlinkSync(plistPath, symlinkPath);

  // Load with launchctl
  try {
    execSync(`launchctl load "${symlinkPath}"`, { encoding: 'utf-8' });
  } catch (err) {
    throw new Error(`Failed to load plist: ${err}`);
  }

  return plistPath;
}

export function uninstallAgent(name: string, baseDir?: string): void {
  const symlinkPath = getLaunchAgentSymlink(name);

  // Unload from launchctl
  try {
    execSync(`launchctl unload "${symlinkPath}"`, { encoding: 'utf-8' });
  } catch { /* may not be loaded */ }

  // Remove symlink
  try { unlinkSync(symlinkPath); } catch { /* ignore */ }

  // Remove plist
  const plistPath = getPlistPath(name, baseDir);
  try { unlinkSync(plistPath); } catch { /* ignore */ }
}

export function isAgentLoaded(name: string): boolean {
  const label = `com.claude-agents.${name}`;
  try {
    const output = execSync('launchctl list', { encoding: 'utf-8' });
    return output.includes(label);
  } catch {
    return false;
  }
}
