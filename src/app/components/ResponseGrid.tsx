"use client";

import { useState } from "react";
import { ProviderName, ProviderResponse } from "../lib/types";
import ResponseCard from "./ResponseCard";

interface Props {
  results: ProviderResponse[];
  loading: boolean;
  selectedProviders: ProviderName[];
}

export default function ResponseGrid({
  results,
  loading,
  selectedProviders,
}: Props) {
  const [showDebug, setShowDebug] = useState(false);

  return (
    <div>
      <button
        className="text-xs underline mb-2"
        onClick={() => setShowDebug((v) => !v)}
      >
        {showDebug ? "Hide debug" : "Show debug"}
      </button>

      {showDebug && (
        <div className="text-xs opacity-70 mb-3">
          selectedProviders = {JSON.stringify(selectedProviders)}
          <br />
          results.length = {results.length}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {selectedProviders.map((provider) => {
          const result = results.find(
            (r) => r.provider === provider
          );

          return (
            <ResponseCard
              key={provider}
              result={
                result ?? {
                  provider,
                  model: "",
                  text: "",
                  latencyMs: 0,
                }
              }
              loading={loading}
            />
          );
        })}
      </div>
    </div>
  );
}
