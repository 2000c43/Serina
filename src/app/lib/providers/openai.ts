import type { ProviderRequest, ProviderResponse } from "../types";

export const openAiProvider = {
  // keep "name" out of this file; index.ts wraps it
  async call(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    const model = (req.model?.trim() || "gpt-5.2").trim();
    const start = Date.now();

    const input = [
      ...(req.systemPrompt?.trim()
        ? [
            {
              role: "system",
              content: [{ type: "input_text", text: req.systemPrompt }],
            },
          ]
        : []),
      {
        role: "user",
        content: [{ type: "input_text", text: req.prompt }],
      },
    ];

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input,
        temperature: typeof req.temperature === "number" ? req.temperature : 0.2,
        max_output_tokens: typeof req.maxTokens === "number" ? req.maxTokens : 1200,
      }),
    });

    const latencyMs = Date.now() - start;
    const raw = await res.text();

    if (!res.ok) {
      return {
        provider: "openai",
        model,
        text: "",
        latencyMs,
        error: `OpenAI error: ${res.status} ${raw}`,
      };
    }

    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      return {
        provider: "openai",
        model,
        text: "",
        latencyMs,
        error: `OpenAI error: Non-JSON response: ${raw.slice(0, 300)}`,
      };
    }

    // responses api: easiest is output_text if present
    const out =
      typeof json?.output_text === "string"
        ? json.output_text
        : (json?.output ?? [])
            .flatMap((o: any) => o?.content ?? [])
            .filter((c: any) => c?.type === "output_text")
            .map((c: any) => c?.text ?? "")
            .join("");

    return {
      provider: "openai",
      model,
      text: (out || "").trim(),
      latencyMs,
    };
  },
};
