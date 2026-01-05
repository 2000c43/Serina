// src/app/api/query-stream/route.ts
import { NextResponse } from "next/server";
import type { ProviderName, ProviderRequest, ProviderResponse } from "../../lib/types";

import { openAiProvider } from "../../lib/providers/openai";
import { anthropicProvider } from "../../lib/providers/anthropic";
import { geminiProvider } from "../../lib/providers/gemini";
import { xaiProvider } from "../../lib/providers/xai";

import { fetchWebSnippets, type WebSnippet } from "../../lib/search";

export const runtime = "nodejs";

type Body = {
  prompt?: string;
  providers?: ProviderName[];
  apiKeys?: Partial<Record<ProviderName, string>>;
  providerConfigs?: any;

  // Retrieval (optional)
  useRetrieval?: boolean;

  // Optional override
  systemPrompt?: string;
};

const DEFAULT_SYSTEM_PROMPT = `
You are a helpful assistant.

Rules:
- Do not invent facts. If unsure, say so.
- If web sources are provided, cite them using [1], [2], etc.
- Do not output personal contact details (home address, phone number, personal email).
- Do not claim two handles/accounts are the same person unless a source explicitly states it.
`.trim();

function getProvider(p: ProviderName) {
  switch (p) {
    case "openai":
      return openAiProvider;
    case "anthropic":
      return anthropicProvider;
    case "gemini":
      return geminiProvider;
    case "xai":
      return xaiProvider;
    default:
      return null;
  }
}

function getKey(bodyKeys: Partial<Record<ProviderName, string>> | undefined, p: ProviderName) {
  const fromBody = bodyKeys?.[p];
  if (typeof fromBody === "string" && fromBody.trim()) return fromBody.trim();

  const envMap: Record<ProviderName, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    xai: process.env.XAI_API_KEY,
  };

  const fromEnv = envMap[p];
  return typeof fromEnv === "string" && fromEnv.trim() ? fromEnv.trim() : "";
}

function buildSourcesBlock(snippets: WebSnippet[]) {
  if (!snippets.length) return "";
  const lines = snippets.map((s) => {
    const title = (s.title || "").trim();
    const url = (s.url || "").trim();
    const content = (s.content || "").trim();
    return `[${s.id}] ${title}${url ? ` — ${url}` : ""}\n${content}`;
  });
  return `\n\nSOURCES (use these as evidence and cite as [1], [2], etc.):\n\n${lines.join("\n\n")}\n`;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = (body.prompt ?? "").trim();
  if (!prompt) return NextResponse.json({ ok: false, error: "Missing prompt" }, { status: 400 });

  const providers: ProviderName[] =
    Array.isArray(body.providers) && body.providers.length > 0
      ? body.providers
      : (["openai", "anthropic", "gemini", "xai"] as ProviderName[]);

  const providerConfigs = body.providerConfigs ?? {};
  const systemPrompt = (body.systemPrompt ?? DEFAULT_SYSTEM_PROMPT).trim();

  const useRetrieval = Boolean(body.useRetrieval);

  // IMPORTANT: retrieval happens HERE (Run path)
  const snippets = await fetchWebSnippets(prompt, {
    enabled: useRetrieval,
    maxResults: 6,
  });

  const promptWithSources = prompt + buildSourcesBlock(snippets);

  const results: ProviderResponse[] = [];

  for (const p of providers) {
    const prov = getProvider(p);
    if (!prov) {
      results.push({ provider: p, model: "", text: "", latencyMs: 0, error: `Unknown provider: ${p}` });
      continue;
    }

    const apiKey = getKey(body.apiKeys, p);
    if (!apiKey) {
      results.push({
        provider: p,
        model: providerConfigs?.[p]?.model ?? "",
        text: "",
        latencyMs: 0,
        error: "API key not set (client or server).",
      });
      continue;
    }

    const cfg = providerConfigs?.[p] ?? {};
    const modelFromCfg = typeof cfg.model === "string" ? cfg.model.trim() : "";

    const reqObj: ProviderRequest = {
      prompt: promptWithSources,
      systemPrompt,
      model: modelFromCfg.length > 0 ? modelFromCfg : undefined,
      temperature: typeof cfg.temperature === "number" ? cfg.temperature : 0.2,
      maxTokens: typeof cfg.maxTokens === "number" ? cfg.maxTokens : 1400,
    };

    try {
      const out = await prov.call(reqObj, apiKey);
      results.push(out);
    } catch (e) {
      results.push({
        provider: p,
        model: (reqObj.model as string) ?? "",
        text: "",
        latencyMs: 0,
        error: `Provider call failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }

  // Return snippets so UI can show exactly what was found (pure/transparent)
  return NextResponse.json(
    { ok: true, results, snippets, usedRetrieval: useRetrieval && snippets.length > 0 },
    { status: 200 }
  );
}
