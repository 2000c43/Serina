// src/app/api/meta-summary/route.ts
import { NextResponse } from "next/server";
import type {
  ProviderResponse,
  RetrievalSource,
  MetaSummaryResponse,
} from "../../lib/types";

export const runtime = "nodejs";

type MetaSummaryRequest = {
  prompt: string;
  results: ProviderResponse[];
  sources?: RetrievalSource[];
  openaiApiKey?: string;
};

const MODEL = "gpt-5.2";
const TEMPERATURE = 0.2;
const MAX_OUTPUT_TOKENS = 3200;

/**
 * Extracts text from OpenAI Responses API output safely
 */
function extractText(resp: any): string {
  if (typeof resp?.output_text === "string" && resp.output_text.trim()) {
    return resp.output_text.trim();
  }
  const chunks: string[] = [];
  for (const item of resp?.output ?? []) {
    for (const c of item?.content ?? []) {
      if (typeof c?.text === "string") chunks.push(c.text);
    }
  }
  return chunks.join("\n").trim();
}

/**
 * Safely parse JSON even if the model slightly over-generates
 */
function parseJsonSafe(text: string): any {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Meta-summary did not return JSON.");
  }
  return JSON.parse(text.slice(start, end + 1));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MetaSummaryRequest;

    if (!body.prompt || !body.results?.length) {
      return NextResponse.json(
        { error: "Missing prompt or provider results." },
        { status: 400 }
      );
    }

    const apiKey = body.openaiApiKey || process.env.OPENAI_API_KEY || "";
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OpenAI API key for meta-summary." },
        { status: 401 }
      );
    }

    const providerBlock = body.results
      .map((r) => {
        const header = `PROVIDER: ${r.provider} | model=${r.model || "unknown"}`;
        const content = r.error
          ? `ERROR: ${r.error}`
          : r.text?.trim() || "(no output)";
        return `${header}\n${content}`;
      })
      .join("\n\n---\n\n");

    const sourcesBlock =
      body.sources && body.sources.length
        ? body.sources
            .map(
              (s) =>
                `[${s.id}] ${s.title || ""}\n${s.url || ""}\n${s.snippet || ""}`
            )
            .join("\n\n")
        : "(no web sources provided)";

    // 🔧 UPGRADED SYSTEM PROMPT:
    // - Forces "union of facts" across all providers + sources
    // - Forces KeyFacts to include *every* unique factual claim
    // - Forces disagreements when providers differ
    // - Avoids over-refusal but blocks sensitive private data
    const systemPrompt = `
You are Serina, a meta-summarization engine.

Goal: produce the best combined answer for ANY prompt by synthesizing:
(1) multiple provider answers, (2) optional web sources.

CRITICAL RULE: FACT-UNION
- You MUST include EVERY unique, relevant factual claim that appears in ANY provider answer or web source.
- If multiple providers say the same fact, include it once (dedupe).
- If facts conflict, include BOTH as a disagreement and explain what would resolve it.

Do NOT tune for any specific topic. This must work for all prompts.

Safety:
- Do NOT output sensitive personal data: exact home addresses, personal phone numbers, personal emails, SSNs, etc.
- You MAY summarize public/professional information about people (jobs, education, public profiles, public business roles).
- Do NOT default to refusing. Only refuse the sensitive categories above.

Output STRICT JSON ONLY with this shape:

{
  "finalAnswer": string,
  "keyFacts": string[],
  "sentences": { "text": string, "citations": number[], "confidence": number }[],
  "disagreements": string[],
  "sources": { "id": number, "title": string, "url": string, "snippet": string }[]
}

Formatting requirements:
- keyFacts: 6–14 bullets, each a single distinct fact, written clearly.
- finalAnswer: 5–10 sentences; must incorporate ALL keyFacts (either explicitly or by direct paraphrase).
- sentences: 6–12 sentence objects; each sentence should be one claim; include citations if any source supports it.
- disagreements: list any conflicts or uncertain claims (including “not enough corroboration”).
- sources: echo back sources that were provided (id/title/url/snippet). Do NOT invent sources.

Citations:
- citations refer only to the provided web source ids (e.g. [1],[2]).
- If there are no web sources, citations should be [].
`;

    const userPrompt = `
USER PROMPT:
${body.prompt}

=== PROVIDER ANSWERS ===
${providerBlock}

=== WEB SOURCES ===
${sourcesBlock}
`;

    const openaiResp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: TEMPERATURE,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const json = await openaiResp.json();

    if (!openaiResp.ok) {
      return NextResponse.json(
        {
          error: `OpenAI meta-summary error ${openaiResp.status}: ${JSON.stringify(
            json
          )}`,
        },
        { status: 500 }
      );
    }

    const text = extractText(json);
    const parsed = parseJsonSafe(text) as MetaSummaryResponse;

    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Meta-summary failed." },
      { status: 500 }
    );
  }
}
