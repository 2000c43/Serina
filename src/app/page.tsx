// src/app/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ProviderConfigMap, ProviderName, ProviderResponse } from "./lib/types";
import ResponseGrid from "./components/ResponseGrid";
import SettingsDrawer from "./components/SettingsDrawer";

type WebSnippet = {
  id: number; // 1-based
  title: string;
  url: string;
  content: string;
};

type ProviderConfig = {
  model: string;
  temperature: number;
  maxTokens: number;
};

const LS_KEYS_KEY = "serina_apiKeys_v1";
const LS_CONFIG_KEY = "serina_providerConfigs_v1";
const LS_SELECTED_PROVIDERS_KEY = "serina_selectedProviders_v1";
const LS_USE_RETRIEVAL_KEY = "serina_useRetrieval_v1";

const defaultConfigFor = (p: ProviderName): ProviderConfig => {
  if (p === "openai") return { model: "gpt-5.2", temperature: 0.2, maxTokens: 1400 };
  if (p === "anthropic") return { model: "claude-3-5-haiku-latest", temperature: 0.2, maxTokens: 1400 };
  if (p === "gemini") return { model: "gemini-2.5-flash", temperature: 0.2, maxTokens: 1400 };
  if (p === "xai") return { model: "grok-3", temperature: 0.2, maxTokens: 1400 };
  return { model: "", temperature: 0.2, maxTokens: 1400 };
};

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState<ProviderResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const allProviders: ProviderName[] = useMemo(() => ["openai", "anthropic", "gemini", "xai"], []);
  const [selectedProviders, setSelectedProviders] = useState<ProviderName[]>(allProviders);

  const [useRetrieval, setUseRetrieval] = useState(true);
  const [snippets, setSnippets] = useState<WebSnippet[]>([]);
  const [usedRetrieval, setUsedRetrieval] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);

  const [apiKeys, setApiKeys] = useState<Partial<Record<ProviderName, string>>>({});
  const [configs, setConfigs] = useState<ProviderConfigMap>(() => ({
    openai: defaultConfigFor("openai"),
    anthropic: defaultConfigFor("anthropic"),
    gemini: defaultConfigFor("gemini"),
    xai: defaultConfigFor("xai"),
  }));

  // Load saved state
  useEffect(() => {
    try {
      const rawKeys = localStorage.getItem(LS_KEYS_KEY);
      if (rawKeys) setApiKeys(JSON.parse(rawKeys));

      const rawCfg = localStorage.getItem(LS_CONFIG_KEY);
      if (rawCfg) setConfigs(JSON.parse(rawCfg));

      const rawSel = localStorage.getItem(LS_SELECTED_PROVIDERS_KEY);
      if (rawSel) setSelectedProviders(JSON.parse(rawSel));

      const rawRetr = localStorage.getItem(LS_USE_RETRIEVAL_KEY);
      if (rawRetr) setUseRetrieval(JSON.parse(rawRetr));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist
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
      localStorage.setItem(LS_USE_RETRIEVAL_KEY, JSON.stringify(useRetrieval));
    } catch {}
  }, [useRetrieval]);

  const runQuery = useCallback(async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setResults([]);
    setSnippets([]);
    setUsedRetrieval(false);

    try {
      const res = await fetch("/api/query-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          providers: selectedProviders,
          useRetrieval,
          apiKeys,
          providerConfigs: configs,
        }),
      });

      const json = await res.json();

      if (Array.isArray(json?.results)) setResults(json.results);
      else setResults([]);

      if (Array.isArray(json?.snippets)) setSnippets(json.snippets);
      else setSnippets([]);

      setUsedRetrieval(Boolean(json?.usedRetrieval));
    } catch (err) {
      console.error(err);
      setResults([]);
      setSnippets([]);
      setUsedRetrieval(false);
    } finally {
      setLoading(false);
    }
  }, [prompt, selectedProviders, useRetrieval, apiKeys, configs]);

  // Enter = Run (Shift+Enter newline)
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
    <div className="min-h-[100dvh] flex flex-col bg-gray-50 text-gray-900 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="flex items-center justify-between px-6 py-4 border-b bg-white pt-[env(safe-area-inset-top)]">
        <h1 className="text-lg font-semibold">Serina</h1>
        <button
          onClick={() => setSettingsOpen(true)}
          className="text-sm px-3 py-1.5 rounded border hover:bg-gray-100"
        >
          Settings
        </button>
      </header>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="mb-4">
          <textarea
            // IMPORTANT: iOS will auto-zoom inputs < 16px. Use text-base (16px).
            className="w-full min-h-[100px] border rounded p-3 text-base"
            placeholder="Ask anything…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="text-xs opacity-60 mt-1">Enter to run • Shift+Enter for a new line</div>
        </div>

        <div className="flex items-center gap-4 mb-3">
          <button
            onClick={runQuery}
            disabled={loading}
            className="px-4 py-2 rounded bg-black text-white text-sm disabled:opacity-50"
          >
            {loading ? "Running…" : "Run"}
          </button>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useRetrieval} onChange={(e) => setUseRetrieval(e.target.checked)} />
            Use retrieval
          </label>

          <div className="text-xs opacity-70">Active: {selectedProviders.join(", ") || "(none)"}</div>
        </div>

        {useRetrieval && (
          <div className="mb-4 border rounded bg-white p-3">
            <div className="font-semibold text-sm mb-2">
              Web sources {usedRetrieval ? "" : "(none returned — check TAVILY_API_KEY)"}
            </div>

            {snippets.length === 0 ? (
              <div className="text-xs opacity-70">No snippets available.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {snippets.map((s) => (
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
                    <div className="text-xs mt-2 whitespace-pre-wrap">{s.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
