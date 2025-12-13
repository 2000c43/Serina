"use client";

import { ProviderResponse } from "../lib/types";
import { PROVIDER_REGISTRY } from "../lib/providers/registry";

interface Props {
  result?: ProviderResponse;
  loading?: boolean;
}

export default function ResponseCard({ result, loading }: Props) {
  const providerKey = result?.provider;
  const providerLabel = providerKey
    ? PROVIDER_REGISTRY[providerKey]?.label ?? providerKey
    : "—";

  return (
    <div className="border rounded-md p-3 flex flex-col min-h-[160px]">
      <div className="flex justify-between items-center mb-1">
        <div className="font-semibold text-sm">{providerLabel}</div>
        <div className="text-[10px] uppercase tracking-wide opacity-60">
          {loading && "Pending"}
          {!loading && result && !result.error && "Done"}
          {!loading && result?.error && "Error"}
        </div>
      </div>

      <div className="text-[10px] mb-1 opacity-70">
        model: {result?.model ?? "—"} | latency:{" "}
        {result?.latencyMs != null ? `${result.latencyMs} ms` : "—"}
      </div>

      {result?.error && (
        <div className="text-[10px] text-red-600 mb-1">
          error: {result.error}
        </div>
      )}

      <div className="text-xs whitespace-pre-wrap flex-1 mt-1">
        {loading && !result && (
          <span className="opacity-70">Waiting for response…</span>
        )}

        {!loading && result?.text && <>{result.text}</>}

        {!loading && result && !result.text && !result.error && (
          <span className="opacity-50">
            No text returned from provider.
          </span>
        )}
      </div>
    </div>
  );
}
