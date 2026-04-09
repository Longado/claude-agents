import type { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { getAgentConfig } from '../core/paths.js';
import { AgentConfigSchema } from '../types.js';
import { generateDigest } from '../core/digest.js';
import { dispatch } from '../notify/dispatcher.js';

function parseSince(sinceStr: string): string {
  // Support "24h", "7d", "1h" relative format
  const match = sinceStr.match(/^(\d+)([hd])$/);
  if (match) {
    const amount = Number(match[1]);
    const unit = match[2];
    const now = Date.now();
    const ms = unit === 'h' ? amount * 3600_000 : amount * 86400_000;
    return new Date(now - ms).toISOString();
  }
  // Assume ISO string
  return sinceStr;
}

export function registerDigestCommand(program: Command): void {
  program
    .command('digest')
    .description('Generate and send a digest summary for an agent')
    .requiredOption('--name <name>', 'Agent name')
    .option('--since <duration>', 'Time range (e.g., 24h, 7d)', '24h')
    .option('--quiet', 'Only print the digest, do not send notifications')
    .action(async (opts: { name: string; since: string; quiet?: boolean }) => {
      const configPath = getAgentConfig(opts.name);
      let config;
      try {
        const raw = readFileSync(configPath, 'utf-8');
        config = AgentConfigSchema.parse(JSON.parse(raw));
      } catch {
        console.error(`Agent "${opts.name}" not found or config invalid.`);
        process.exit(1);
      }

      const since = parseSince(opts.since);
      const digest = generateDigest(opts.name, undefined, since);

      // Print digest
      const successRate = digest.totalEpisodes > 0
        ? Math.round((digest.successCount / digest.totalEpisodes) * 100)
        : 0;
      const avgSec = Math.round(digest.avgDurationMs / 1000);

      console.log(`\n📊 Digest: ${digest.agentName}`);
      console.log(`   Period: ${opts.since}`);
      console.log(`   Episodes: ${digest.totalEpisodes} (${digest.successCount} ok, ${digest.errorCount} failed)`);
      console.log(`   Success rate: ${successRate}%`);
      console.log(`   Avg duration: ${avgSec}s`);
      console.log(`   Last episode: #${digest.lastEpisode}\n`);

      // Send notification if not quiet and onDigest is enabled
      if (!opts.quiet && config.notification.onDigest && config.notification.channels.length > 0) {
        const body = [
          `Episodes: ${digest.totalEpisodes} (${digest.successCount} ok, ${digest.errorCount} failed)`,
          `Success rate: ${successRate}%`,
          `Avg duration: ${avgSec}s`,
          `Last episode: #${digest.lastEpisode}`,
        ].join('\n');

        await dispatch(config.notification.channels, {
          agentName: digest.agentName,
          title: `Digest: ${opts.since}`,
          body,
          level: digest.errorCount > 0 ? 'error' : 'success',
          timestamp: new Date().toISOString(),
        });

        console.log('Notification sent.');
      }
    });
}
