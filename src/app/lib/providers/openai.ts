// src/app/lib/providers/openai.ts
import type { AiProvider, ProviderRequest, ProviderResponse } from "../types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

function pickMaxTokenField(model: string) {
  // GPT-5.x models require max_completion_tokens
  if (model.startsWith("gpt-5")) return "max_completion_tokens";
  return "max_tokens";
}

export const openAiProvider: AiProvider = {
  name: "openai",
  async call(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    const t0 = Date.now();
    const model = req.model || "gpt-5.2";
    const maxField = pickMaxTokenField(model);

    const body: any = {
      model,
      messages: [
        ...(req.systemPrompt ? [{ role: "system", content: req.systemPrompt }] : []),
        { role: "user", content: req.prompt },
      ],
      temperature: typeof req.temperature === "number" ? req.temperature : 0.2,
    };

    // Use the correct token parameter for the selected model family
    body[maxField] = typeof req.maxTokens === "number" ? req.maxTokens : 1400;

    const r = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const txt = await r.text();
      return {
        provider: "openai",
        model,
        text: "",
        latencyMs: Date.now() - t0,
        error: `OpenAI ${r.status}: ${txt}`,
      };
    }

    const json: any = await r.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";

    return {
      provider: "openai",
      model,
      text: text || "",
      latencyMs: Date.now() - t0,
      error: text ? undefined : "No text returned from provider.",
    };
  },
};
