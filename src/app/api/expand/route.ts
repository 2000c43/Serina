// /Users/dean/ai-meta-client/src/app/api/expand/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  AiProvider,
  ProviderName,
  ProviderRequest,
  ProviderConfigMap,
  ProviderResponse,
} from "../../lib/types";
import { fetchWebSnippets, WebSnippet } from "../../lib/search";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message:
      "expand route is alive. Use POST to deepen each provider independently.",
  });
}

function buildRetrievalBlock(snippets: WebSnippet[]) {
  if (snippets.length === 0) return "";
  const snippetsText = snippets
    .map(
      (s) =>
        `Source [${s.id}] ${s.title}${s.url ? ` (${s.url})` : ""}\n${s.content}`
    )
    .join("\n\n");
  return (
    "WEB EVIDENCE (use as evidence only):\n" +
    "- Do NOT mention snippets/web results/Tavily.\n" +
    "- Synthesize in your own words.\n\n" +
    snippetsText +
    "\n"
  );
}

function focusInstructions(focus: string) {
  const f = (focus || "general").toLowerCase();
  if (f === "size") {
    return (
      "- Focus on quantitative specs: square footage (range if uncertain), floors, rentable area.\n" +
      "- If multiple numbers exist, list the range and say which source/provider reported it.\n"
    );
  }
  if (f === "team") {
    return (
      "- Focus on who built it: developer/owner, architect, general contractor, engineers.\n" +
      "- Name companies and people; be precise.\n"
    );
  }
  if (f === "timeline") {
    return (
      "- Focus on timeline: groundbreaking/start, completion/opening, major renovations/renames.\n" +
      "- Include years and sequence.\n"
    );
  }
  if (f === "naming") {
    return (
      "- Focus on alternate names and branding: prior/current names and why/when they changed.\n"
    );
  }
  return (
    "- Add more useful factual detail without being verbose.\n" +
    "- Prefer concrete numbers, names, dates.\n"
  );
}

async function callOneProvider(
  provider: AiProvider,
  providerName: ProviderName,
  apiKey: string,
  req: ProviderRequest,
  providerConfigs?: ProviderConfigMap
): Promise<ProviderResponse> {
  const cfg = providerConfigs?.[providerName];
  const finalReq: ProviderRequest = {
    ...req,
    model: cfg?.model ?? req.model,
    temperature:
      typeof cfg?.temperature === "number" ? cfg.temperature : req.temperature,
    maxTokens:
      typeof cfg?.maxTokens === "number" ? cfg.maxTokens : req.maxTokens,
  };
  return provider.call(finalReq, apiKey);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const originalPrompt: string = body?.originalPrompt ?? "";
    const results: ProviderResponse[] = body?.results ?? [];
    const providers: ProviderName[] = body?.providers ?? [];
    const apiKeys: Partial<Record<ProviderName, string>> = body?.apiKeys ?? {};
    const providerConfigs: ProviderConfigMap | undefined = body?.providerConfigs;
    const systemPromptInput: string | undefined = body?.systemPrompt;
    const useRetrieval: boolean = body?.useRetrieval ?? true;

    const focus: string = body?.focus ?? "general";

    if (!originalPrompt || typeof originalPrompt !== "string") {
      return NextResponse.json(
        { error: "Missing required field: originalPrompt" },
        { status: 400 }
      );
    }
    if (!Array.isArray(results)) {
      return NextResponse.json(
        { error: "Missing/invalid field: results (must be an array)" },
        { status: 400 }
      );
    }

    const { getProvider } = await import("../../lib/providers");

    const snippets = await fetchWebSnippets(originalPrompt, {
      enabled: useRetrieval,
      maxResults: 6,
    });
    const retrievalBlock = buildRetrievalBlock(snippets);

    const expanded: ProviderResponse[] = [];

    for (const p of providers) {
      const provider = getProvider(p);
      const key = apiKeys[p];
      const previous = results.find((r) => r.provider === p);

      if (!provider) {
        expanded.push({
          provider: p,
          model: "",
          text: "",
          latencyMs: 0,
          error: `Unknown provider: ${p}`,
        });
        continue;
      }
      if (!key) {
        expanded.push({
          provider: p,
          model: "",
          text: "",
          latencyMs: 0,
          error: "Provider missing or API key not set",
        });
        continue;
      }

      const providerSpecific =
        p === "gemini"
          ? "IMPORTANT: Only add NEW factual details not already present in your previous answer. If you cannot add any confirmed new facts, reply exactly: 'No additional confirmed facts found.'\n"
          : "";

      const deepenPrompt =
        "You are expanding your prior answer with more detail.\n" +
        providerSpecific +
        "Constraints:\n" +
        "- Do NOT mention snippets/web results/Tavily.\n" +
        "- Prefer concrete names, dates, numbers.\n" +
        "- Avoid repeating your previous sentences.\n" +
        focusInstructions(focus) +
        "\nOriginal question:\n" +
        originalPrompt +
        "\n\nYour previous answer:\n" +
        (previous?.text ?? "(none)") +
        "\n";

      const baseReq: ProviderRequest = {
        prompt: deepenPrompt,
        systemPrompt:
          (systemPromptInput ? systemPromptInput + "\n\n" : "") + retrievalBlock,
        temperature: 0.35,
        maxTokens: 1000,
      };

      const r = await callOneProvider(provider, p, key, baseReq, providerConfigs);
      expanded.push(r);
    }

    return NextResponse.json({ results: expanded });
  } catch (e: any) {
    console.error("expand error", e);
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
