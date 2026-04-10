import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getAgentsRoot } from './paths.js';

export type QueueStatus = 'queued' | 'building' | 'needs_review' | 'needs_fix' | 'done' | 'failed';

export interface QueueItem {
  readonly id: string;
  readonly task: string;
  readonly status: QueueStatus;
  readonly assignee: string | null;
  readonly feedback: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

function getQueuePath(baseDir?: string): string {
  return join(getAgentsRoot(baseDir), 'shared', 'queue.json');
}

export function readQueue(baseDir?: string): ReadonlyArray<QueueItem> {
  const path = getQueuePath(baseDir);
  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as QueueItem[];
  } catch {
    return [];
  }
}

export function writeQueue(items: ReadonlyArray<QueueItem>, baseDir?: string): void {
  const path = getQueuePath(baseDir);
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });

  const tmpPath = join(dir, `.queue.json.${process.pid}.tmp`);
  writeFileSync(tmpPath, JSON.stringify(items, null, 2));
  renameSync(tmpPath, path);
}

export function addTask(task: string, baseDir?: string): QueueItem {
  const items = [...readQueue(baseDir)];
  const now = new Date().toISOString();
  const newItem: QueueItem = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    task,
    status: 'queued',
    assignee: null,
    feedback: null,
    createdAt: now,
    updatedAt: now,
  };
  items.push(newItem);
  writeQueue(items, baseDir);
  return newItem;
}

export function updateTask(
  id: string,
  update: Partial<Pick<QueueItem, 'status' | 'assignee' | 'feedback'>>,
  baseDir?: string,
): QueueItem | null {
  const items = readQueue(baseDir);
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const updated: QueueItem = {
    ...items[index],
    ...update,
    updatedAt: new Date().toISOString(),
  };
  const newItems = [...items.slice(0, index), updated, ...items.slice(index + 1)];
  writeQueue(newItems, baseDir);
  return updated;
}

export function findTasksByStatus(status: QueueStatus, baseDir?: string): ReadonlyArray<QueueItem> {
  return readQueue(baseDir).filter((item) => item.status === status);
}
