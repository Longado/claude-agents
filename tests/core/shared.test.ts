import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readQueue, writeQueue, addTask, updateTask, findTasksByStatus, claimTask, completeReview } from '../../src/core/shared.js';
import type { QueueItem } from '../../src/core/shared.js';

describe('shared queue', () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = join(tmpdir(), `shared-test-${Date.now()}`);
    mkdirSync(join(baseDir, 'shared'), { recursive: true });
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('returns empty array when no queue file exists', () => {
    expect(readQueue(baseDir)).toEqual([]);
  });

  it('writes and reads queue items', () => {
    const items: QueueItem[] = [{
      id: 'task-1',
      task: 'Build hello.py',
      status: 'queued',
      assignee: null,
      feedback: null,
      createdAt: '2026-04-10T00:00:00.000Z',
      updatedAt: '2026-04-10T00:00:00.000Z',
    }];

    writeQueue(items, baseDir);
    const result = readQueue(baseDir);

    expect(result).toHaveLength(1);
    expect(result[0].task).toBe('Build hello.py');
    expect(result[0].status).toBe('queued');
  });

  it('adds a task to the queue', () => {
    const item = addTask('Write unit tests', baseDir);

    expect(item.task).toBe('Write unit tests');
    expect(item.status).toBe('queued');
    expect(item.assignee).toBeNull();
    expect(item.id).toMatch(/^task-\d+-[a-z0-9]+$/);

    const queue = readQueue(baseDir);
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe(item.id);
  });

  it('adds multiple tasks', () => {
    addTask('Task A', baseDir);
    addTask('Task B', baseDir);
    addTask('Task C', baseDir);

    const queue = readQueue(baseDir);
    expect(queue).toHaveLength(3);
  });

  it('updates task status', () => {
    const item = addTask('Fix bug', baseDir);

    const updated = updateTask(item.id, { status: 'building', assignee: 'builder' }, baseDir);

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('building');
    expect(updated!.assignee).toBe('builder');
    expect(updated!.task).toBe('Fix bug'); // unchanged
  });

  it('updates task feedback', () => {
    const item = addTask('Implement feature', baseDir);
    updateTask(item.id, { status: 'needs_review' }, baseDir);

    const reviewed = updateTask(item.id, {
      status: 'needs_fix',
      feedback: 'Missing error handling in line 42',
    }, baseDir);

    expect(reviewed!.status).toBe('needs_fix');
    expect(reviewed!.feedback).toBe('Missing error handling in line 42');
  });

  it('returns null when updating non-existent task', () => {
    const result = updateTask('non-existent', { status: 'done' }, baseDir);
    expect(result).toBeNull();
  });

  it('finds tasks by status', () => {
    const item1 = addTask('Task 1', baseDir);
    addTask('Task 2', baseDir);
    updateTask(item1.id, { status: 'building' }, baseDir);

    const queued = findTasksByStatus('queued', baseDir);
    expect(queued).toHaveLength(1);

    const building = findTasksByStatus('building', baseDir);
    expect(building).toHaveLength(1);
    expect(building[0].task).toBe('Task 1');
  });

  it('claims first queued task', () => {
    addTask('Task A', baseDir);
    addTask('Task B', baseDir);

    const claimed = claimTask('builder', baseDir);
    expect(claimed).not.toBeNull();
    expect(claimed!.task).toBe('Task A');
    expect(claimed!.status).toBe('building');
    expect(claimed!.assignee).toBe('builder');

    // Second claim gets Task B
    const claimed2 = claimTask('builder', baseDir);
    expect(claimed2!.task).toBe('Task B');
  });

  it('claims needs_fix tasks when no queued tasks', () => {
    const item = addTask('Buggy code', baseDir);
    updateTask(item.id, { status: 'needs_fix', feedback: 'Missing tests' }, baseDir);

    const claimed = claimTask('builder', baseDir);
    expect(claimed!.task).toBe('Buggy code');
    expect(claimed!.status).toBe('building');
  });

  it('returns null when nothing to claim', () => {
    expect(claimTask('builder', baseDir)).toBeNull();
  });

  it('completes review with approval', () => {
    const item = addTask('Feature X', baseDir);
    updateTask(item.id, { status: 'needs_review' }, baseDir);

    const reviewed = completeReview(item.id, true, 'LGTM', baseDir);
    expect(reviewed!.status).toBe('done');
    expect(reviewed!.feedback).toBe('LGTM');
  });

  it('completes review with rejection', () => {
    const item = addTask('Feature Y', baseDir);
    updateTask(item.id, { status: 'needs_review' }, baseDir);

    const reviewed = completeReview(item.id, false, 'Missing error handling', baseDir);
    expect(reviewed!.status).toBe('needs_fix');
    expect(reviewed!.feedback).toBe('Missing error handling');
  });

  it('preserves other items when updating one', () => {
    const a = addTask('Task A', baseDir);
    addTask('Task B', baseDir);
    addTask('Task C', baseDir);

    updateTask(a.id, { status: 'done' }, baseDir);

    const queue = readQueue(baseDir);
    expect(queue).toHaveLength(3);
    expect(queue.find(i => i.id === a.id)!.status).toBe('done');
    expect(queue.filter(i => i.status === 'queued')).toHaveLength(2);
  });
});
