import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getAgentLogDir } from './paths.js';
import type { DigestResult } from '../types.js';

interface ParsedLog {
  readonly episode: number;
  readonly durationMs: number;
  readonly exitCode: number;
  readonly success: boolean;
  readonly timedOut: boolean;
}

const LOG_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.log$/;

export function parseLogFile(content: string): ParsedLog | null {
  const episodeMatch = content.match(/^=== Episode (\d+) ===/m);
  const durationMatch = content.match(/^Duration: (\d+)ms$/m);
  const exitCodeMatch = content.match(/^Exit Code: (.+)$/m);
  const successMatch = content.match(/^Success: (true|false)$/m);
  const timedOutMatch = content.match(/^Timed Out: (true|false)$/m);

  if (!episodeMatch || !durationMatch || !successMatch) {
    return null;
  }

  const exitCodeRaw = exitCodeMatch?.[1] ?? 'null';
  const exitCode = exitCodeRaw === 'null' ? -1 : Number(exitCodeRaw);

  return {
    episode: Number(episodeMatch[1]),
    durationMs: Number(durationMatch[1]),
    exitCode,
    success: successMatch[1] === 'true',
    timedOut: timedOutMatch?.[1] === 'true',
  };
}

function filenameToTimestamp(filename: string): string {
  // 2026-04-09T10-00-00.log → 2026-04-09T10:00:00.000Z
  const stem = filename.replace('.log', '');
  const parts = stem.split('T');
  if (parts.length !== 2) return '';
  const timePart = parts[1].replace(/-/g, ':');
  return `${parts[0]}T${timePart}.000Z`;
}

export function generateDigest(
  agentName: string,
  baseDir?: string,
  since?: string,
): DigestResult {
  const logDir = getAgentLogDir(agentName, baseDir);

  let logFiles: string[];
  try {
    logFiles = readdirSync(logDir)
      .filter((f) => LOG_TIMESTAMP_PATTERN.test(f))
      .sort();
  } catch {
    return emptyDigest(agentName);
  }

  if (logFiles.length === 0) {
    return emptyDigest(agentName);
  }

  // Filter by since
  const sinceDate = since ? new Date(since) : null;
  const filteredFiles = sinceDate
    ? logFiles.filter((f) => {
        const ts = filenameToTimestamp(f);
        return ts !== '' && new Date(ts) >= sinceDate;
      })
    : logFiles;

  if (filteredFiles.length === 0) {
    return emptyDigest(agentName);
  }

  const parsed = readAndParseLogs(logDir, filteredFiles);

  if (parsed.length === 0) {
    return emptyDigest(agentName);
  }

  return buildDigestFromParsed(agentName, parsed, filteredFiles);
}

function readAndParseLogs(logDir: string, files: string[]): ParsedLog[] {
  const parsed: ParsedLog[] = [];
  for (const file of files) {
    try {
      const content = readFileSync(join(logDir, file), 'utf-8');
      const log = parseLogFile(content);
      if (log) parsed.push(log);
    } catch {
      // File may have been deleted between listing and reading — skip
    }
  }
  return parsed;
}

function buildDigestFromParsed(
  agentName: string,
  parsed: ReadonlyArray<ParsedLog>,
  files: ReadonlyArray<string>,
): DigestResult {
  const successCount = parsed.filter((l) => l.success).length;
  const errorCount = parsed.filter((l) => !l.success).length;
  const totalDuration = parsed.reduce((sum, l) => sum + l.durationMs, 0);
  const lastEpisode = Math.max(...parsed.map((l) => l.episode));

  const firstTs = filenameToTimestamp(files[0]);
  const lastTs = filenameToTimestamp(files[files.length - 1]);

  return {
    agentName,
    period: {
      from: firstTs || new Date().toISOString(),
      to: lastTs || new Date().toISOString(),
    },
    totalEpisodes: parsed.length,
    successCount,
    errorCount,
    avgDurationMs: totalDuration / parsed.length,
    lastEpisode,
  };
}

function emptyDigest(agentName: string): DigestResult {
  const now = new Date().toISOString();
  return {
    agentName,
    period: { from: now, to: now },
    totalEpisodes: 0,
    successCount: 0,
    errorCount: 0,
    avgDurationMs: 0,
    lastEpisode: 0,
  };
}
