import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const serverKeys = {
      openai: Boolean(process.env.OPENAI_API_KEY),
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      gemini: Boolean(process.env.GEMINI_API_KEY),
      xai: Boolean(process.env.XAI_API_KEY),
      tavily: Boolean(process.env.TAVILY_API_KEY),
    };

    return NextResponse.json({ ok: true, serverKeys }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e), serverKeys: {} },
      { status: 200 }
    );
  }
}
