"use client";

import { MetaSummaryResponse } from "../lib/types";

export default function SummaryView({ meta }: { meta: MetaSummaryResponse }) {
  // Display-only: no citation markers, no confidence badges.
  // (We still keep them in meta for internal logic and future “show sources” UI.)
  const finalText =
    meta.sentences?.length > 0
      ? meta.sentences.map((s) => s.text).join(" ")
      : meta.finalAnswer ?? "";

  return (
    <div className="border rounded p-3 text-sm">
      <div className="font-semibold mb-2">Final answer</div>

      <div className="leading-6 whitespace-pre-wrap">
        {finalText?.trim() ? (
          finalText
        ) : (
          <span className="opacity-60">No summary yet.</span>
        )}
      </div>

      {meta.disagreements?.length > 0 && (
        <div className="mt-4">
          <div className="font-semibold mb-1">Why models disagree</div>
          <ul className="list-disc pl-5 text-sm">
            {meta.disagreements.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
