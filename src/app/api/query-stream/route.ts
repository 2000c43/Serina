import { NextResponse } from "next/server";
import {
  ProviderName,
  ProviderRequest,
  ProviderResponse,
  RetrievalSource,
  ProviderConfigMap,
} from "../../lib/types";

import { openAiProvider } from "../../lib/providers/openai";
import { anthropicProvider } from "../../lib/providers/anthropic";
import { geminiProvider } from "../../lib/providers/gemini";
import { xaiProvider } from "../../lib/providers/xai";

export const runtime = "nodejs";

type Body = {
  prompt: string;
  providers: ProviderName[];
  apiKeys: Partial<Record<ProviderName, string>>;
  providerConfigs?: ProviderConfigMap;
  useRetrieval?: boolean;
  retrievalMaxResults?: number;
  retrievalDepth?: "basic" | "advanced";
};

const PROVIDERS: Record<ProviderName, any> = {
  openai: openAiProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  xai: xaiProvider,
};

// ✅ Hard defaults so you don’t silently fall back to gpt-4.1 / haiku again.
const DEFAULT_MODELS: Record<ProviderName, string> = {
  openai: "gpt-5.2-thinking", // OpenAI docs: GPT-5.2 model family is current 
  anthropic: "claude-3-5-sonnet-latest", // Anthropic’s “latest” alias style is supported by their platform docs 
  gemini: "gemini-2.5-flash", // Google lists Gemini 2.5 Flash in their model docs 
  xai: "grok-4.1-fast", // xAI publishes Grok 4.1 Fast; we’ll let your UI override to -reasoning if desired 
};

function safeTrim(x: unknown) {
  return typeof x === "string" ? x.trim() : "";
}

function hasKey(apiKeys: Partial<Record<ProviderName, string>>, p: ProviderName) {
  return safeTrim(apiKeys?.[p]).length > 0;
}

function getCfg(providerConfigs: ProviderConfigMap | undefined, p: ProviderName) {
  const cfg = providerConfigs?.[p];
  const model = safeTrim(cfg?.model) || DEFAULT_MODELS[p];
  const temperature = typeof cfg?.temperature === "number" ? cfg.temperature : 0.2;
  const maxTokens = typeof cfg?.maxTokens === "number" ? cfg.maxTokens : 1000;
  return { model, temperature, maxTokens };
}

async function tavilySearch(
  query: string,
  maxResults: number,
  depth: "basic" | "advanced"
): Promise<RetrievalSource[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("TAVILY_API_KEY is not set; skipping web retrieval.");
    return [];
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: depth,
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    console.warn(`Tavily search failed: ${res.status} ${t}`);
    return [];
  }

  const json: any = await res.json();
  const results: any[] = json?.results ?? [];

  return results.slice(0, maxResults).map((r, i) => ({
    id: i + 1,
    title: r?.title ?? `Source ${i + 1}`,
    url: r?.url ?? "",
    snippet: r?.content ?? r?.snippet ?? "",
  }));
}

function formatSources(sources: RetrievalSource[]) {
  if (!sources.length) return "";
  return sources
    .map((s) => {
      const snip = (s.snippet || "").replace(/\s+/g, " ").trim();
      return `[S${s.id}] ${s.title}\n${s.url}\n${snip}`;
    })
    .join("\n\n");
}

function systemPromptBase() {
  // ✅ General-purpose, not tuned to any topic.
  return `
You are a precise assistant.

Rules:
- Answer the user's question directly.
- If the user provided a location/timeframe/entity name, treat that as sufficient disambiguation.
- If you are uncertain, say what is uncertain and offer ONE follow-up question.
- Do not invent names, dates, companies, or specifications.
- If web sources are provided, you may use them, but do NOT merely summarize them—use them to support your own answer.
`.trim();
}

async function runProvider(
  provider: ProviderName,
  req: ProviderRequest,
  apiKey: string
): Promise<ProviderResponse> {
  const start = Date.now();
  try {
    const r: ProviderResponse = await PROVIDERS[provider].call(req, apiKey);
    return {
      ...r,
      provider,
      model: r.model ?? req.model ?? "",
      latencyMs: r.latencyMs ?? Date.now() - start,
    };
  } catch (e: any) {
    return {
      provider,
      model: req.model ?? "",
      text: "",
      latencyMs: Date.now() - start,
      error: `${provider} error: ${e?.message ?? String(e)}`,
    };
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "query-stream route is alive. Use POST with JSON body to run queries.",
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const prompt = safeTrim(body.prompt);
    const providers = Array.isArray(body.providers) ? body.providers : [];
    const apiKeys = body.apiKeys ?? {};
    const providerConfigs = body.providerConfigs;

    const useRetrieval = !!body.useRetrieval;
    const retrievalMaxResults =
      typeof body.retrievalMaxResults === "number"
        ? Math.max(1, Math.min(10, body.retrievalMaxResults))
        : 6;
    const retrievalDepth =
      body.retrievalDepth === "basic" || body.retrievalDepth === "advanced"
        ? body.retrievalDepth
        : "advanced";

    if (!prompt) return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
    if (!providers.length)
      return NextResponse.json({ error: "No providers selected." }, { status: 400 });

    const sources: RetrievalSource[] = useRetrieval
      ? await tavilySearch(prompt, retrievalMaxResults, retrievalDepth)
      : [];

    const sourcesBlock = sources.length
      ? `\n\nWeb sources (use only if relevant):\n${formatSources(sources)}`
      : "";

    const results: ProviderResponse[] = await Promise.all(
      providers.map(async (p) => {
        if (!PROVIDERS[p]) {
          return { provider: p, model: "", text: "", latencyMs: 0, error: `Unknown provider: ${p}` };
        }
        if (!hasKey(apiKeys, p)) {
          return { provider: p, model: "", text: "", latencyMs: 0, error: "Provider missing or API key not set" };
        }

        const cfg = getCfg(providerConfigs, p);

        const reqOneShot: ProviderRequest = {
          prompt: `${prompt}${sourcesBlock}`,
          systemPrompt: systemPromptBase(),
          model: cfg.model,
          temperature: cfg.temperature,
          maxTokens: cfg.maxTokens,
        };

        return runProvider(p, reqOneShot, apiKeys[p]!);
      })
    );

    return NextResponse.json({
      ok: true,
      prompt,
      useRetrieval,
      sources,
      results,
      debug: {
        providersRequested: providers,
        sourcesCount: sources.length,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Server error: ${e?.message ?? String(e)}` }, { status: 400 });
  }
}
