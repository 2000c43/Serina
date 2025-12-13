"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProviderConfigMap, ProviderName } from "../lib/types";

const KEYS_STORAGE = "ai-meta-client:apiKeys:v1";
const CONFIG_STORAGE = "ai-meta-client:providerConfigs:v1";

const DEFAULT_PROVIDER_CONFIGS: ProviderConfigMap = {
  openai: { model: "gpt-5.2", temperature: 0.2, maxTokens: 1200 },
  anthropic: { model: "claude-3-5-sonnet-latest", temperature: 0.2, maxTokens: 1200 },
  gemini: { model: "gemini-2.5-flash", temperature: 0.2, maxTokens: 1200 },
  xai: { model: "grok-4-1-fast-reasoning", temperature: 0.2, maxTokens: 1200 },
};

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function useProviderConfig() {
  const [apiKeys, setApiKeys] = useState<Partial<Record<ProviderName, string>>>({});
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfigMap>(DEFAULT_PROVIDER_CONFIGS);

  // Load once on mount
  useEffect(() => {
    const storedKeys = safeJsonParse<Partial<Record<ProviderName, string>>>(localStorage.getItem(KEYS_STORAGE));
    if (storedKeys && typeof storedKeys === "object") setApiKeys(storedKeys);

    const storedCfg = safeJsonParse<ProviderConfigMap>(localStorage.getItem(CONFIG_STORAGE));
    if (storedCfg && typeof storedCfg === "object") {
      // merge with defaults so new providers get defaults
      setProviderConfigs({ ...DEFAULT_PROVIDER_CONFIGS, ...storedCfg });
    }
  }, []);

  // Persist API keys
  useEffect(() => {
    localStorage.setItem(KEYS_STORAGE, JSON.stringify(apiKeys));
  }, [apiKeys]);

  // Persist configs
  useEffect(() => {
    localStorage.setItem(CONFIG_STORAGE, JSON.stringify(providerConfigs));
  }, [providerConfigs]);

  const setKey = useCallback((provider: ProviderName, key: string) => {
    setApiKeys((prev) => ({ ...prev, [provider]: key }));
  }, []);

  const setProviderConfig = useCallback(
    (provider: ProviderName, patch: Partial<{ model: string; temperature: number; maxTokens: number }>) => {
      setProviderConfigs((prev) => ({
        ...prev,
        [provider]: {
          model: patch.model ?? prev[provider]?.model ?? DEFAULT_PROVIDER_CONFIGS[provider].model,
          temperature:
            typeof patch.temperature === "number"
              ? patch.temperature
              : prev[provider]?.temperature ?? DEFAULT_PROVIDER_CONFIGS[provider].temperature,
          maxTokens:
            typeof patch.maxTokens === "number"
              ? patch.maxTokens
              : prev[provider]?.maxTokens ?? DEFAULT_PROVIDER_CONFIGS[provider].maxTokens,
        },
      }));
    },
    []
  );

  const resetAll = useCallback(() => {
    setApiKeys({});
    setProviderConfigs(DEFAULT_PROVIDER_CONFIGS);
  }, []);

  const providerLabels = useMemo<Record<ProviderName, string>>(
    () => ({
      openai: "ChatGPT",
      anthropic: "Claude",
      gemini: "Gemini",
      xai: "Grok",
    }),
    []
  );

  return {
    apiKeys,
    setKey,
    providerConfigs,
    setProviderConfig,
    resetAll,
    providerLabels,
  };
}
