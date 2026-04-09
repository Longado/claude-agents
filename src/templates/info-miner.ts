import type { AgentConfig } from '../types.js';

const DEFAULT_PROMPT = `# Information Miner Agent

You are an autonomous information mining agent. Each episode, you should:

1. Fetch latest content from configured sources
2. Filter for relevance based on configured keywords
3. Summarize key findings
4. Write a digest in HANDOFF.md

## Sources
- Hacker News: Use \`curl -s "https://hacker-news.firebaseio.com/v0/topstories.json" | head -c 500\`
  then fetch individual story details
- Check for trending topics related to configured keywords

## Digest Format
For each interesting item:
- **Title**: [title]
- **Source**: [url]
- **Why it matters**: 1-2 sentence summary
- **Relevance**: HIGH / MEDIUM / LOW

## Guidelines
- Skip items already covered in previous episodes (check HANDOFF.md)
- Limit digest to top 10 most relevant items
- Focus on actionable insights, not just news
- Include source URLs for verification
`;

export function infoMinerDefaults(
  name: string,
  overrides?: Partial<AgentConfig>,
): AgentConfig {
  return {
    name,
    template: 'info-miner',
    schedule: {
      intervalSeconds: 7200, // 2 hours
      startHour: 8,
      endHour: 23,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    },
    notification: {
      channels: [],
      onSuccess: false,
      onFailure: true,
      onDigest: true,
    },
    model: 'claude-haiku-4-5',
    maxTurns: 25,
    timeoutSeconds: 300,
    allowedTools: ['Read', 'Bash(curl *)', 'Grep', 'Glob'],
    workingDirectory: process.env.HOME ?? '/tmp',
    env: {},
    ...overrides,
  };
}

export { DEFAULT_PROMPT as INFO_MINER_PROMPT };
