// src/app/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ProviderConfigMap,
  ProviderName,
  ProviderResponse,
  MetaSummaryResponse,
} from "./lib/types";

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

function buildCopyText(meta: MetaSummaryResponse | null) {
  if (!meta) return "";
  const lines: string[] = [];
  if (meta.finalAnswer) lines.push(meta.finalAnswer.trim());

  if (Array.isArray(meta.keyFacts) && meta.keyFacts.length) {
    lines.push("");
    lines.push("Key facts:");
    for (const k of meta.keyFacts) lines.push(`- ${k}`);
  }

  if (Array.isArray(meta.disagreements) && meta.disagreements.length) {
    lines.push("");
    lines.push("Disagreements:");
    for (const d of meta.disagreements) lines.push(`- ${d}`);
  }

  return lines.join("\n").trim();
}

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

  // Summary state (RESTORED)
  const [meta, setMeta] = useState<MetaSummaryResponse | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const runMetaSummary = useCallback(
    async (promptText: string, providerResults: ProviderResponse[], webSnips: WebSnippet[]) => {
      if (!promptText.trim()) return;

      setMetaLoading(true);
      setMetaError(null);
      setMeta(null);
      setCopied(false);

      try {
        const res = await fetch("/api/meta-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptText,
            results: providerResults,
            snippets: webSnips,
          }),
        });

        const json = await res.json();

        // Support a few shapes defensively:
        // 1) { meta: { ... } }
        // 2) { ...MetaSummaryResponse }
        // 3) { error: "..." }
        const maybeMeta = (json?.meta ?? json) as MetaSummaryResponse;

        if (json?.error) {
          setMetaError(String(json.error));
          setMeta(null);
        } else if (maybeMeta && typeof maybeMeta === "object" && typeof maybeMeta.finalAnswer === "string") {
          setMeta(maybeMeta);
          setMetaError(null);
        } else {
          setMeta(null);
          setMetaError("No summary text returned.");
        }
      } catch (err) {
        setMeta(null);
        setMetaError(err instanceof Error ? err.message : String(err));
      } finally {
        setMetaLoading(false);
      }
    },
    []
  );

  const runQuery = useCallback(async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setResults([]);
    setSnippets([]);
    setUsedRetrieval(false);

    // Clear summary for new run
    setMeta(null);
    setMetaError(null);
    setMetaLoading(false);
    setCopied(false);

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

      const nextResults: ProviderResponse[] = Array.isArray(json?.results) ? json.results : [];
      const nextSnippets: WebSnippet[] = Array.isArray(json?.snippets) ? json.snippets : [];

      setResults(nextResults);
      setSnippets(nextSnippets);
      setUsedRetrieval(Boolean(json?.usedRetrieval));

      // Run meta-summary after we have the provider answers (+ retrieval snippets, if any)
      await runMetaSummary(prompt, nextResults, nextSnippets);
    } catch (err) {
      console.error(err);
      setResults([]);
      setSnippets([]);
      setUsedRetrieval(false);
      setMeta(null);
      setMetaError("Query failed.");
    } finally {
      setLoading(false);
    }
  }, [prompt, selectedProviders, useRetrieval, apiKeys, configs, runMetaSummary]);

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

  const onCopySummary = useCallback(async () => {
    const text = buildCopyText(meta);
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }, [meta]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50 text-gray-900">
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

        {/* ✅ SUMMARY (RESTORED) */}
        <div className="mb-4 border rounded bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold text-sm">Summary</div>

            <button
              type="button"
              onClick={onCopySummary}
              disabled={!meta || !buildCopyText(meta)}
              className="text-xs px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
              title="Copy summary"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          {metaLoading ? (
            <div className="text-xs opacity-70 mt-2">Running…</div>
          ) : metaError ? (
            <div className="text-xs text-red-600 mt-2">Summary error: {metaError}</div>
          ) : meta ? (
            <div className="mt-2 space-y-3">
              <div className="text-sm whitespace-pre-wrap">{meta.finalAnswer}</div>

              {Array.isArray(meta.keyFacts) && meta.keyFacts.length > 0 && (
                <div>
                  <div className="text-xs font-semibold mb-1">Key facts</div>
                  <ul className="list-disc pl-5 text-xs space-y-1">
                    {meta.keyFacts.map((k, idx) => (
                      <li key={idx}>{k}</li>
                    ))}
                  </ul>
                </div>
              )}

              {Array.isArray(meta.disagreements) && meta.disagreements.length > 0 && (
                <div>
                  <div className="text-xs font-semibold mb-1">Disagreements</div>
                  <ul className="list-disc pl-5 text-xs space-y-1">
                    {meta.disagreements.map((d, idx) => (
                      <li key={idx}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs opacity-70 mt-2">No summary yet.</div>
          )}
        </div>

        {/* Retrieval */}
        {useRetrieval && (
          <div className="mb-4 border rounded bg-white p-3">
            <div className="font-semibold text-sm mb-2">Web sources</div>

            {snippets.length === 0 ? (
              <div className="text-xs opacity-70">
                {loading ? "Running…" : usedRetrieval ? "No snippets available." : "No snippets available."}
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
