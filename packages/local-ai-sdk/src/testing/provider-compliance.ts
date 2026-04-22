import { describe, expect, it } from 'vitest';
import type { BaseLLMProvider, LLMProvider } from '../providers/types.js';

export function assertBaseProviderCompliance(provider: BaseLLMProvider): void {
  expect(typeof provider.init).toBe('function');
  expect(typeof provider.dispose).toBe('function');
  expect(typeof provider.complete).toBe('function');
  expect(typeof provider.stopCompletion).toBe('function');
}

function assertOptionalCapabilityShapes(provider: LLMProvider): void {
  if (provider.parallel) {
    expect(typeof provider.parallel.enable).toBe('function');
    expect(typeof provider.parallel.disable).toBe('function');
    expect(typeof provider.parallel.getStatus).toBe('function');
  }
  if (provider.speech) {
    expect(typeof provider.speech.speak).toBe('function');
  }
}

export function runProviderComplianceSuite(
  suiteName: string,
  providerFactory: () => Promise<LLMProvider> | LLMProvider
): void {
  describe(`${suiteName} provider compliance`, () => {
    it('implements base provider contract', async () => {
      const provider = await providerFactory();
      assertBaseProviderCompliance(provider);
      assertOptionalCapabilityShapes(provider);
    });
  });
}

