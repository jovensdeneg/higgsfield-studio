"use client";

import ImprovePromptButton from "./ImprovePromptButton";
import ReferenceImageUpload from "./ReferenceImageUpload";

const DEFAULT_IMAGE_MODELS = [
  { value: "nano-banana-pro", label: "Nano Banana Pro" },
  { value: "flux-pro-kontext-max", label: "Flux Pro Kontext Max" },
  { value: "seedream-v4", label: "Seedream v4" },
];

interface FrameSectionProps {
  title: string;
  prompt: string;
  onPromptChange: (p: string) => void;
  model: string;
  onModelChange: (m: string) => void;
  numVariations: number;
  onNumVariationsChange: (n: number) => void;
  referenceImages: string[];
  onReferenceImagesChange: (urls: string[]) => void;
  disabled?: boolean;
  imageModels?: { value: string; label: string }[];
  referenceImageWarning?: string | null;
}

export default function FrameSection({
  title, prompt, onPromptChange, model, onModelChange,
  numVariations, onNumVariationsChange, referenceImages, onReferenceImagesChange, disabled,
  imageModels, referenceImageWarning,
}: FrameSectionProps) {
  const models = imageModels ?? DEFAULT_IMAGE_MODELS;
  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <h3 className="text-sm font-semibold text-white">{title}</h3>

      {/* Prompt */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-medium text-slate-400">Prompt da cena</label>
          <ImprovePromptButton
            prompt={prompt}
            context="image"
            onImproved={onPromptChange}
            disabled={disabled}
          />
        </div>
        <textarea
          rows={4}
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          disabled={disabled}
          placeholder="Descreva a cena em detalhes... Use @NomePersonagem para incluir um personagem"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
        />
      </div>

      {/* Reference Images */}
      <ReferenceImageUpload
        images={referenceImages}
        onImagesChange={onReferenceImagesChange}
        disabled={disabled}
      />
      {referenceImageWarning && (
        <p className="mt-1 text-xs text-amber-400/80">{referenceImageWarning}</p>
      )}

      {/* Model + Variations row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Modelo</label>
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            disabled={disabled}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
          >
            {models.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Varia\u00e7\u00f5es</label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onNumVariationsChange(n)}
                disabled={disabled}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  numVariations === n
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-700 bg-slate-900 text-slate-400 hover:text-white"
                } disabled:opacity-50`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
