# claude-agents

Always-on Claude Code agent framework for macOS.

## Architecture

- `src/core/` — Core modules: lock, state, handoff, executor, launchd, tmux
- `src/notify/` — Notification channels: telegram, wecom, feishu
- `src/cli/` — CLI commands
- `src/templates/` — Agent templates
- `src/types.ts` — All types (readonly interfaces)

## Key Design Decisions

- **launchd** schedules agent runs (not node-cron)
- **Episodic execution**: each run is a fresh `claude -p` invocation
- **HANDOFF.md** passes semantic context between episodes
- **STATE.json** tracks structured state (immutable transitions)
- **Always exit 0** from `agents run` to avoid launchd throttling
- **Delete CLAUDECODE env var** before spawning child claude processes

## Commands

```bash
npm run build      # Build with tsup
npm test           # Run tests with vitest
npm run typecheck  # Type check
```

## Conventions

- TypeScript, ESM, Node 18+
- Immutable data (readonly interfaces, spread for updates)
- Small files (<400 lines), small functions (<50 lines)
- Conventional commits (feat, fix, refactor, etc.)

## Workflow

Use SHIFU for all development work in this project:
- `shifu:engage` — detect gear before starting any task
- `shifu:test-first` — TDD for all new code (RED → GREEN → REFACTOR)
- `shifu:review` — verify before claiming done
- `shifu:debug` — 4-phase root cause analysis for bugs
