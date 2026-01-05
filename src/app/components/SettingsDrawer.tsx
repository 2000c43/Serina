// src/app/components/SettingsDrawer.tsx
"use client";

import React, { useEffect, useMemo } from "react";
import type { ProviderConfigMap, ProviderName } from "../lib/types";

type Props = {
  open: boolean;
  onClose: () => void;

  allProviders: ProviderName[];
  selectedProviders: ProviderName[];
  setSelectedProviders: React.Dispatch<React.SetStateAction<ProviderName[]>>;

  apiKeys: Partial<Record<ProviderName, string>>;
  setApiKeys: React.Dispatch<React.SetStateAction<Partial<Record<ProviderName, string>>>>;

  configs: ProviderConfigMap;
  setConfigs: React.Dispatch<React.SetStateAction<ProviderConfigMap>>;
};

const PROVIDER_LABEL: Record<ProviderName, string> = {
  openai: "ChatGPT (OpenAI)",
  anthropic: "Claude (Anthropic)",
  gemini: "Gemini (Google)",
  xai: "Grok (xAI)",
};

function clampNumber(v: string, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function SettingsDrawer({
  open,
  onClose,
  allProviders,
  selectedProviders,
  setSelectedProviders,
  apiKeys,
  setApiKeys,
  configs,
  setConfigs,
}: Props) {
  // Prevent background scroll when modal open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const providerRows = useMemo(() => {
    return allProviders.map((p) => {
      const cfg = configs[p] ?? { model: "", temperature: 0.2, maxTokens: 1400 };
      const keyVal = apiKeys[p] ?? "";
      const enabled = selectedProviders.includes(p);
      return { p, cfg, keyVal, enabled };
    });
  }, [allProviders, configs, apiKeys, selectedProviders]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl border-2 border-green-400 bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <div className="text-base font-semibold">Settings</div>
              <div className="text-xs text-gray-600">
                Keys/configs are saved locally in your browser (localStorage).
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-sm px-3 py-1.5 rounded border hover:bg-gray-50"
            >
              Close
            </button>
          </div>

          {/* Body */}
          <div className="p-4 overflow-y-auto max-h-[calc(85vh-56px)]">
            {/* Providers selection */}
            <div className="mb-5">
              <div className="text-sm font-semibold mb-2">Enabled providers</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allProviders.map((p, i) => (
                  <label
                    key={`${p}-${i}`}
                    className="flex items-center gap-2 border rounded px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedProviders.includes(p)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedProviders((prev) => {
                          if (checked) return Array.from(new Set([...prev, p]));
                          return prev.filter((x) => x !== p);
                        });
                      }}
                    />
                    <span className="font-medium">{PROVIDER_LABEL[p]}</span>
                    <span className="ml-auto text-xs text-gray-500">{p}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Per-provider config */}
            <div className="mb-2">
              <div className="text-sm font-semibold mb-2">Provider keys & config</div>

              <div className="flex flex-col gap-3">
                {providerRows.map(({ p, cfg, keyVal, enabled }) => (
                  <div key={p} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-sm">{PROVIDER_LABEL[p]}</div>
                      <div className="text-xs text-gray-500">
                        {enabled ? "Enabled" : "Disabled"}
                      </div>
                    </div>

                    {/* API Key */}
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      API Key
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2 text-sm mb-3"
                      value={keyVal}
                      onChange={(e) => {
                        const v = e.target.value;
                        setApiKeys((prev) => ({ ...prev, [p]: v }));
                      }}
                      placeholder={`Paste ${p} API key`}
                    />

                    {/* Model */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Model
                        </label>
                        <input
                          className="w-full border rounded px-3 py-2 text-sm"
                          value={cfg.model ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setConfigs((prev) => ({
                              ...prev,
                              [p]: { ...prev[p], model: v },
                            }));
                          }}
                          placeholder="model id"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Temperature
                        </label>
                        <input
                          className="w-full border rounded px-3 py-2 text-sm"
                          inputMode="decimal"
                          value={String(cfg.temperature ?? 0.2)}
                          onChange={(e) => {
                            const n = clampNumber(e.target.value, 0.2);
                            setConfigs((prev) => ({
                              ...prev,
                              [p]: { ...prev[p], temperature: n },
                            }));
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Max tokens
                        </label>
                        <input
                          className="w-full border rounded px-3 py-2 text-sm"
                          inputMode="numeric"
                          value={String(cfg.maxTokens ?? 1400)}
                          onChange={(e) => {
                            const n = clampNumber(e.target.value, 1400);
                            setConfigs((prev) => ({
                              ...prev,
                              [p]: { ...prev[p], maxTokens: n },
                            }));
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-2 text-[11px] text-gray-500">
                      Tip: if a provider errors, confirm the model name is one you have access to.
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 text-xs text-gray-600">
              Close this dialog to return to the main screen. Your inputs remain saved locally.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
