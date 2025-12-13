// /Users/dean/ai-meta-client/src/app/lib/search.ts

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
};

export type WebSnippet = {
  id: number; // 1-based
  title: string;
  url: string;
  content: string;
};

export async function fetchWebSnippets(
  query: string,
  opts?: { enabled?: boolean; maxResults?: number }
): Promise<WebSnippet[]> {
  const enabled = opts?.enabled ?? true;
  const maxResults = opts?.maxResults ?? 5;

  if (!enabled) return [];

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("TAVILY_API_KEY is not set; skipping web retrieval.");
    return [];
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        search_depth: "basic",
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
    const results: TavilyResult[] = Array.isArray(json?.results)
      ? json.results
      : [];

    const snippets: WebSnippet[] = results
      .map((r, idx) => ({
        id: idx + 1,
        title: (r.title ?? "").toString().trim() || `Source ${idx + 1}`,
        url: (r.url ?? "").toString().trim() || "",
        content: (r.content ?? "").toString().trim() || "",
      }))
      .filter((s) => s.content.length > 0);

    return snippets;
  } catch (e: any) {
    console.warn("Tavily search exception:", e?.message ?? e);
    return [];
  }
}
