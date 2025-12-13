// src/app/components/ProviderToggleGroup.tsx
"use client";

import { ProviderName } from "../lib/types";

const ALL: { id: ProviderName; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Claude" },
  { id: "gemini", label: "Gemini" },
];

interface Props {
  selected: ProviderName[];
  onChange: (providers: ProviderName[]) => void;
}

export default function ProviderToggleGroup({ selected, onChange }: Props) {
  const toggle = (id: ProviderName) => {
    if (selected.includes(id)) {
      onChange(selected.filter((p) => p !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {ALL.map((p) => {
        const active = selected.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            className={`px-3 py-1 rounded-full border text-sm ${
              active ? "bg-black text-white" : "bg-white"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
