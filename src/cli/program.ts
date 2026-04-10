import { Command } from 'commander';
import { registerCreateCommand } from './create.js';
import { registerStartCommand } from './start.js';
import { registerStopCommand } from './stop.js';
import { registerStatusCommand } from './status.js';
import { registerLogsCommand } from './logs.js';
import { registerAttachCommand } from './attach.js';
import { registerDestroyCommand } from './destroy.js';
import { registerRunCommand } from './run.js';
import { registerDigestCommand } from './digest.js';
import { registerTeamCommand } from './team.js';

export function createProgram(): Command {
  const program = new Command()
    .name('agents')
    .description('Always-on Claude Code agent framework')
    .version('0.1.0');

  registerCreateCommand(program);
  registerStartCommand(program);
  registerStopCommand(program);
  registerStatusCommand(program);
  registerLogsCommand(program);
  registerAttachCommand(program);
  registerDestroyCommand(program);
  registerRunCommand(program);
  registerDigestCommand(program);
  registerTeamCommand(program);

  return program;
}
