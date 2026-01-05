// src/app/lib/providers/index.ts
import type { ProviderName, AiProvider, ProviderRequest } from "../types";

import { openAiProvider } from "./openai";
import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import { xaiProvider } from "./xai";

export const providers: Record<ProviderName, AiProvider> = {
  openai: openAiProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  xai: xaiProvider,
};

export function getProvider(name: ProviderName): AiProvider {
  return providers[name];
}

export function normalizeRequest(
  req: ProviderRequest,
  defaults: { model?: string; temperature?: number; maxTokens?: number } = {}
): ProviderRequest {
  return {
    ...req,
    model: (req.model ?? defaults.model)?.toString(),
    temperature: typeof req.temperature === "number" ? req.temperature : defaults.temperature,
    maxTokens: typeof req.maxTokens === "number" ? req.maxTokens : defaults.maxTokens,
  };
}
