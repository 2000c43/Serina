import { ProviderRequest, ProviderResponse } from "../types";

export const xaiProvider = {
  name: "Grok",
  async call(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    const model = req.model?.trim() || "grok-4-1-fast-reasoning";
    const start = Date.now();

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: typeof req.temperature === "number" ? req.temperature : 0.2,
        max_tokens: typeof req.maxTokens === "number" ? req.maxTokens : 1000,
        messages: [
          ...(req.systemPrompt ? [{ role: "system", content: req.systemPrompt }] : []),
          { role: "user", content: req.prompt },
        ],
      }),
    });

    const latencyMs = Date.now() - start;
    const text = await res.text();

    if (!res.ok) {
      return {
        provider: "xai",
        model,
        text: "",
        latencyMs,
        error: `xAI error: ${res.status} ${text}`,
      };
    }

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        provider: "xai",
        model,
        text: "",
        latencyMs,
        error: `xAI error: Non-JSON response: ${text.slice(0, 300)}`,
      };
    }

    const out = json?.choices?.[0]?.message?.content ?? "";

    return {
      provider: "xai",
      model,
      text: (out || "").trim(),
      latencyMs,
    };
  },
};
