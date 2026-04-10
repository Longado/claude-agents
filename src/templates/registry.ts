import type { AgentConfig, TemplateName } from '../types.js';
import { personalAssistantDefaults } from './personal-assistant.js';
import { codeMonitorDefaults } from './code-monitor.js';
import { infoMinerDefaults } from './info-miner.js';
import { builderDefaults } from './builder.js';
import { reviewerDefaults } from './reviewer.js';

type TemplateFactory = (name: string, overrides?: Partial<AgentConfig>) => AgentConfig;

const TEMPLATES: Record<TemplateName, TemplateFactory | null> = {
  'personal-assistant': personalAssistantDefaults,
  'code-monitor': codeMonitorDefaults,
  'info-miner': infoMinerDefaults,
  'builder': builderDefaults,
  'reviewer': reviewerDefaults,
  'custom': null,
};

export function getTemplateNames(): ReadonlyArray<TemplateName> {
  return Object.keys(TEMPLATES) as TemplateName[];
}

export function getTemplateFactory(template: TemplateName): TemplateFactory | null {
  return TEMPLATES[template] ?? null;
}

export function createAgentConfig(
  template: TemplateName,
  name: string,
  overrides?: Partial<AgentConfig>,
): AgentConfig {
  const factory = getTemplateFactory(template);
  if (!factory) {
    throw new Error(`No factory for template: ${template}. Use overrides to provide full config.`);
  }
  return factory(name, overrides);
}
