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

function labelForProvider(p: ProviderName) {
  if (p === "openai") return "OpenAI";
  if (p === "anthropic") return "Anthropic";
  if (p === "gemini") return "Gemini";
  if (p === "xai") return "xAI";
  return p;
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
  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Prevent background scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const providerTabs = useMemo(
    () => allProviders.map((p) => ({ key: p, label: labelForProvider(p) })),
    [allProviders]
  );

  if (!open) return null;

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  };

  const panelStyle: React.CSSProperties = {
    width: "min(920px, 96vw)",
    maxHeight: "82vh",
    overflow: "hidden",
    borderRadius: 14,
    background: "white",
    border: "3px solid #22c55e", // green border
    boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
    display: "flex",
    flexDirection: "column",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "14px 16px",
    borderBottom: "1px solid #e5e7eb",
  };

  const bodyStyle: React.CSSProperties = {
    padding: 16,
    overflow: "auto",
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontWeight: 700,
    margin: "14px 0 8px",
  };

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
  };

  const smallNoteStyle: React.CSSProperties = {
    fontSize: 12,
    opacity: 0.65,
    marginTop: 6,
    lineHeight: 1.35,
  };

  const tabWrapStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: active ? "#111827" : "white",
    color: active ? "white" : "#111827",
    fontSize: 13,
    cursor: "pointer",
    userSelect: "none",
  });

  const checkboxLineStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
  };

  const cardStyle: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    background: "#fafafa",
    marginTop: 10,
  };

  const toggleProvider = (p: ProviderName) => {
    setSelectedProviders((prev) => {
      const set = new Set(prev);
      if (set.has(p)) set.delete(p);
      else set.add(p);
      return Array.from(set);
    });
  };

  const updateApiKey = (p: ProviderName, val: string) => {
    setApiKeys((prev) => ({ ...prev, [p]: val }));
  };

  const updateConfigField = (
    p: ProviderName,
    field: "model" | "temperature" | "maxTokens",
    val: string
  ) => {
    setConfigs((prev) => {
      const next = { ...prev };
      const current = next[p] ?? {};
      if (field === "temperature") {
        const n = Number(val);
        next[p] = { ...current, temperature: Number.isFinite(n) ? n : 0 };
      } else if (field === "maxTokens") {
        const n = Number(val);
        next[p] = { ...current, maxTokens: Number.isFinite(n) ? n : 0 };
      } else {
        next[p] = { ...current, model: val };
      }
      return next;
    });
  };

  return (
    <div
      style={overlayStyle}
      onClick={() => onClose()} // click outside closes
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div
        style={panelStyle}
        onClick={(e) => e.stopPropagation()} // prevent overlay close when clicking inside
      >
        <div style={headerStyle}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Settings</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
              Providers • Models • API keys (stored locally)
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              border: "1px solid #d1d5db",
              background: "white",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div style={bodyStyle}>
          <div style={sectionTitleStyle}>Active providers</div>
          <div style={tabWrapStyle}>
            {providerTabs.map((t) => {
              const active = selectedProviders.includes(t.key);
              return (
                <div
                  key={t.key}
                  style={tabStyle(active)}
                  onClick={() => toggleProvider(t.key)}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleProvider(t.key)}
                      style={{ width: 16, height: 16 }}
                    />
                    {t.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={smallNoteStyle}>
            Tip: toggle 1 provider for speed or multiple for comparison.
          </div>

          <div style={sectionTitleStyle}>API keys & per-provider config</div>

          {allProviders.map((p) => {
            const cfg = configs[p] ?? {};
            return (
              <div key={p} style={cardStyle}>
                <div style={rowStyle}>
                  <div style={{ fontWeight: 800 }}>{labelForProvider(p)}</div>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>{p}</div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={labelStyle}>API Key</div>
                  <input
                    style={inputStyle}
                    value={apiKeys[p] ?? ""}
                    placeholder={`Paste ${labelForProvider(p)} API key`}
                    onChange={(e) => updateApiKey(p, e.target.value)}
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <div style={smallNoteStyle}>Stored locally in your browser (localStorage).</div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={labelStyle}>Model</div>
                  <input
                    style={inputStyle}
                    value={(cfg.model as string) ?? ""}
                    onChange={(e) => updateConfigField(p, "model", e.target.value)}
                    placeholder="model name"
                    spellCheck={false}
                  />
                  <div style={smallNoteStyle}>Must be a model your key has access to.</div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={labelStyle}>Temperature (0–2)</div>
                  <input
                    style={inputStyle}
                    value={String(cfg.temperature ?? 0.2)}
                    onChange={(e) => updateConfigField(p, "temperature", e.target.value)}
                    inputMode="decimal"
                  />
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={labelStyle}>Max tokens</div>
                  <input
                    style={inputStyle}
                    value={String(cfg.maxTokens ?? 1400)}
                    onChange={(e) => updateConfigField(p, "maxTokens", e.target.value)}
                    inputMode="numeric"
                  />
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.65 }}>
            Click outside the panel or press Esc to close.
          </div>
        </div>
      </div>
    </div>
  );
}
