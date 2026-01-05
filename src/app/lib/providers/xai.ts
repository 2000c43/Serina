// src/app/lib/providers/xai.ts
import type { AiProvider, ProviderRequest, ProviderResponse } from "../types";

// xAI API is OpenAI-compatible for chat completions.
// Base docs: https://docs.x.ai/docs/overview
const XAI_API_URL = "https://api.x.ai/v1/chat/completions";

function pickModel(req: ProviderRequest): string {
  // Your error says grok-beta is deprecated; use grok-3 instead.
  // Default here is grok-3, but you can override from Settings.
  return (req.model && req.model.trim()) || "grok-3";
}

export const xaiProvider: AiProvider = {
  name: "xai",

  async call(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    const started = Date.now();

    if (!apiKey || !apiKey.trim()) {
      return {
        provider: "xai",
        model: req.model ?? "",
        text: "",
        latencyMs: Date.now() - started,
        error: "xAI API key not set",
      };
    }

    const model = pickModel(req);
    const temperature = typeof req.temperature === "number" ? req.temperature : 0.2;

    // OpenAI-style APIs use max_tokens
    const maxTokens = typeof req.maxTokens === "number" ? req.maxTokens : 800;

    const system = (req.systemPrompt || "").trim();
    const user = (req.prompt || "").trim();

    try {
      const res = await fetch(XAI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: maxTokens,
          messages: [
            ...(system.length ? [{ role: "system", content: system }] : []),
            { role: "user", content: user },
          ],
        }),
      });

      const raw = await res.text();
      if (!res.ok) {
        return {
          provider: "xai",
          model,
          text: "",
          latencyMs: Date.now() - started,
          error: `xAI ${res.status}: ${raw}`,
        };
      }

      const json = JSON.parse(raw) as any;
      const text = (json?.choices?.[0]?.message?.content ?? "").toString().trim();

      return {
        provider: "xai",
        model,
        text,
        latencyMs: Date.now() - started,
      };
    } catch (e: any) {
      return {
        provider: "xai",
        model,
        text: "",
        latencyMs: Date.now() - started,
        error: `xAI exception: ${e?.message || String(e)}`,
      };
    }
  },
};
