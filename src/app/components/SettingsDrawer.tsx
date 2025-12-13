"use client";

import { useMemo, useState } from "react";
import type { ProviderConfigMap, ProviderName } from "../lib/types";

type Props = {
  apiKeys: Partial<Record<ProviderName, string>>;
  setKey: (provider: ProviderName, key: string) => void;

  providerConfigs: ProviderConfigMap;
  setProviderConfig: (
    provider: ProviderName,
    patch: Partial<{ model: string; temperature: number; maxTokens: number }>
  ) => void;

  resetAll: () => void;
};

export default function SettingsDrawer({
  apiKeys,
  setKey,
  providerConfigs,
  setProviderConfig,
  resetAll,
}: Props) {
  const [open, setOpen] = useState(false);

  const providers = useMemo<ProviderName[]>(() => ["openai", "anthropic", "gemini", "xai"], []);

  const label = (p: ProviderName) => {
    switch (p) {
      case "openai":
        return "ChatGPT";
      case "anthropic":
        return "Claude";
      case "gemini":
        return "Gemini";
      case "xai":
        return "Grok";
      default:
        return p;
    }
  };

  return (
    <div className="relative">
      <button
        className="px-3 py-2 rounded border bg-white text-sm"
        onClick={() => setOpen((v) => !v)}
      >
        Settings
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[440px] max-w-[90vw] bg-white border rounded shadow-lg p-4 z-50">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Settings</div>
            <button className="text-sm underline" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>

          <div className="text-xs opacity-70 mb-3">
            Keys + provider config are saved locally on this computer (localStorage).
          </div>

          <div className="flex gap-2 mb-4">
            <button className="px-3 py-2 rounded border text-sm" onClick={resetAll}>
              Reset (local)
            </button>
          </div>

          <div className="space-y-4">
            {providers.map((p) => {
              const cfg = providerConfigs[p];

              return (
                <div key={p} className="border rounded p-3">
                  <div className="font-semibold text-sm mb-2">{label(p)}</div>

                  <label className="block text-xs mb-1">API key</label>
                  <input
                    className="w-full border rounded px-2 py-2 text-sm mb-3"
                    value={apiKeys[p] ?? ""}
                    onChange={(e) => setKey(p, e.target.value)}
                    placeholder={`Paste ${label(p)} API key`}
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs mb-1">Model</label>
                      <input
                        className="w-full border rounded px-2 py-2 text-xs"
                        value={cfg?.model ?? ""}
                        onChange={(e) => setProviderConfig(p, { model: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-xs mb-1">Temp</label>
                      <input
                        className="w-full border rounded px-2 py-2 text-xs"
                        type="number"
                        step="0.1"
                        value={cfg?.temperature ?? 0.2}
                        onChange={(e) =>
                          setProviderConfig(p, { temperature: Number(e.target.value) })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-xs mb-1">Max tokens</label>
                      <input
                        className="w-full border rounded px-2 py-2 text-xs"
                        type="number"
                        step="50"
                        value={cfg?.maxTokens ?? 1200}
                        onChange={(e) =>
                          setProviderConfig(p, { maxTokens: Number(e.target.value) })
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
