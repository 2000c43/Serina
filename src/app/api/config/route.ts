import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ProviderName = "openai" | "anthropic" | "gemini" | "xai";

type ProviderStatus = {
  configured: boolean;
  // For OpenAI we’ll include a safe list of model ids so the UI can only choose valid ones.
  models?: string[];
};

function isSet(v: string | undefined) {
  return typeof v === "string" && v.trim().length > 0;
}

async function listOpenAiModels(apiKey: string): Promise<string[]> {
  const resp = await fetch("https://api.openai.com/v1/models", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    // don’t cache model list across deploys; keep it simple
    cache: "no-store",
  });

  if (!resp.ok) {
    // Don’t leak body; just indicate it failed.
    throw new Error(`OpenAI list models failed: ${resp.status}`);
  }

  const json = (await resp.json()) as { data?: Array<{ id: string }> };
  const ids = (json.data ?? []).map((m) => m.id).filter(Boolean);

  // Keep this list reasonably sized for UI: prefer GPT-5 family + a few common fallbacks.
  const preferred = ids.filter((id) => id.toLowerCase().startsWith("gpt-5"));
  const fallbacks = ids.filter((id) =>
    ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "gpt-4"].some((p) =>
      id.toLowerCase().startsWith(p)
    )
  );

  const merged = [...preferred, ...fallbacks];
  // de-dupe
  return Array.from(new Set(merged));
}

export async function GET() {
  const status: Record<ProviderName, ProviderStatus> = {
    openai: { configured: isSet(process.env.OPENAI_API_KEY) },
    anthropic: { configured: isSet(process.env.ANTHROPIC_API_KEY) },
    gemini: { configured: isSet(process.env.GEMINI_API_KEY) },
    xai: { configured: isSet(process.env.XAI_API_KEY) },
  };

  // OpenAI model list is helpful so we stop guessing about "latest"
  if (status.openai.configured && process.env.OPENAI_API_KEY) {
    try {
      status.openai.models = await listOpenAiModels(process.env.OPENAI_API_KEY);
    } catch {
      // If it fails, still return JSON so UI doesn’t break.
      status.openai.models = [];
    }
  } else {
    status.openai.models = [];
  }

  return NextResponse.json({ ok: true, status });
}
