// src/app/components/ResponseGrid.tsx
"use client";

import React from "react";
import type { ProviderName, ProviderResponse } from "../lib/types";

type Props = {
  results: ProviderResponse[];
  loading: boolean;
  selectedProviders: ProviderName[];
};

function labelForProvider(p: ProviderName) {
  if (p === "openai") return "ChatGPT";
  if (p === "anthropic") return "Claude";
  if (p === "gemini") return "Gemini";
  if (p === "xai") return "Grok";
  return p;
}

export default function ResponseGrid({ results, loading, selectedProviders }: Props) {
  const resultByProvider = new Map<ProviderName, ProviderResponse>();
  for (const r of results) resultByProvider.set(r.provider, r);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {selectedProviders.map((p) => {
        const r = resultByProvider.get(p);

        return (
          <div key={p} className="border rounded bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">{labelForProvider(p)}</div>
              <div className="text-xs opacity-70">{r?.model ? `model: ${r.model}` : ""}</div>
            </div>

            {loading && !r ? (
              <div className="text-sm opacity-70">Running…</div>
            ) : r?.error ? (
              <div className="text-sm text-red-600 whitespace-pre-wrap">{r.error}</div>
            ) : r?.text ? (
              <div className="text-sm whitespace-pre-wrap">{r.text}</div>
            ) : (
              <div className="text-sm opacity-60">No output.</div>
            )}

            {r?.latencyMs ? (
              <div className="mt-3 text-xs opacity-60">latency: {r.latencyMs} ms</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
