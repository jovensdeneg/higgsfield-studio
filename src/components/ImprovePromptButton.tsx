"use client";

import { useState } from "react";

interface ImprovePromptButtonProps {
  prompt: string;
  context: "image" | "video";
  onImproved: (improvedPrompt: string) => void;
  disabled?: boolean;
}

export default function ImprovePromptButton({ prompt, context, onImproved, disabled }: ImprovePromptButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImprove() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/improve-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), context }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.improved_prompt) {
        onImproved(data.improved_prompt);
      } else {
        setError(data.error || `Erro ${res.status}: Falha ao melhorar prompt`);
      }
    } catch {
      setError("Erro de rede ao chamar a API");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleImprove}
        disabled={disabled || loading || !prompt.trim()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
        ) : (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
          </svg>
        )}
        {loading ? "Melhorando..." : "\u2728 Melhorar com IA"}
      </button>
      {error && (
        <p className="max-w-xs text-[10px] text-red-400">{error}</p>
      )}
    </div>
  );
}
