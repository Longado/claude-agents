import { z } from 'zod';

// --- Notification Channel Types ---

export const ChannelTypeSchema = z.enum(['telegram', 'wecom', 'feishu']);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;

export interface TelegramChannelConfig {
  readonly type: 'telegram';
  readonly botTokenEnv: string;
  readonly chatIdEnv: string;
}

export interface WecomChannelConfig {
  readonly type: 'wecom';
  readonly webhookUrlEnv: string;
}

export interface FeishuChannelConfig {
  readonly type: 'feishu';
  readonly webhookUrlEnv: string;
}

export type ChannelConfig =
  | TelegramChannelConfig
  | WecomChannelConfig
  | FeishuChannelConfig;

export interface NotificationConfig {
  readonly channels: ReadonlyArray<ChannelConfig>;
  readonly onSuccess: boolean;
  readonly onFailure: boolean;
  readonly onDigest: boolean;
}

// --- Schedule Types ---

export interface ScheduleConfig {
  readonly intervalSeconds: number;
  readonly startHour: number;
  readonly endHour: number;
  readonly daysOfWeek: ReadonlyArray<number>; // 0=Sun, 1=Mon, ..., 6=Sat
}

// --- Agent Config ---

export type TemplateName =
  | 'personal-assistant'
  | 'code-monitor'
  | 'info-miner'
  | 'builder'
  | 'reviewer'
  | 'custom';

export interface AgentConfig {
  readonly name: string;
  readonly template: TemplateName;
  readonly schedule: ScheduleConfig;
  readonly notification: NotificationConfig;
  readonly model: string;
  readonly maxTurns: number;
  readonly timeoutSeconds: number;
  readonly allowedTools: ReadonlyArray<string>;
  readonly workingDirectory: string;
  readonly env: Readonly<Record<string, string>>;
}

export const AgentConfigSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with dashes'),
  template: z.enum(['personal-assistant', 'code-monitor', 'info-miner', 'builder', 'reviewer', 'custom']),
  schedule: z.object({
    intervalSeconds: z.number().min(60),
    startHour: z.number().min(0).max(23),
    endHour: z.number().min(0).max(23),
    daysOfWeek: z.array(z.number().min(0).max(6)),
  }),
  notification: z.object({
    channels: z.array(z.discriminatedUnion('type', [
      z.object({ type: z.literal('telegram'), botTokenEnv: z.string(), chatIdEnv: z.string() }),
      z.object({ type: z.literal('wecom'), webhookUrlEnv: z.string() }),
      z.object({ type: z.literal('feishu'), webhookUrlEnv: z.string() }),
    ])),
    onSuccess: z.boolean(),
    onFailure: z.boolean(),
    onDigest: z.boolean(),
  }),
  model: z.string(),
  maxTurns: z.number().min(1).max(100),
  timeoutSeconds: z.number().min(30).max(3600),
  allowedTools: z.array(z.string()),
  workingDirectory: z.string(),
  env: z.record(z.string()),
});

// --- Agent State ---

export type AgentStatus = 'idle' | 'running' | 'error';

export interface AgentState {
  readonly name: string;
  readonly status: AgentStatus;
  readonly currentEpisode: number;
  readonly totalRuns: number;
  readonly totalErrors: number;
  readonly lastRunAt: string | null;
  readonly lastErrorAt: string | null;
  readonly lastErrorMessage: string | null;
}

export const AgentStateSchema = z.object({
  name: z.string(),
  status: z.enum(['idle', 'running', 'error']),
  currentEpisode: z.number().min(0),
  totalRuns: z.number().min(0),
  totalErrors: z.number().min(0),
  lastRunAt: z.string().nullable(),
  lastErrorAt: z.string().nullable(),
  lastErrorMessage: z.string().nullable(),
});

// --- Lock ---

export interface LockInfo {
  readonly pid: number;
  readonly startedAt: string;
  readonly hostname: string;
}

// --- Notification ---

export type NotificationLevel = 'info' | 'success' | 'error';

export interface NotificationMessage {
  readonly agentName: string;
  readonly title: string;
  readonly body: string;
  readonly level: NotificationLevel;
  readonly timestamp: string;
}

export interface NotificationChannel {
  readonly type: string;
  send(message: NotificationMessage): Promise<void>;
}

// --- Execution Result ---

export interface ExecutionResult {
  readonly success: boolean;
  readonly episode: number;
  readonly durationMs: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly timedOut: boolean;
}

// --- Digest ---

export interface DigestPeriod {
  readonly from: string;
  readonly to: string;
}

export interface DigestResult {
  readonly agentName: string;
  readonly period: DigestPeriod;
  readonly totalEpisodes: number;
  readonly successCount: number;
  readonly errorCount: number;
  readonly avgDurationMs: number;
  readonly lastEpisode: number;
}

// --- Plist ---

export interface PlistConfig {
  readonly label: string;
  readonly programArguments: ReadonlyArray<string>;
  readonly startInterval: number;
  readonly environmentVariables: Readonly<Record<string, string>>;
  readonly standardOutPath: string;
  readonly standardErrorPath: string;
  readonly workingDirectory: string;
}
