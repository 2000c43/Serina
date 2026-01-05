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

const LS_KEYS_KEY = "serina_apiKeys_v1";
const LS_CONFIG_KEY = "serina_providerConfigs_v1";

/**
 * IMPORTANT:
 * If you ever change model naming conventions, add a mapping here so old localStorage
 * settings don't silently break providers.
 */
function migrateModelName(provider: ProviderName, model: string | undefined): string | undefined {
  if (!model) return model;
  const m = model.trim();

  // Anthropic migrations
  if (provider === "anthropic") {
    if (m === "claude-3-5-sonnet-latest") return "claude-sonnet-4-5";
    if (m === "claude-3-5-opus-latest") return "claude-opus-4-1";
  }

  // xAI migrations
  if (provider === "xai") {
    if (m === "grok-beta") return "grok-3";
    if (m === "grok-4-1") return "grok-3"; // if you don't have access, fall back safely
    if (m === "grok-4-1-fast-reasoning") return "grok-3";
  }

  // Gemini migrations (optional)
  if (provider === "gemini") {
    if (m === "gemini-pro" || m === "gemini-pro-latest") return "gemini-2.5-pro";
  }

  // OpenAI migrations (optional)
  if (provider === "openai") {
    if (m === "gpt-4.1-mini") return "gpt-5.2";
  }

  return m;
}

function migrateConfigs(cfg: ProviderConfigMap): ProviderConfigMap {
  return {
    openai: {
      ...cfg.openai,
      model: migrateModelName("openai", cfg.openai.model),
    },
    anthropic: {
      ...cfg.anthropic,
      model: migrateModelName("anthropic", cfg.anthropic.model),
    },
    gemini: {
      ...cfg.gemini,
      model: migrateModelName("gemini", cfg.gemini.model),
    },
    xai: {
      ...cfg.xai,
      model: migrateModelName("xai", cfg.xai.model),
    },
  };
}

const defaultConfigs: ProviderConfigMap = {
  openai: { model: "gpt-5.2", temperature: 0.2, maxTokens: 1400 },
  anthropic: { model: "claude-sonnet-4-5", temperature: 0.2, maxTokens: 1400 },
  gemini: { model: "gemini-2.5-pro", temperature: 0.2, maxTokens: 1400 },
  xai: { model: "grok-3", temperature: 0.2, maxTokens: 1400 },
};

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState<ProviderResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const allProviders: ProviderName[] = useMemo(() => ["openai", "anthropic", "gemini", "xai"], []);
  const [selectedProviders, setSelectedProviders] = useState<ProviderName[]>(["openai"]);

  const [useRetrieval, setUseRetrieval] = useState(false);
  const [snippets, setSnippets] = useState<WebSnippet[]>([]);
  const [usedRetrieval, setUsedRetrieval] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);

  const [apiKeys, setApiKeys] = useState<Partial<Record<ProviderName, string>>>({});
  const [configs, setConfigs] = useState<ProviderConfigMap>(defaultConfigs);

  // Load saved keys/configs once
  useEffect(() => {
    try {
      const rawKeys = localStorage.getItem(LS_KEYS_KEY);
      if (rawKeys) setApiKeys(JSON.parse(rawKeys));

      const rawCfg = localStorage.getItem(LS_CONFIG_KEY);
      if (rawCfg) {
        const parsed = JSON.parse(rawCfg) as ProviderConfigMap;
        const migrated = migrateConfigs(parsed);
        setConfigs({
          ...defaultConfigs,
          ...migrated,
          openai: { ...defaultConfigs.openai, ...migrated.openai },
          anthropic: { ...defaultConfigs.anthropic, ...migrated.anthropic },
          gemini: { ...defaultConfigs.gemini, ...migrated.gemini },
          xai: { ...defaultConfigs.xai, ...migrated.xai },
        });
      } else {
        setConfigs(defaultConfigs);
      }
    } catch {
      setConfigs(defaultConfigs);
    }
  }, []);

  // Persist keys/configs
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
      setResults(Array.isArray(json?.results) ? json.results : []);
      setSnippets(Array.isArray(json?.snippets) ? json.snippets : []);
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

  // Enter/Return runs (Shift+Enter newline)
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
        <div className="mb-4">
          <textarea
            className="w-full min-h-[100px] border rounded p-3 text-sm"
            placeholder="Ask anything…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="text-xs opacity-60 mt-1">Tip: Enter to run • Shift+Enter for a new line</div>
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
              <div className="text-xs opacity-70">
                No snippets available. If you expected sources, confirm{" "}
                <code className="px-1 border rounded">TAVILY_API_KEY</code> is set in{" "}
                <code className="px-1 border rounded">.env.local</code> and restart{" "}
                <code className="px-1 border rounded">npm run dev</code>.
              </div>
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
