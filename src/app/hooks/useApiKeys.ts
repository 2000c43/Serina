// src/app/hooks/useApiKeys.ts
"use client";

import { useLocalStorage } from "./useLocalStorage";
import { ProviderName } from "../lib/types";

export type ApiKeyState = Partial<Record<ProviderName, string>>;

export function useApiKeys() {
  const [apiKeys, setApiKeys] = useLocalStorage<ApiKeyState>(
    "ai-meta-api-keys",
    {}
  );

  const setKey = (provider: ProviderName, key: string) => {
    setApiKeys((prev) => ({ ...prev, [provider]: key }));
  };

  return { apiKeys, setKey };
}
