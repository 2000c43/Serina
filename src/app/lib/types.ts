export type ProviderName = "openai" | "anthropic" | "gemini" | "xai";

export interface ProviderRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderResponse {
  provider: ProviderName;
  model: string;
  text: string;
  latencyMs: number;
  error?: string;
}

export interface ProviderConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export type ProviderConfigMap = Record<ProviderName, ProviderConfig>;

export interface AiProvider {
  name: ProviderName;
  call(req: ProviderRequest, apiKey: string): Promise<ProviderResponse>;
}

/** Retrieval source (optional) */
export interface RetrievalSource {
  id: number; // 1-based
  title?: string;
  url?: string;
  snippet?: string;
}

/** Structured summary output */
export interface SummarySentence {
  text: string;
  citations: number[]; // [1,2,5] etc
  confidence: number; // 0..100
}

export interface MetaSummaryResponse {
  finalAnswer: string; // still present for legacy UI
  keyFacts: string[];
  sentences: SummarySentence[];
  disagreements: string[];
  sources: RetrievalSource[];
}

/** Run history */
export interface RunRecord {
  id: string;
  ts: number;
  prompt: string;
  providers: ProviderName[];
  results: ProviderResponse[];
  meta: MetaSummaryResponse | null;
}
