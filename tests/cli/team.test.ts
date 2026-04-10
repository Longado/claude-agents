import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { addTask, readQueue, claimTask, updateTask, completeReview } from '../../src/core/shared.js';

describe('team workflow integration', () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = join(tmpdir(), `team-test-${Date.now()}`);
    mkdirSync(join(baseDir, 'shared'), { recursive: true });
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('full builder → reviewer cycle via queue', () => {
    // 1. Add task
    const task = addTask('Build hello.py', baseDir);
    expect(task.status).toBe('queued');

    // 2. Builder claims
    const claimed = claimTask('builder', baseDir);
    expect(claimed!.status).toBe('building');
    expect(claimed!.assignee).toBe('builder');

    // 3. Builder completes → needs_review
    const built = updateTask(task.id, { status: 'needs_review' }, baseDir);
    expect(built!.status).toBe('needs_review');

    // 4. Reviewer reviews → done
    const reviewed = completeReview(task.id, true, 'Clean code, tests pass', baseDir);
    expect(reviewed!.status).toBe('done');
    expect(reviewed!.feedback).toBe('Clean code, tests pass');

    // 5. Queue has one done task
    const queue = readQueue(baseDir);
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe('done');
  });

  it('builder → reviewer → needs_fix → builder cycle', () => {
    const task = addTask('Implement auth', baseDir);

    // Builder builds
    claimTask('builder', baseDir);
    updateTask(task.id, { status: 'needs_review' }, baseDir);

    // Reviewer rejects
    completeReview(task.id, false, 'No input validation', baseDir);

    // Builder picks up needs_fix
    const reclaimed = claimTask('builder', baseDir);
    expect(reclaimed!.status).toBe('building');
    expect(reclaimed!.task).toBe('Implement auth');

    // Builder fixes → back to review
    updateTask(task.id, { status: 'needs_review' }, baseDir);

    // Reviewer approves
    const final = completeReview(task.id, true, 'Fixed, LGTM', baseDir);
    expect(final!.status).toBe('done');
  });
});
