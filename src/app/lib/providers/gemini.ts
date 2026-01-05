// src/app/lib/providers/gemini.ts
import type { AiProvider, ProviderRequest, ProviderResponse } from "../types";

// IMPORTANT:
// If you send "systemInstruction", you must call the v1beta endpoint.
// Your error was: Unknown name "systemInstruction" -> you were hitting v1.
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.5-flash"; // what you want

export const geminiProvider: AiProvider = {
  name: "gemini",
  async call(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    const t0 = Date.now();
    const model = req.model?.trim() || DEFAULT_MODEL;

    const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(
      apiKey.trim()
    )}`;

    const system = (req.systemPrompt ?? "").trim();
    const user = (req.prompt ?? "").trim();

    // v1beta supports systemInstruction object
    const body: any = {
      contents: [
        {
          role: "user",
          parts: [{ text: user }],
        },
      ],
      generationConfig: {
        temperature: typeof req.temperature === "number" ? req.temperature : 0.2,
        maxOutputTokens: req.maxTokens ?? 1400,
      },
    };

    if (system) {
      body.systemInstruction = {
        parts: [{ text: system }],
      };
    }

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const latencyMs = Date.now() - t0;
    const raw = await r.text();

    if (!r.ok) {
      return {
        provider: "gemini",
        model,
        text: "",
        latencyMs,
        error: `Gemini ${r.status}: ${raw}`,
      };
    }

    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      return {
        provider: "gemini",
        model,
        text: "",
        latencyMs,
        error: `Gemini parse error: ${raw.slice(0, 300)}`,
      };
    }

    const text =
      json?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text ?? "")
        .join("") ?? "";

    return {
      provider: "gemini",
      model,
      text,
      latencyMs,
      error: text ? undefined : undefined,
    };
  },
};
