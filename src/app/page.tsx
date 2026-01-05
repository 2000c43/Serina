// src/app/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ProviderName,
  ProviderResponse,
  RetrievalSource,
  MetaSummaryResponse,
  ProviderConfigMap,
} from "./lib/types";
import ResponseGrid from "./components/ResponseGrid";
import SettingsDrawer from "./components/SettingsDrawer";

const LS_KEYS_KEY = "serina_apiKeys_v1";
const LS_CONFIG_KEY = "serina_providerConfigs_v1";
const LS_SELECTED_PROVIDERS_KEY = "serina_selectedProviders_v1";
const LS_USE_RETRIEVAL_KEY = "serina_useRetrieval_v1";

const defaultConfigFor = (p: ProviderName) => {
  if (p === "openai") return { model: "gpt-5.2", temperature: 0.2, maxTokens: 1400 };
  if (p === "anthropic") return { model: "claude-3-5-sonnet-latest", temperature: 0.2, maxTokens: 1400 };
  if (p === "gemini") return { model: "gemini-2.5-flash", temperature: 0.2, maxTokens: 1400 };
  if (p === "xai") return { model: "grok-4-1-fast-reasoning", temperature: 0.2, maxTokens: 1400 };
  return { model: "", temperature: 0.2, maxTokens: 1400 };
};

