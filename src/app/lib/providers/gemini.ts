import { AiProvider, ProviderRequest, ProviderResponse } from "../types";

async function callGeminiOnce(
  req: ProviderRequest,
  apiKey: string,
  model: string,
  promptOverride?: string
): Promise<{ ok: boolean; text: string; error?: string }> {
  const systemPrompt = `
You are an expert research assistant.
Answer the user's question directly and specifically.
Do NOT talk about the user or infer identities unless asked.
Avoid filler like "Based on publicly available information..."
Give a concise direct answer first, then add 2–5 supporting details.
Write at least 6 sentences if possible.
`.trim();

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${systemPrompt}\n\nQuestion:\n${
              promptOverride ?? req.prompt
            }`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: req.temperature ?? 0.2,
      maxOutputTokens: req.maxTokens ?? 900,
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (!res.ok) {
    return {
      ok: false,
      text: "",
      error: `Gemini error: ${res.status} ${JSON.stringify(json)}`,
    };
  }

  const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p?.text ?? "").join("").trim();

  return { ok: true, text };
}

export const geminiProvider: AiProvider = {
  name: "gemini",

  async call(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    const start = Date.now();
    const model = req.model ?? "gemini-2.5-flash";

    // Attempt 1
    const r1 = await callGeminiOnce(req, apiKey, model);
    if (!r1.ok) {
      return {
        provider: "gemini",
        model,
        text: "",
        latencyMs: Date.now() - start,
        error: r1.error,
      };
    }

    // If too short / useless, retry once with a “be more thorough” nudge
    const tooShort = (r1.text ?? "").length < 200;
    if (!tooShort) {
      return {
        provider: "gemini",
        model,
        text: r1.text,
        latencyMs: Date.now() - start,
      };
    }

    const retryPrompt =
      `${req.prompt}\n\n` +
      `Please answer more thoroughly. Provide 6–10 sentences and include concrete facts (names, dates, locations) where applicable.`;

    const r2 = await callGeminiOnce(req, apiKey, model, retryPrompt);

    return {
      provider: "gemini",
      model,
      text: r2.ok ? r2.text : r1.text,
      latencyMs: Date.now() - start,
      error: r2.ok ? undefined : r2.error,
    };
  },
};
