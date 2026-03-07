"use client";

import { useState, useRef, useCallback } from "react";

interface PhotoUploadZoneProps {
  characterId: string;
  onUploadComplete: () => void;
  disabled?: boolean;
}

export default function PhotoUploadZone({ characterId, onUploadComplete, disabled }: PhotoUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || uploading) return;
    setUploading(true);

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("photos", files[i]);
      setProgress(`Preparando ${i + 1}/${files.length}...`);
    }

    try {
      setProgress(`Enviando ${files.length} foto(s)...`);
      const res = await fetch(`/api/characters/${characterId}/photos`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        onUploadComplete();
        setProgress("");
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Falha ao enviar fotos");
      }
    } catch {
      alert("Erro de rede ao enviar fotos");
    } finally {
      setUploading(false);
      setProgress("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [characterId, uploading, onUploadComplete]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
      onClick={() => !disabled && !uploading && fileRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors ${
        dragOver
          ? "border-emerald-500 bg-emerald-500/5"
          : "border-slate-700 hover:border-slate-600"
      } ${disabled || uploading ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {uploading ? (
        <>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
          <p className="text-sm text-slate-400">{progress}</p>
        </>
      ) : (
        <>
          <svg className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-300">Arraste fotos aqui ou clique para selecionar</p>
            <p className="mt-1 text-xs text-slate-500">JPG, PNG -- m\u00faltiplas fotos de uma vez</p>
          </div>
        </>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
        disabled={disabled || uploading}
      />
    </div>
  );
}
