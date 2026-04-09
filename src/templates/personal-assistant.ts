import type { AgentConfig } from '../types.js';

const DEFAULT_PROMPT = `# Personal Assistant Agent

You are an autonomous personal assistant. Each episode, you should:

1. Check for any new information or tasks that need attention
2. Summarize key updates concisely
3. Identify items that need the user's attention
4. Update HANDOFF.md with your findings

## Guidelines
- Be concise — focus on actionable items
- Prioritize by urgency
- Flag anything that needs immediate human attention
- Skip items that haven't changed since last episode
`;

export function personalAssistantDefaults(
  name: string,
  overrides?: Partial<AgentConfig>,
): AgentConfig {
  return {
    name,
    template: 'personal-assistant',
    schedule: {
      intervalSeconds: 1800, // 30 minutes
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
    maxTurns: 15,
    timeoutSeconds: 180,
    allowedTools: ['Read', 'Bash(git *)', 'Bash(gh *)', 'Grep', 'Glob'],
    workingDirectory: process.env.HOME ?? '/tmp',
    env: {},
    ...overrides,
  };
}

export { DEFAULT_PROMPT as PERSONAL_ASSISTANT_PROMPT };
