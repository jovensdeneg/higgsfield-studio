"use client";

import { useState, useRef } from "react";

interface ReferenceImageUploadProps {
  images: string[];
  onImagesChange: (urls: string[]) => void;
  maxImages?: number;
  disabled?: boolean;
  label?: string;
}

export default function ReferenceImageUpload({ images, onImagesChange, maxImages = 5, disabled, label = "Imagens de Refer\u00eancia" }: ReferenceImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || uploading) return;
    const remaining = maxImages - images.length;
    if (remaining <= 0) return;

    setUploading(true);
    const newUrls: string[] = [];

    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const formData = new FormData();
      formData.append("file", files[i]);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          if (data.url) newUrls.push(data.url);
        }
      } catch { /* skip failed uploads */ }
    }

    if (newUrls.length > 0) {
      onImagesChange([...images, ...newUrls]);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeImage(index: number) {
    const updated = images.filter((_, i) => i !== index);
    onImagesChange(updated);
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-400">{label} ({images.length}/{maxImages})</label>

      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, i) => (
            <div key={i} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-700">
              <img src={url} alt={`Ref ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      {images.length < maxImages && (
        <div
          onClick={() => !disabled && !uploading && fileRef.current?.click()}
          className={`flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-700 p-3 text-xs text-slate-500 transition-colors hover:border-slate-600 hover:text-slate-400 ${
            disabled || uploading ? "cursor-not-allowed opacity-50" : ""
          }`}
        >
          {uploading ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
              Enviando...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              Clique para adicionar refer\u00eancias
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={disabled || uploading}
          />
        </div>
      )}
    </div>
  );
}
