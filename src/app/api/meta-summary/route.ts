// src/app/api/meta-summary/route.ts
import { NextResponse } from "next/server";
import type {
  MetaSummaryResponse,
  ProviderResponse,
  RetrievalSource,
  SummarySentence,
} from "../../lib/types";

type Body = {
  prompt?: string;
  results?: ProviderResponse[];
  sources?: RetrievalSource[];
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

function cleanText(s: unknown): string {
  return String(s ?? "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Extract the first complete JSON object from a string.
 * This survives:
 * - extra text before/after JSON
 * - model output that contains multiple JSON objects
 * - truncation AFTER the first object closes
 */
function extractFirstJsonObject(text: string): string | null {
  const s = text;
  const start = s.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    } else {
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "{") depth++;
      if (ch === "}") depth--;

      if (depth === 0) {
        return s.slice(start, i + 1);
      }
    }
  }

  // No complete object found
  return null;
}

export async function POST(req: Request) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not set on server" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as Body;

    const prompt = cleanText(body.prompt);
    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
    }

    const results: ProviderResponse[] = Array.isArray(body.results) ? body.results : [];
    const sources: RetrievalSource[] = Array.isArray(body.sources) ? body.sources : [];

    // Build a compact evidence pack from providers
    const providerSection = results
      .map((r) => {
        const txt = cleanText(r.text);
        const err = cleanText(r.error);
        const status = err ? `ERROR: ${err}` : txt ? "OK" : "EMPTY";
        return [
          `PROVIDER: ${r.provider}`,
          `MODEL: ${r.model || "n/a"}`,
          `STATUS: ${status}`,
          txt ? `ANSWER:\n${txt}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n---\n\n");

    // Include web sources (optional) – but we will NOT ask model to emit a sources array.
    const sourcesSection =
      sources.length > 0
        ? sources
            .slice(0, 10)
            .map((s) => {
              const id = typeof s.id === "number" ? s.id : 0;
              const title = cleanText(s.title) || "Source";
              const url = cleanText(s.url);
              const snip = cleanText((s as any).snippet);
              return [
                `[${id}] ${title}`,
                url ? url : "",
                snip ? `SNIPPET:\n${snip}` : "",
              ]
                .filter(Boolean)
                .join("\n");
            })
            .join("\n\n")
        : "";

    // System prompt: general-purpose synthesis; no “tuning” to any topic.
    // Key change: DO NOT output "sources" field (we attach sources ourselves).
    const system = `
You are a meta-summarizer for a multi-provider AI app.

GOAL:
Given a user prompt, multiple provider answers, and optional web snippets, produce the best possible final answer.

RULES:
- Do NOT refuse unless the user request is genuinely unsafe or prohibited.
- Answer directly when possible.
- Prefer provider answers over snippets when they conflict.
- If answers conflict, explicitly note the disagreement and choose the most likely correct option.
- Do not invent facts. If unsure, clearly state uncertainty and what would confirm it.
- Write a helpful answer that is NOT overly short.

OUTPUT REQUIREMENTS:
Return STRICT JSON (no markdown) with this schema ONLY:
{
  "finalAnswer": string,                 // 8–12 sentences, readable
  "keyFacts": string[],                  // 6–12 bullets, no duplicates
  "sentences": { "text": string, "citations": number[], "confidence": number }[],
  "disagreements": string[]              // list conflicts/uncertainties
}

CITATIONS:
- citations is an array of web source ids like [1,2].
- If no web snippets were provided, citations should be [].

CONFIDENCE:
- 0..100 integer.

Keep JSON valid. Do NOT include any additional keys.
`.trim();

    const user = `
USER PROMPT:
${prompt}

PROVIDER ANSWERS:
${providerSection || "(none)"}

WEB SOURCES (optional):
${sourcesSection || "(none)"}
`.trim();

    const payload = {
      model: "gpt-5.2",
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] },
      ],
      text: {
        format: { type: "json_object" },
      },
      max_output_tokens: 900,
      temperature: 0.2,
    };

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const raw = await r.text();

    if (!r.ok) {
      return NextResponse.json(
        { error: `OpenAI meta-summary error ${r.status}: ${raw}` },
        { status: 500 }
      );
    }

    // Parse wrapper JSON and extract output_text
    let outputText = "";
    try {
      const parsed = JSON.parse(raw);
      const out = parsed?.output ?? [];
      for (const item of out) {
        const content = item?.content ?? [];
        for (const c of content) {
          if (c?.type === "output_text" && typeof c?.text === "string") {
            outputText += c.text;
          }
        }
      }
      outputText = cleanText(outputText);
    } catch (e: any) {
      return NextResponse.json(
        {
          error: `Failed to parse Responses API wrapper JSON: ${String(e?.message || e)}\nRAW:\n${raw}`,
        },
        { status: 500 }
      );
    }

    if (!outputText) {
      return NextResponse.json(
        { error: "Meta-summary returned empty output_text." },
        { status: 500 }
      );
    }

    // Extract the first complete JSON object (robust to extra text or truncation later)
    const extracted = extractFirstJsonObject(outputText);
    if (!extracted) {
      return NextResponse.json(
        { error: `Meta-summary did not contain a complete JSON object.\nTEXT:\n${outputText}` },
        { status: 500 }
      );
    }

    let outObj: any;
    try {
      outObj = JSON.parse(extracted);
    } catch (e: any) {
      return NextResponse.json(
        {
          error: `Meta-summary did not return valid JSON: ${String(e?.message || e)}\nTEXT:\n${extracted}`,
        },
        { status: 500 }
      );
    }

    // Normalize
    const finalAnswer = cleanText(outObj.finalAnswer);

    const keyFacts = Array.isArray(outObj.keyFacts)
      ? outObj.keyFacts.map(cleanText).filter(Boolean).slice(0, 20)
      : [];

    const disagreements = Array.isArray(outObj.disagreements)
      ? outObj.disagreements.map(cleanText).filter(Boolean).slice(0, 20)
      : [];

    const sentences: SummarySentence[] = Array.isArray(outObj.sentences)
      ? outObj.sentences
          .map((s: any) => ({
            text: cleanText(s?.text),
            citations: Array.isArray(s?.citations)
              ? s.citations
                  .filter((n: any) => Number.isFinite(n))
                  .map((n: any) => Number(n))
              : [],
            confidence: clamp(Number(s?.confidence ?? 0), 0, 100),
          }))
          .filter((s: SummarySentence) => s.text.length > 0)
          .slice(0, 40)
      : [];

    // Attach sources from input (authoritative), not from the model
    const normalizedSources: RetrievalSource[] = sources.map((s) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      snippet: (s as any).snippet,
    }));

    const response: MetaSummaryResponse = {
      finalAnswer: finalAnswer || "(No answer returned.)",
      keyFacts,
      sentences,
      disagreements,
      sources: normalizedSources,
    };

    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json(
      { error: `meta-summary route error: ${String(err?.message || err)}` },
      { status: 500 }
    );
  }
}
