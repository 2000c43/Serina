import { ProviderName } from "../types";

export const PROVIDER_REGISTRY: Record<
  ProviderName,
  { label: string; defaultModel: string; notes?: string }
> = {
  openai: {
    label: "ChatGPT",
    defaultModel: "gpt-5.2",
  },
  anthropic: {
    label: "Claude",
    defaultModel: "claude-3-5-opus-latest",
    notes: "Provider auto-falls back if unavailable",
  },
  gemini: {
    label: "Gemini",
    defaultModel: "gemini-2.5-pro",
  },
  xai: {
    label: "Grok",
    defaultModel: "grok-4-1",
  },
};