export default function HomePage() {
  // ---------------------------
  // Core state
  // ---------------------------
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState<ProviderResponse[]>([]);
  const [loading, setLoading] = useState(false);

  // Summary state
  const [summary, setSummary] = useState<MetaSummaryResponse | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // ---------------------------
  // Providers
  // ---------------------------
  const allProviders: ProviderName[] = useMemo(
    () => ["openai", "anthropic", "gemini", "xai"],
    []
  );

  // Default: all 4 providers ON
  const [selectedProviders, setSelectedProviders] = useState<ProviderName[]>([
    "openai",
    "anthropic",
    "gemini",
    "xai",
  ]);

  // ---------------------------
  // Retrieval toggle + sources
  // ---------------------------
  const [useRetrieval, setUseRetrieval] = useState<boolean>(true); // ✅ default ON
  const [sources, setSources] = useState<RetrievalSource[]>([]);
  const [usedRetrieval, setUsedRetrieval] = useState(false);

  // ---------------------------
  // Settings
  // ---------------------------
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [apiKeys, setApiKeys] = useState<Partial<Record<ProviderName, string>>>({});

  const [configs, setConfigs] = useState<ProviderConfigMap>({
    openai: defaultConfigFor("openai"),
    anthropic: defaultConfigFor("anthropic"),
    gemini: defaultConfigFor("gemini"),
    xai: defaultConfigFor("xai"),
  });

  // ---------------------------
  // Load localStorage (after mount ONLY to avoid hydration mismatch)
  // ---------------------------
  useEffect(() => {
    try {
      const rawKeys = localStorage.getItem(LS_KEYS_KEY);
      if (rawKeys) setApiKeys(JSON.parse(rawKeys));

      const rawCfg = localStorage.getItem(LS_CONFIG_KEY);
      if (rawCfg) setConfigs(JSON.parse(rawCfg));

      const rawSel = localStorage.getItem(LS_SELECTED_PROVIDERS_KEY);
      if (rawSel) {
        const parsed = JSON.parse(rawSel);
        if (Array.isArray(parsed)) setSelectedProviders(parsed);
      }

      const rawRetr = localStorage.getItem(LS_USE_RETRIEVAL_KEY);
      if (rawRetr != null) setUseRetrieval(rawRetr === "true");
    } catch {
      // ignore
    }
  }, []);

  // Persist localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS_KEY, JSON.stringify(apiKeys));
    } catch {}
  }, [apiKeys]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(configs));
    } catch {}
  }, [configs]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_SELECTED_PROVIDERS_KEY, JSON.stringify(selectedProviders));
    } catch {}
  }, [selectedProviders]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_USE_RETRIEVAL_KEY, String(useRetrieval));
    } catch {}
  }, [useRetrieval]);

  // ---------------------------
  // Run query (calls query-stream then meta-summary)
  // ---------------------------
  const runQuery = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setLoading(true);
    setResults([]);
    setSources([]);
    setUsedRetrieval(false);

    setSummary(null);
    setSummaryError(null);
    setSummaryLoading(false);

    try {
      const res = await fetch("/api/query-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          providers: selectedProviders,
          useRetrieval,
          apiKeys,
          providerConfigs: configs,
        }),
      });

      const json = await res.json();

      const nextResults: ProviderResponse[] = Array.isArray(json?.results) ? json.results : [];
      const nextSources: RetrievalSource[] = Array.isArray(json?.sources)
        ? json.sources
        : Array.isArray(json?.snippets)
        ? json.snippets
        : [];

      setResults(nextResults);
      setSources(nextSources);
      setUsedRetrieval(Boolean(json?.usedRetrieval));

      // Auto-summary
      setSummaryLoading(true);
      try {
        const sRes = await fetch("/api/meta-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: trimmed,
            results: nextResults,
            sources: nextSources,
            summarizerProvider: "openai",
          }),
        });

        const sJson = await sRes.json();
        if (!sRes.ok) {
          setSummary(null);
          setSummaryError(typeof sJson?.error === "string" ? sJson.error : JSON.stringify(sJson));
        } else {
          setSummary(sJson as MetaSummaryResponse);
          setSummaryError(null);
        }
      } catch (e: any) {
        setSummary(null);
        setSummaryError(String(e?.message || e));
      } finally {
        setSummaryLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      setResults([]);
      setSources([]);
      setUsedRetrieval(false);
      setSummary(null);
      setSummaryError(String(err?.message || err));
      setSummaryLoading(false);
    } finally {
      setLoading(false);
    }
  }, [prompt, selectedProviders, useRetrieval, apiKeys, configs]);

  // Enter runs, Shift+Enter newline
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        runQuery();
      }
    },
    [runQuery]
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <h1 className="text-lg font-semibold">Serina</h1>
        <button
          onClick={() => setSettingsOpen(true)}
          className="text-sm px-3 py-1.5 rounded border hover:bg-gray-100"
        >
          Settings
        </button>
      </header>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        {/* Prompt */}
        <div className="mb-4">
          <textarea
            className="w-full min-h-[110px] border rounded p-3 text-sm bg-white"
            placeholder="Ask anything…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="text-xs opacity-60 mt-1">Enter to run • Shift+Enter for a new line</div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={runQuery}
            disabled={loading}
            className="px-4 py-2 rounded bg-black text-white text-sm disabled:opacity-50"
          >
            {loading ? "Running…" : "Run"}
          </button>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useRetrieval}
              onChange={(e) => setUseRetrieval(e.target.checked)}
            />
            Use retrieval
          </label>

          <div className="text-xs opacity-70">
            Active: {selectedProviders.join(", ") || "(none)"}
          </div>
        </div>

        {/* Summary */}
        <div className="mb-6 border rounded bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-sm">Summary</div>
            {summaryLoading && <div className="text-xs opacity-60">Summarizing…</div>}
          </div>

          {!summaryLoading && !summary && !summaryError && (
            <div className="text-sm opacity-70">Run a query to see a summary.</div>
          )}

          {summaryError && (
            <div className="text-sm text-red-700 whitespace-pre-wrap">
              Summary error: {summaryError}
            </div>
          )}

          {summary && (
            <div className="text-sm whitespace-pre-wrap">{summary.finalAnswer || "—"}</div>
          )}
        </div>

        {/* Web sources (only show when retrieval is on) */}
        {useRetrieval && (
          <div className="mb-6 border rounded bg-white p-4">
            <div className="font-semibold text-sm mb-2">
              Web sources {usedRetrieval ? "" : "(none returned — check TAVILY_API_KEY)"}
            </div>

            {sources.length === 0 ? (
              <div className="text-xs opacity-70">
                No sources available. If you expected sources, confirm{" "}
                <code className="px-1 border rounded">TAVILY_API_KEY</code> is set on server or in{" "}
                <code className="px-1 border rounded">.env.local</code> and restart{" "}
                <code className="px-1 border rounded">npm run dev</code>.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {sources.map((s) => (
                  <div key={s.id} className="border rounded p-3">
                    <div className="text-xs font-semibold mb-1">
                      [{s.id}] {s.title || "Source"}
                    </div>
                    {s.url ? (
                      <a className="text-xs underline break-all" href={s.url} target="_blank" rel="noreferrer">
                        {s.url}
                      </a>
                    ) : (
                      <div className="text-xs opacity-60">(no url)</div>
                    )}
                    <div className="text-xs mt-2 whitespace-pre-wrap">{s.snippet || ""}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Provider results */}
        <ResponseGrid results={results} loading={loading} selectedProviders={selectedProviders} />
      </main>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        allProviders={allProviders}
        selectedProviders={selectedProviders}
        setSelectedProviders={setSelectedProviders}
        apiKeys={apiKeys}
        setApiKeys={setApiKeys}
        configs={configs}
        setConfigs={setConfigs}
      />
    </div>
  );
}
