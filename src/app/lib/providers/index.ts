import type { ProviderName, AiProvider } from "../types";

import { openAiProvider } from "./openai";
import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import { xaiProvider } from "./xai";

/**
 * IMPORTANT:
 * AiProvider.name is a ProviderName (internal key), NOT a display label.
 * Display labels should be handled in the UI layer.
 */

export const providers: Record<ProviderName, AiProvider> = {
  openai: {
    name: "openai",
    call: openAiProvider.call,
  },
  anthropic: {
    name: "anthropic",
    call: anthropicProvider.call,
  },
  gemini: {
    name: "gemini",
    call: geminiProvider.call,
  },
  xai: {
    name: "xai",
    call: xaiProvider.call,
  },
};

/**
 * Some routes (e.g. /api/expand) expect this helper.
 */
export function getProvider(name: ProviderName): AiProvider {
  return providers[name];
}

/**
 * Convenience helpers (optional but useful).
 */
export function listProviders(): ProviderName[] {
  return Object.keys(providers) as ProviderName[];
}

export function providerLabel(name: ProviderName): string {
  switch (name) {
    case "openai":
      return "ChatGPT";
    case "anthropic":
      return "Claude";
    case "gemini":
      return "Gemini";
    case "xai":
      return "Grok";
    default:
      return name;
  }
}
