// src/app/lib/providers/anthropic.ts
import type { AiProvider, ProviderRequest, ProviderResponse } from "../types";

// Anthropic Messages API
// Docs: model aliases like `claude-sonnet-4-5` exist; older `claude-3-5-...-latest` may 404 for many keys.
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

function pickModel(req: ProviderRequest): string {
  // Prefer caller-specified model, otherwise default to a currently-supported alias.
  // You can swap this default to `claude-opus-4-1` if you prefer.
  return (req.model && req.model.trim()) || "claude-sonnet-4-5";
}

export const anthropicProvider: AiProvider = {
  name: "anthropic",

  async call(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    const started = Date.now();

    if (!apiKey || !apiKey.trim()) {
      return {
        provider: "anthropic",
        model: req.model ?? "",
        text: "",
        latencyMs: Date.now() - started,
        error: "Anthropic API key not set",
      };
    }

    const model = pickModel(req);
    const maxTokens = typeof req.maxTokens === "number" ? req.maxTokens : 800;
    const temperature = typeof req.temperature === "number" ? req.temperature : 0.2;

    // Anthropic expects "system" separately from user messages
    const system = (req.systemPrompt || "").trim();
    const user = (req.prompt || "").trim();

    try {
      const res = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey.trim(),
          // This header is required for the Messages API
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          system: system.length ? system : undefined,
          messages: [{ role: "user", content: user }],
        }),
      });

      const raw = await res.text();
      if (!res.ok) {
        return {
          provider: "anthropic",
          model,
          text: "",
          latencyMs: Date.now() - started,
          error: `Anthropic ${res.status}: ${raw}`,
        };
      }

      const json = JSON.parse(raw) as any;

      // content is an array of blocks; text blocks have { type: "text", text: "..." }
      const blocks: any[] = Array.isArray(json?.content) ? json.content : [];
      const text = blocks
        .filter((b) => b?.type === "text" && typeof b?.text === "string")
        .map((b) => b.text)
        .join("\n")
        .trim();

      return {
        provider: "anthropic",
        model,
        text,
        latencyMs: Date.now() - started,
      };
    } catch (e: any) {
      return {
        provider: "anthropic",
        model,
        text: "",
        latencyMs: Date.now() - started,
        error: `Anthropic exception: ${e?.message || String(e)}`,
      };
    }
  },
};
