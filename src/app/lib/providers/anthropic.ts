import type { ProviderRequest, ProviderResponse } from "../types";

async function callAnthropicOnce(args: {
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  temperature: number;
  maxTokens: number;
}) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": args.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: args.maxTokens,
      temperature: args.temperature,
      system: args.system,
      messages: [{ role: "user", content: args.prompt }],
    }),
  });

  const raw = await res.text();
  return { res, raw };
}

function extractText(json: any): string {
  const out = (json?.content ?? [])
    .map((c: any) => (typeof c?.text === "string" ? c.text : ""))
    .join("");
  return (out || "").trim();
}

export const anthropicProvider = {
  async call(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    const requested = (req.model?.trim() || "claude-3-5-sonnet-latest").trim();

    // Fallback order (keeps you on strong models if “latest” alias isn’t enabled on your key)
    const candidates = [
      requested,
      "claude-3-5-sonnet-20241022",
      "claude-3-5-sonnet-20240620",
      "claude-3-haiku-20240307",
    ];

    const start = Date.now();

    for (let i = 0; i < candidates.length; i++) {
      const model = candidates[i];
      const { res, raw } = await callAnthropicOnce({
        apiKey,
        model,
        system: req.systemPrompt || "",
        prompt: req.prompt,
        temperature: typeof req.temperature === "number" ? req.temperature : 0.2,
        maxTokens: typeof req.maxTokens === "number" ? req.maxTokens : 1200,
      });

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        // If model is not found, retry next candidate
        if (res.status === 404 && raw.includes("model")) {
          continue;
        }

        return {
          provider: "anthropic",
          model,
          text: "",
          latencyMs,
          error: `Anthropic error: ${res.status} ${raw}`,
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
          error: `Anthropic error: Non-JSON response: ${raw.slice(0, 300)}`,
        };
      }

      return {
        provider: "anthropic",
        model,
        text: extractText(json),
        latencyMs,
      };
    }

    const latencyMs = Date.now() - start;
    return {
      provider: "anthropic",
      model: requested,
      text: "",
      latencyMs,
      error:
        "Anthropic error: model not found. None of the fallback model names worked for this API key.",
    };
  },
};
