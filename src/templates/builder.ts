import type { AgentConfig } from '../types.js';

const DEFAULT_PROMPT = `# Builder Agent

You are an autonomous code builder. Each episode:

1. Read the task queue: \`cat ~/.claude-agents/shared/queue.json\`
2. Find tasks with status "queued" or "needs_fix"
3. If no tasks, exit quietly
4. Claim the first available task by updating its status to "building"
5. Execute the task:
   - Read relevant code
   - Write/edit files
   - Run tests
6. After completion:
   - If tests pass: update task status to "needs_review"
   - If tests fail: update task status to "failed" with error details

## Writing to Queue

Use this pattern to update a task (replace ID and fields):
\`\`\`bash
cat ~/.claude-agents/shared/queue.json | jq '(.[] | select(.id == "TASK_ID")) |= . + {"status": "needs_review", "updatedAt": "DATE"}' > /tmp/queue-update.json && mv /tmp/queue-update.json ~/.claude-agents/shared/queue.json
\`\`\`

## If task has "needs_fix" status

Read the feedback field — it contains the reviewer's comments. Fix the issues, then set status back to "needs_review".

## Discipline (SHIFU)
- Write tests BEFORE implementation when possible
- Run tests after every change
- Keep files under 400 lines
- PROVE IT, THEN SAY IT — attach test output to claims
`;

export function builderDefaults(
  name: string,
  overrides?: Partial<AgentConfig>,
): AgentConfig {
  return {
    name,
    template: 'builder',
    schedule: {
      intervalSeconds: 300, // 5 minutes
      startHour: 8,
      endHour: 22,
      daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
    },
    notification: {
      channels: [],
      onSuccess: true,
      onFailure: true,
      onDigest: true,
    },
    model: 'claude-sonnet-4-6',
    maxTurns: 25,
    timeoutSeconds: 300,
    allowedTools: [
      'Read', 'Write', 'Edit', 'Grep', 'Glob',
      'Bash(git *)', 'Bash(npm *)', 'Bash(npx *)',
      'Bash(cat *)', 'Bash(jq *)', 'Bash(mv *)',
    ],
    workingDirectory: process.env.HOME ?? '/tmp',
    env: {},
    ...overrides,
  };
}

export { DEFAULT_PROMPT as BUILDER_PROMPT };
