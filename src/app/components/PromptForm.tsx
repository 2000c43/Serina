// src/app/components/PromptForm.tsx
"use client";

import { useState, FormEvent } from "react";
import { ProviderName } from "../lib/types";
import ProviderToggleGroup from "./ProviderToggleGroup";

interface Props {
  onSubmit: (prompt: string) => void;
  selectedProviders: ProviderName[];
  setSelectedProviders: (p: ProviderName[]) => void;
  loading?: boolean;
}

export default function PromptForm({
  onSubmit,
  selectedProviders,
  setSelectedProviders,
  loading = false,
}: Props) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    onSubmit(prompt.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        className="w-full border rounded-md p-2 min-h-[100px]"
        placeholder="Ask once. Compare across providers..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <div className="flex items-center justify-between gap-2">
        <ProviderToggleGroup
          selected={selectedProviders}
          onChange={setSelectedProviders}
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-md border font-medium text-sm"
          disabled={loading || !prompt.trim() || !selectedProviders.length}
        >
          {loading ? "Running…" : "Run"}
        </button>
      </div>
    </form>
  );
}
