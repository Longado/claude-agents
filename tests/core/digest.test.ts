import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateDigest, parseLogFile } from '../../src/core/digest.js';

function writeLog(logDir: string, filename: string, content: string): void {
  writeFileSync(join(logDir, filename), content);
}

function makeLogContent(opts: {
  episode: number;
  duration: number;
  exitCode: number;
  success: boolean;
  timedOut?: boolean;
  stdout?: string;
}): string {
  return [
    `=== Episode ${opts.episode} ===`,
    `Time: 2026-04-09T10:00:00.000Z`,
    `Duration: ${opts.duration}ms`,
    `Exit Code: ${opts.exitCode}`,
    `Timed Out: ${opts.timedOut ?? false}`,
    `Success: ${opts.success}`,
    '',
    '=== STDOUT ===',
    opts.stdout ?? '',
    '',
    '=== STDERR ===',
    '',
  ].join('\n');
}

describe('parseLogFile', () => {
  it('parses a valid log file', () => {
    const content = makeLogContent({
      episode: 3,
      duration: 5000,
      exitCode: 0,
      success: true,
      stdout: 'Agent did something',
    });

    const parsed = parseLogFile(content);
    expect(parsed).toEqual({
      episode: 3,
      durationMs: 5000,
      exitCode: 0,
      success: true,
      timedOut: false,
    });
  });

  it('parses a failed log file', () => {
    const content = makeLogContent({
      episode: 5,
      duration: 60000,
      exitCode: 1,
      success: false,
      timedOut: true,
    });

    const parsed = parseLogFile(content);
    expect(parsed).toEqual({
      episode: 5,
      durationMs: 60000,
      exitCode: 1,
      success: false,
      timedOut: true,
    });
  });

  it('returns null for malformed content', () => {
    expect(parseLogFile('')).toBeNull();
    expect(parseLogFile('garbage data')).toBeNull();
  });
});

describe('generateDigest', () => {
  let baseDir: string;
  let logDir: string;

  beforeEach(() => {
    baseDir = join(tmpdir(), `digest-test-${Date.now()}`);
    logDir = join(baseDir, 'agents', 'test-agent', 'logs');
    mkdirSync(logDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('generates digest from multiple log files', () => {
    writeLog(logDir, '2026-04-09T10-00-00.log', makeLogContent({
      episode: 1, duration: 3000, exitCode: 0, success: true,
    }));
    writeLog(logDir, '2026-04-09T11-00-00.log', makeLogContent({
      episode: 2, duration: 5000, exitCode: 0, success: true,
    }));
    writeLog(logDir, '2026-04-09T12-00-00.log', makeLogContent({
      episode: 3, duration: 60000, exitCode: 1, success: false,
    }));

    const digest = generateDigest('test-agent', baseDir);

    expect(digest.agentName).toBe('test-agent');
    expect(digest.totalEpisodes).toBe(3);
    expect(digest.successCount).toBe(2);
    expect(digest.errorCount).toBe(1);
    expect(digest.avgDurationMs).toBeCloseTo((3000 + 5000 + 60000) / 3);
    expect(digest.lastEpisode).toBe(3);
  });

  it('returns empty digest when no logs exist', () => {
    const digest = generateDigest('test-agent', baseDir);

    expect(digest.totalEpisodes).toBe(0);
    expect(digest.successCount).toBe(0);
    expect(digest.errorCount).toBe(0);
    expect(digest.avgDurationMs).toBe(0);
    expect(digest.lastEpisode).toBe(0);
  });

  it('filters logs by since parameter', () => {
    // Old log
    writeLog(logDir, '2026-04-08T10-00-00.log', makeLogContent({
      episode: 1, duration: 3000, exitCode: 0, success: true,
    }));
    // Recent log
    writeLog(logDir, '2026-04-09T10-00-00.log', makeLogContent({
      episode: 2, duration: 5000, exitCode: 0, success: true,
    }));

    // Filter: only logs from April 9
    const since = '2026-04-09T00:00:00.000Z';
    const digest = generateDigest('test-agent', baseDir, since);

    expect(digest.totalEpisodes).toBe(1);
    expect(digest.lastEpisode).toBe(2);
  });

  it('skips non-log files and symlinks', () => {
    writeLog(logDir, '2026-04-09T10-00-00.log', makeLogContent({
      episode: 1, duration: 3000, exitCode: 0, success: true,
    }));
    writeLog(logDir, 'latest.log', 'symlink target content');
    writeLog(logDir, 'notes.txt', 'not a log');

    const digest = generateDigest('test-agent', baseDir);

    // Should only count the timestamped .log file
    expect(digest.totalEpisodes).toBe(1);
  });

  it('handles logs directory that does not exist', () => {
    rmSync(logDir, { recursive: true, force: true });

    const digest = generateDigest('no-agent', baseDir);
    expect(digest.totalEpisodes).toBe(0);
  });
});
