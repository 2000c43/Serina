// src/app/lib/providers/anthropic.ts
import type { AiProvider, ProviderRequest, ProviderResponse } from "../types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Fallback list (tries these in order if the chosen model 404s)
// You can add/remove as you learn what your account supports.
const FALLBACK_MODELS = [
  "claude-3-5-sonnet-latest",
  "claude-3-5-haiku-latest",
  "claude-3-opus-latest",
  "claude-3-sonnet-20240229",
  "claude-3-haiku-20240307",
];

async function callOnce(req: ProviderRequest, apiKey: string, model: string): Promise<ProviderResponse> {
  const t0 = Date.now();

  const body: any = {
    model,
    max_tokens: typeof req.maxTokens === "number" ? req.maxTokens : 1400,
    temperature: typeof req.temperature === "number" ? req.temperature : 0.2,
    messages: [{ role: "user", content: req.prompt }],
  };

  // Anthropic "system" is top-level; omit if empty
  if (req.systemPrompt && req.systemPrompt.trim()) {
    body.system = req.systemPrompt.trim();
  }

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const latencyMs = Date.now() - t0;
  const raw = await res.text();

  if (!res.ok) {
    return {
      provider: "anthropic",
      model,
      text: "",
      latencyMs,
      error: `Anthropic ${res.status}: ${raw}`,
    };
  }

  let json: any;
  try {
    json = JSON.parse(raw);
  } catch {
    return {
      provider: "anthropic",
      model,
      text: "",
      latencyMs,
      error: `Anthropic returned non-JSON: ${raw.slice(0, 400)}`,
    };
  }

  // content is typically: [{ type: "text", text: "..." }]
  const text: string =
    Array.isArray(json?.content)
      ? json.content.map((c: any) => (c?.type === "text" ? c?.text : "")).join("")
      : "";

  return {
    provider: "anthropic",
    model,
    text: (text || "").trim(),
    latencyMs,
  };
}

function isModelNotFound(err?: string) {
  if (!err) return false;
  return err.includes('"type":"not_found_error"') || err.includes("model:") || err.includes("not_found");
}

export const anthropicProvider: AiProvider = {
  name: "anthropic",

  async call(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    const preferred = (req.model || "").trim() || "claude-3-5-sonnet-latest";

    // 1) try chosen model
    let r = await callOnce(req, apiKey, preferred);
    if (r.text) return r;

    // If it failed for reasons other than model-not-found, return immediately
    if (r.error && !isModelNotFound(r.error)) return r;

    // 2) try fallbacks (skip duplicates)
    const tried = new Set<string>([preferred]);
    for (const m of FALLBACK_MODELS) {
      if (tried.has(m)) continue;
      tried.add(m);

      const attempt = await callOnce(req, apiKey, m);
      if (attempt.text) return attempt;

      // if it's something like invalid key, stop
      if (attempt.error && attempt.error.includes("authentication_error")) return attempt;

      // otherwise keep trying
      r = attempt;
    }

    // 3) return last failure
    return r;
  },
};
