// src/app/hooks/useStreamingQuery.ts
"use client";

import { useCallback, useState } from "react";
import { ProviderName, ProviderResponse } from "../lib/types";
import { ApiKeyState } from "./useApiKeys";

export function useStreamingQuery() {
  const [results, setResults] = useState<ProviderResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = useCallback(
    async (
      prompt: string,
      providers: ProviderName[],
      apiKeys: ApiKeyState,
      options?: { systemPrompt?: string; temperature?: number; maxTokens?: number }
    ) => {
      setResults([]);
      setLoading(true);
      setError(null);
      setDone(false);

      try {
        const res = await fetch("/api/query-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            providers,
            apiKeys,
            ...options,
          }),
        });

        const text = await res.text();

        if (!res.ok) {
          throw new Error(
            `Server error ${res.status}: ${text.slice(0, 200)}`
          );
        }

        let json: any;
        try {
          json = JSON.parse(text);
        } catch (e: any) {
          throw new Error(
            `Invalid JSON from server: ${e?.message ?? String(
              e
            )}. Raw: ${text.slice(0, 200)}`
          );
        }

        const data = (json.results ?? []) as ProviderResponse[];

        setResults(data);
        setDone(true);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { results, loading, error, done, run };
}
