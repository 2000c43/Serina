import { NextResponse } from "next/server";
import type { ProviderResponse, ProviderName } from "../../lib/types";

export const runtime = "nodejs";

type Body = {
  originalPrompt?: string;
  results?: ProviderResponse[];
  apiKeys?: Partial<Record<ProviderName, string>>;
  providerConfigs?: any;
  summarizerProvider?: ProviderName; // unused for now; we summarize with OpenAI if key exists
};

function safeString(x: unknown) {
  return typeof x === "string" ? x : "";
}

function normalizeSentence(s: string) {
  return s
    .trim()
    .replace(/\s+/g, " ")
    // normalize quotes/dashes
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[–—]/g, "-")
    // drop bracket-style citations like [S1] or [1]
    .replace(/\[\s*[A-Za-z]?\d+\s*\]/g, "")
    .trim();
}

function splitIntoSentences(text: string): string[] {
  const cleaned = text
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")
    .replace(/\n/g, " ");

  // naive but solid for our use: split on ". " / "? " / "! "
  const parts = cleaned.split(/(?<=[.?!])\s+(?=[A-Z0-9"'])/g);
  return parts.map(normalizeSentence).filter((s) => s.length >= 20);
}

function jaccard(a: string, b: string) {
  const A = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const B = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const inter = [...A].filter((x) => B.has(x)).length;
  const uni = new Set([...A, ...B]).size;
  return uni === 0 ? 0 : inter / uni;
}

type Fact = {
  id: string;
  text: string;
  providers: ProviderName[];
};

function buildFacts(results: ProviderResponse[]): Fact[] {
  const facts: Fact[] = [];
  const threshold = 0.72; // similarity threshold for merging

  for (const r of results) {
    const provider = r.provider as ProviderName;
    const text = safeString(r.text);
    if (!text.trim() || r.error) continue;

    const sents = splitIntoSentences(text);

    for (const s of sents) {
      // skip obviously meta / filler
      const lower = s.toLowerCase();
      if (
        lower.startsWith("based on the information provided") ||
        lower.startsWith("based on the web sources") ||
        lower.includes("would you like to know more")
      ) {
        continue;
      }

      // Try to merge into existing fact
      let merged = false;
      for (const f of facts) {
        if (jaccard(f.text, s) >= threshold) {
          if (!f.providers.includes(provider)) f.providers.push(provider);
          merged = true;
          break;
        }
      }

      if (!merged) {
        facts.push({
          id: `f${facts.length + 1}`,
          text: s,
          providers: [provider],
        });
      }
    }
  }

  // Sort: most-supported first, then longer (often more specific)
  facts.sort((a, b) => {
    const d = b.providers.length - a.providers.length;
    if (d !== 0) return d;
    return b.text.length - a.text.length;
  });

  return facts.slice(0, 40); // keep prompt bounded
}

function fallbackSummary(originalPrompt: string, results: ProviderResponse[]): string {
  const facts = buildFacts(results);
  const lines: string[] = [];
  lines.push(`Prompt: ${originalPrompt}`);
  lines.push("");

  if (facts.length === 0) {
    lines.push("No usable provider text returned to summarize.");
    const errs = results.filter((r) => r.error).map((r) => `- ${r.provider}: ${r.error}`);
    if (errs.length) lines.push("", "Errors:", ...errs);
    return lines.join("\n");
  }

  lines.push("Key facts (deduped):");
  for (const f of facts.slice(0, 12)) {
    lines.push(`- ${f.text} (from: ${f.providers.join(", ")})`);
  }

  const unique = facts.filter((f) => f.providers.length === 1).slice(0, 8);
  if (unique.length) {
    lines.push("");
    lines.push("Unique details (single-source):");
    for (const f of unique) {
      lines.push(`- ${f.text} (from: ${f.providers[0]})`);
    }
  }

  return lines.join("\n");
}

async function openAiSummarize(args: {
  apiKey: string;
  originalPrompt: string;
  results: ProviderResponse[];
}) {
  const { apiKey, originalPrompt, results } = args;

  const facts = buildFacts(results);

  // Separate consensus vs unique facts
  const consensus = facts.filter((f) => f.providers.length >= 2).slice(0, 14);
  const unique = facts.filter((f) => f.providers.length === 1).slice(0, 14);

  const payload = {
    model: "gpt-5.2",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "You are a synthesis engine for a multi-provider AI meta-search app.\n" +
              "Goal: produce an answer that MOVES FORWARD:\n" +
              "- Keep it readable and non-repetitive.\n" +
              "- Include ALL important unique facts, not just consensus.\n" +
              "- If a fact is only in one provider, include it but phrase cautiously (e.g., 'One source reports…').\n" +
              "- If providers conflict, explicitly mention the conflict.\n" +
              "- Do NOT show bracket citations like [1] or [S1].\n" +
              "- Do NOT show confidence percentages.\n" +
              "\n" +
              "Output format:\n" +
              "1) Final answer (6–10 sentences)\n" +
              "2) Extra details (bullets, include the most useful single-source facts)\n" +
              "3) Conflicts / uncertainties (bullets; 'none' if none)\n",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              `USER PROMPT:\n${originalPrompt}\n\n` +
              `CONSENSUS FACTS (appear in 2+ providers):\n` +
              consensus.map((f) => `- ${f.text} (providers: ${f.providers.join(", ")})`).join("\n") +
              `\n\nUNIQUE FACTS (single provider; include cautiously if relevant):\n` +
              unique.map((f) => `- ${f.text} (provider: ${f.providers[0]})`).join("\n"),
          },
        ],
      },
    ],
    temperature: 0.2,
    max_output_tokens: 900,
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(`OpenAI meta-summary error ${res.status}: ${raw}`);

  const json = JSON.parse(raw);
  const out =
    typeof json?.output_text === "string"
      ? json.output_text
      : (json?.output ?? [])
          .flatMap((o: any) => o?.content ?? [])
          .filter((c: any) => c?.type === "output_text")
          .map((c: any) => c?.text ?? "")
          .join("");

  return (out || "").trim();
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const originalPrompt = safeString(body.originalPrompt).trim();
  const results = Array.isArray(body.results) ? body.results : [];
  const apiKeys = body.apiKeys ?? {};

  if (!originalPrompt) {
    return NextResponse.json({ ok: false, error: "Missing originalPrompt" }, { status: 400 });
  }

  if (results.length === 0) {
    return NextResponse.json(
      { ok: true, summary: "No provider results were returned, so there is nothing to summarize." },
      { status: 200 }
    );
  }

  const openAiKey = apiKeys.openai;

  // Prefer OpenAI summarizer if available; otherwise deterministic fallback
  if (openAiKey && typeof openAiKey === "string" && openAiKey.trim().length > 0) {
    try {
      const summary = await openAiSummarize({
        apiKey: openAiKey.trim(),
        originalPrompt,
        results,
      });
      return NextResponse.json({ ok: true, summary }, { status: 200 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const summary = fallbackSummary(originalPrompt, results);
      return NextResponse.json(
        { ok: true, summary: `${summary}\n\n(meta-summary fallback due to error: ${msg})` },
        { status: 200 }
      );
    }
  }

  return NextResponse.json({ ok: true, summary: fallbackSummary(originalPrompt, results) }, { status: 200 });
}
