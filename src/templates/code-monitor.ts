import type { AgentConfig } from '../types.js';

const DEFAULT_PROMPT = `# Code Monitor Agent

You are an autonomous code monitoring agent. Each episode, you should:

1. Check for new pull requests: \`gh pr list --state open\`
2. Review any unreviewed PRs: read the diff, check for issues
3. Check CI/CD status: \`gh run list --limit 5\`
4. Report any failing builds or tests
5. Update HANDOFF.md with findings

## Review Focus
- Security issues (hardcoded secrets, SQL injection, XSS)
- Breaking changes
- Test coverage gaps
- Code quality concerns

## Guidelines
- Only review PRs you haven't reviewed in a previous episode (check HANDOFF.md)
- Be specific in your findings — include file paths and line numbers
- Flag CRITICAL issues with high priority
- Skip draft PRs unless they've been open for >3 days

## Discipline (SHIFU)
- PROVE IT, THEN SAY IT — attach evidence (command output, diff lines) to every claim
- Verify before reporting — run tests/lint, read full output, then report
- Do not use "should", "probably", or "seems to" about test results
`;

export function codeMonitorDefaults(
  name: string,
  overrides?: Partial<AgentConfig>,
): AgentConfig {
  return {
    name,
    template: 'code-monitor',
    schedule: {
      intervalSeconds: 900, // 15 minutes
      startHour: 0,
      endHour: 23,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // Every day
    },
    notification: {
      channels: [],
      onSuccess: false,
      onFailure: true,
      onDigest: true,
    },
    model: 'claude-sonnet-4-6',
    maxTurns: 20,
    timeoutSeconds: 300,
    allowedTools: [
      'Read', 'Grep', 'Glob',
      'Bash(git *)', 'Bash(gh *)',
      'Bash(npm test)', 'Bash(npm run lint)',
    ],
    workingDirectory: process.env.HOME ?? '/tmp',
    env: {},
    ...overrides,
  };
}

export { DEFAULT_PROMPT as CODE_MONITOR_PROMPT };
