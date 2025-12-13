"use client";

import { ProviderName, ProviderConfigMap } from "../lib/types";

interface ProviderConfigSectionProps {
  configs: ProviderConfigMap;
  setConfig: (provider: ProviderName, config: any) => void;
}

const ALL_PROVIDERS: ProviderName[] = [
  "openai",
  "anthropic",
  "gemini",
  "xai",
];

export default function ProviderConfigSection({
  configs,
  setConfig,
}: ProviderConfigSectionProps) {
  return (
    <div>
      <h3 className="text-xs font-semibold mb-2">Provider configuration</h3>
      <div className="text-xs mb-3 opacity-70">
        Choose model, temperature, and max tokens for each provider.
      </div>

      {ALL_PROVIDERS.map((provider) => {
        const cfg = configs[provider] ?? {};
        return (
          <div
            key={provider}
            className="border rounded p-3 mb-3"
          >
            <div className="text-xs font-semibold mb-2">
              {provider.toUpperCase()}
            </div>

            <div className="mb-2">
              <label className="block text-xs mb-1">Model</label>
              <input
                className="w-full border rounded px-2 py-1 text-xs"
                placeholder="Model ID"
                value={cfg.model ?? ""}
                onChange={(e) =>
                  setConfig(provider, {
                    ...cfg,
                    model: e.target.value,
                  })
                }
              />
            </div>

            <div className="mb-2">
              <label className="block text-xs mb-1">Temperature</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                className="w-full border rounded px-2 py-1 text-xs"
                value={cfg.temperature ?? 0.7}
                onChange={(e) =>
                  setConfig(provider, {
                    ...cfg,
                    temperature: Number(e.target.value),
                  })
                }
              />
            </div>

            <div>
              <label className="block text-xs mb-1">Max tokens</label>
              <input
                type="number"
                min="1"
                className="w-full border rounded px-2 py-1 text-xs"
                value={cfg.maxTokens ?? 512}
                onChange={(e) =>
                  setConfig(provider, {
                    ...cfg,
                    maxTokens: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
