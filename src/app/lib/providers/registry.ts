import { ProviderName } from "../types";

export const PROVIDER_REGISTRY: Record<
  ProviderName,
  { label: string; defaultModel: string; notes?: string }
> = {
  openai: {
    label: "ChatGPT",
    defaultModel: "gpt-4.1",
  },
  anthropic: {
    label: "Claude",
    // safer default than 3.5-sonnet for many accounts
    defaultModel: "claude-3-sonnet-20240229",
    notes: "Provider auto-falls back if unavailable",
  },
  gemini: {
    label: "Gemini",
    defaultModel: "gemini-2.5-flash",
  },
  xai: {
    label: "Grok",
    defaultModel: "grok-4-1-fast-reasoning",
  },
};
