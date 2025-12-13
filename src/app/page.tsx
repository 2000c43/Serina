"use client";

import { useCallback, useMemo, useState } from "react";
import type { ProviderName, ProviderResponse } from "./lib/types";

import SettingsDrawer from "./components/SettingsDrawer";
import ResponseGrid from "./components/ResponseGrid";
import { useProviderConfig } from "./hooks/useProviderConfig";

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState<ProviderResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [useRetrieval, setUseRetrieval] = useState(true);

  const { apiKeys, setKey, providerConfigs, setProviderConfig, resetAll } = useProviderConfig();

  const allProviders: ProviderName[] = useMemo(
    () => ["openai", "anthropic", "gemini", "xai"],
    []
  );

  const [selectedProviders, setSelectedProviders] = useState<ProviderName[]>(allProviders);

  const runSummary = useCallback(
    async (originalPrompt: string, providerResults: ProviderResponse[]) => {
      if (!providerResults || providerResults.length === 0) {
        setSummary("No provider results to summarize.");
        return;
      }

      setSummaryLoading(true);
      setSummary("");

      try {
        const res = await fetch("/api/meta-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalPrompt,
            results: providerResults,
            apiKeys,
            providerConfigs,
            summarizerProvider: "openai",
          }),
        });

        const text = await res.text();

        let json: any = null;
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }

        if (!res.ok) {
          setSummary(
            `Summary error (HTTP ${res.status}): ${
              json?.error ? String(json.error) : text.slice(0, 500)
            }`
          );
          return;
        }

        const s = json?.summary ?? json?.text ?? "";
        if (!s || typeof s !== "string" || s.trim().length === 0) {
          setSummary(
            `Summary returned no text. Raw response:\n${JSON.stringify(json, null, 2).slice(0, 1200)}`
          );
          return;
        }

        setSummary(s);
      } catch (e) {
        setSummary(`Summary client error: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setSummaryLoading(false);
      }
    },
    [apiKeys, providerConfigs]
  );

  const runAll = useCallback(async () => {
    const p = prompt.trim();
    if (!p) return;

    setLoading(true);
    setResults([]);
    setSummary("");
    setSummaryLoading(false);

    try {
      const res = await fetch("/api/query-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: p,
          providers: selectedProviders,
          apiKeys,
          providerConfigs,
          useRetrieval,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setResults([
          {
            provider: "openai",
            model: "",
            text: "",
            latencyMs: 0,
            error: json?.error ? String(json.error) : `Server error ${res.status}`,
          },
        ]);
        return;
      }

      const providerResults: ProviderResponse[] = Array.isArray(json?.results) ? json.results : [];
      setResults(providerResults);

      await runSummary(p, providerResults);
    } catch (e) {
      setResults([
        {
          provider: "openai",
          model: "",
          text: "",
          latencyMs: 0,
          error: `Client error: ${e instanceof Error ? e.message : String(e)}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [prompt, selectedProviders, apiKeys, providerConfigs, useRetrieval, runSummary]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="border-b bg-white p-4 flex justify-between items-center">
        <h1 className="text-lg font-semibold">AI Meta Client</h1>

        <SettingsDrawer
          apiKeys={apiKeys}
          setKey={setKey}
          providerConfigs={providerConfigs}
          setProviderConfig={setProviderConfig}
          resetAll={resetAll}
        />
      </header>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <textarea
          className="w-full border rounded p-3 text-sm mb-3"
          rows={4}
          placeholder="Ask anything…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              runAll();
            }
          }}
        />

        <div className="flex flex-wrap items-center gap-4 mb-4">
          <button
            className="px-4 py-2 rounded bg-black text-white text-sm disabled:opacity-50"
            onClick={runAll}
            disabled={loading}
          >
            {loading ? "Running…" : "Run"}
          </button>

          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={useRetrieval}
              onChange={(e) => setUseRetrieval(e.target.checked)}
            />
            Use retrieval
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {allProviders.map((p) => {
              const checked = selectedProviders.includes(p);
              return (
                <label
                  key={p}
                  className="text-xs flex items-center gap-1 border rounded px-2 py-1 bg-white"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setSelectedProviders((prev) => {
                        const next = on ? [...prev, p] : prev.filter((x) => x !== p);
                        return allProviders.filter((x) => next.includes(x));
                      });
                    }}
                  />
                  {p}
                </label>
              );
            })}
          </div>
        </div>

        <div className="border rounded bg-white p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-sm">Summary</div>
            <div className="text-xs opacity-60">
              {summaryLoading ? "Summarizing…" : summary ? "Ready" : "—"}
            </div>
          </div>
          <div className="text-sm whitespace-pre-wrap">
            {summaryLoading && <span className="opacity-70">Generating summary…</span>}
            {!summaryLoading && !summary && (
              <span className="opacity-50">Run a query to see a summary.</span>
            )}
            {!summaryLoading && summary && summary}
          </div>
        </div>

        <ResponseGrid results={results} loading={loading} selectedProviders={selectedProviders} />
      </main>
    </div>
  );
}
