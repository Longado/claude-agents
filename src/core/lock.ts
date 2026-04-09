import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { hostname } from 'node:os';
import { getAgentLock } from './paths.js';
import type { LockInfo } from '../types.js';

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function parseLockFile(path: string): LockInfo | null {
  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as LockInfo;
  } catch {
    return null;
  }
}

function createLockInfo(): LockInfo {
  return {
    pid: process.pid,
    startedAt: new Date().toISOString(),
    hostname: hostname(),
  };
}

export function acquireLock(agentName: string, baseDir?: string): LockInfo | null {
  const lockPath = getAgentLock(agentName, baseDir);
  const lockInfo = createLockInfo();
  const content = JSON.stringify(lockInfo, null, 2);

  try {
    writeFileSync(lockPath, content, { flag: 'wx' });
    return lockInfo;
  } catch {
    // Lock file exists — check staleness
    const existing = parseLockFile(lockPath);
    if (existing && !isProcessAlive(existing.pid)) {
      // Stale lock — remove and retry once
      try {
        unlinkSync(lockPath);
        writeFileSync(lockPath, content, { flag: 'wx' });
        return lockInfo;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function releaseLock(agentName: string, baseDir?: string): boolean {
  const lockPath = getAgentLock(agentName, baseDir);
  const existing = parseLockFile(lockPath);

  if (existing && existing.pid === process.pid) {
    try {
      unlinkSync(lockPath);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function readLock(agentName: string, baseDir?: string): LockInfo | null {
  const lockPath = getAgentLock(agentName, baseDir);
  return parseLockFile(lockPath);
}

export function isLockStale(lock: LockInfo): boolean {
  return !isProcessAlive(lock.pid);
}

export function isLocked(agentName: string, baseDir?: string): boolean {
  const lockPath = getAgentLock(agentName, baseDir);
  if (!existsSync(lockPath)) return false;
  const lock = parseLockFile(lockPath);
  if (!lock) return false;
  return isProcessAlive(lock.pid);
}
