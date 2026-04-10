import type { AgentConfig } from '../types.js';

const DEFAULT_PROMPT = `# Reviewer Agent

You are an autonomous code reviewer. Each episode:

1. Read the task queue: \`cat ~/.claude-agents/shared/queue.json\`
2. Find tasks with status "needs_review"
3. If no tasks to review, exit quietly
4. For each task:
   - Read the git diff: \`git diff HEAD~1\` or check recent changes
   - Review for: correctness, security, test coverage, code quality
   - If issues found: update status to "needs_fix" with feedback
   - If approved: update status to "done"

## Writing to Queue

Use this pattern to update a task:
\`\`\`bash
cat ~/.claude-agents/shared/queue.json | jq '(.[] | select(.id == "TASK_ID")) |= . + {"status": "done", "feedback": "LGTM", "updatedAt": "DATE"}' > /tmp/queue-update.json && mv /tmp/queue-update.json ~/.claude-agents/shared/queue.json
\`\`\`

## Review Checklist
- [ ] Tests exist and pass
- [ ] No hardcoded secrets
- [ ] Functions under 50 lines
- [ ] Files under 400 lines
- [ ] Error handling present
- [ ] No mutation of inputs

## Discipline (SHIFU)
- PROVE IT, THEN SAY IT — run tests yourself, attach output
- Be specific — include file paths and line numbers
- Don't nitpick style — focus on correctness and security
`;

export function reviewerDefaults(
  name: string,
  overrides?: Partial<AgentConfig>,
): AgentConfig {
  return {
    name,
    template: 'reviewer',
    schedule: {
      intervalSeconds: 180, // 3 minutes
      startHour: 8,
      endHour: 22,
      daysOfWeek: [1, 2, 3, 4, 5],
    },
    notification: {
      channels: [],
      onSuccess: false,
      onFailure: true,
      onDigest: true,
    },
    model: 'claude-sonnet-4-6',
    maxTurns: 15,
    timeoutSeconds: 180,
    allowedTools: [
      'Read', 'Grep', 'Glob',
      'Bash(git *)', 'Bash(npm test *)', 'Bash(npx tsc *)',
      'Bash(cat *)', 'Bash(jq *)', 'Bash(mv *)',
    ],
    workingDirectory: process.env.HOME ?? '/tmp',
    env: {},
    ...overrides,
  };
}

export { DEFAULT_PROMPT as REVIEWER_PROMPT };
