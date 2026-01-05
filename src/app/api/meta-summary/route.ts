// src/app/api/meta-summary/route.ts
import { NextResponse } from "next/server";
import type {
  MetaSummaryResponse,
  ProviderResponse,
  RetrievalSource,
} from "../../lib/types";

type MetaSummaryRequestBody = {
  prompt?: string;
  results?: ProviderResponse[];
  sources?: RetrievalSource[]; // optional
  // optional override for demo/dev; prefer server env key in prod
  openaiApiKey?: string;
};

export const runtime = "nodejs"; // avoid edge streaming quirks for JSON

const MODEL_DEFAULT = "gpt-5.2";
const TEMPERATURE_DEFAULT = 0.2;
const MAX_OUTPUT_TOKENS = 3200;

function extractOutputText(respJson: any): string {
  if (typeof respJson?.output_text === "string" && respJson.output_text.trim()) {
    return respJson.output_text.trim();
  }

  const output = respJson?.output;
  if (!Array.isArray(output)) return "";

  const chunks: string[] = [];
  for (const item of output) {
    const content = item?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      const t = c?.text;
      if (typeof t === "string" && t.trim()) chunks.push(t);
    }
  }
  return chunks.join("\n").trim();
}

function safeParsePossiblyTruncatedJson(raw: string) {
  const text = (raw || "").trim();

  const lastBrace = text.lastIndexOf("}");
  if (lastBrace === -1) {
    throw new Error("Meta-summary did not return a JSON object.");
  }

  const candidate = text.slice(0, lastBrace + 1);

  try {
    return JSON.parse(candidate);
  } catch (e: any) {
    const preview = candidate.slice(0, 2000);
    const msg = e?.message ? String(e.message) : "JSON parse error";
    throw new Error(
      `Meta-summary did not return valid JSON: ${msg}\nTEXT PREVIEW:\n${preview}`
    );
  }
}

function buildJsonSchema() {
  // IMPORTANT:
  // OpenAI strict json_schema requires `required` to include EVERY key in `properties`
  // when additionalProperties:false. So we require all fields and allow empty strings.
  return {
    name: "serina_meta_summary",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        finalAnswer: { type: "string" },
        keyFacts: {
          type: "array",
          items: { type: "string" },
        },
        sentences: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              text: { type: "string" },
              citations: {
                type: "array",
                items: { type: "number" },
              },
              confidence: { type: "number" },
            },
            required: ["text", "citations", "confidence"],
          },
        },
        disagreements: {
          type: "array",
          items: { type: "string" },
        },
        sources: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "number" },
              title: { type: "string" },
              url: { type: "string" },
              snippet: { type: "string" },
            },
            // Strict requires ALL keys listed here:
            required: ["id", "title", "url", "snippet"],
          },
        },
      },
      required: ["finalAnswer", "keyFacts", "sentences", "disagreements", "sources"],
    },
  };
}

function buildSystemPrompt(): string {
  return [
    "You are Serina’s meta-summarizer.",
    "You will receive: (a) user prompt, (b) multiple provider answers, and optionally (c) web retrieval sources.",
    "",
    "Goals:",
    "1) Produce a clear, accurate, helpful answer that synthesizes the BEST information across providers and sources.",
    "2) Capture UNIQUE facts: if one provider mentions a unique detail that seems relevant, include it unless it is clearly wrong.",
    "3) Identify meaningful disagreements/conflicts between sources/providers in 'disagreements'.",
    "4) Keep 'finalAnswer' readable: do NOT include bracket citations like [1] in finalAnswer.",
    "",
    "Output formatting requirements:",
    "- Return STRICT JSON matching the provided JSON schema.",
    "- finalAnswer should be ~8–14 sentences when there is ample information; shorter only if information is truly limited.",
    "- keyFacts should be 8–15 bullets when there is ample information; fewer if limited.",
    "- sentences should be 6–12 items. Each sentence should map to citations by source id when applicable.",
    "- Use citations only when the sentence is supported by the provided sources list; otherwise citations: [].",
    "",
    "IMPORTANT ABOUT sources[]:",
    "- Each sources[] item MUST include id,title,url,snippet (all fields required).",
    "- If any of title/url/snippet is unknown, set it to the empty string \"\".",
  ].join("\n");
}

function buildUserPrompt(
  prompt: string,
  results: ProviderResponse[],
  sources: RetrievalSource[] | undefined
): string {
  const providerBlock = (results || [])
    .map((r) => {
      const header = `PROVIDER: ${r.provider} | model: ${r.model || "(unknown)"} | latencyMs: ${r.latencyMs}`;
      const body = r.error ? `ERROR: ${r.error}` : (r.text || "").trim() || "(empty)";
      return `${header}\n${body}`;
    })
    .join("\n\n---\n\n");

  const sourcesBlock =
    Array.isArray(sources) && sources.length
      ? sources
          .map((s) => {
            const title = s.title ? s.title : "Source";
            const url = s.url ? s.url : "";
            const snippet = (s.snippet || "").trim();
            return `[${s.id}] ${title}\n${url}\n${snippet}`;
          })
          .join("\n\n")
      : "(no retrieval sources provided)";

  return [
    `USER PROMPT:\n${prompt}`,
    "",
    "WEB SOURCES:",
    sourcesBlock,
    "",
    "PROVIDER ANSWERS:",
    providerBlock,
  ].join("\n");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MetaSummaryRequestBody;

    const prompt = (body.prompt || "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
    }

    const results = Array.isArray(body.results) ? body.results : [];
    const sources = Array.isArray(body.sources) ? body.sources : [];

    const openaiKey =
      (process.env.OPENAI_API_KEY || "").trim() || (body.openaiApiKey || "").trim();

    if (!openaiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set on server (and no openaiApiKey provided)." },
        { status: 500 }
      );
    }

    const schema = buildJsonSchema();
    const system = buildSystemPrompt();
    const user = buildUserPrompt(prompt, results, sources);

    const payload = {
      model: MODEL_DEFAULT,
      temperature: TEMPERATURE_DEFAULT,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      text: {
        format: {
          type: "json_schema",
          name: schema.name,
          schema: schema.schema,
          strict: schema.strict,
        },
      },
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] },
      ],
    };

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const errText = await r.text();
      return NextResponse.json(
        { error: `OpenAI meta-summary error ${r.status}: ${errText}` },
        { status: 500 }
      );
    }

    const respJson = await r.json();
    const rawText = extractOutputText(respJson);

    if (!rawText) {
      return NextResponse.json({ error: "Meta-summary returned empty text." }, { status: 500 });
    }

    const parsed = safeParsePossiblyTruncatedJson(rawText) as MetaSummaryResponse;

    parsed.keyFacts = Array.isArray(parsed.keyFacts) ? parsed.keyFacts : [];
    parsed.sentences = Array.isArray(parsed.sentences) ? parsed.sentences : [];
    parsed.disagreements = Array.isArray(parsed.disagreements) ? parsed.disagreements : [];
    parsed.sources = Array.isArray(parsed.sources) ? parsed.sources : [];

    return NextResponse.json(parsed);
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
