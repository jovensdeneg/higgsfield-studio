"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Papa from "papaparse";

const EXPECTED_COLUMNS = [
  "asset_code",
  "scene",
  "description",
  "asset_type",
  "image_tool",
  "video_tool",
  "prompt_image",
  "prompt_video",
  "duration",
];

interface CsvRow {
  asset_code: string;
  scene: string;
  description: string;
  asset_type: string;
  image_tool: string;
  video_tool: string;
  prompt_image: string;
  prompt_video: string;
  duration: string;
  notes: string;
  [key: string]: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRawText, setCsvRawText] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<CsvRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const validateAndParse = useCallback((file: File) => {
    setCsvFile(file);
    setCsvRawText("");
    setParseErrors([]);
    setParsedRows([]);

    // Read raw text to send to backend
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvRawText((ev.target?.result as string) ?? "");
    };
    reader.readAsText(file);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const errors: string[] = [];

        // Check columns
        const headers = results.meta.fields ?? [];
        const missing = EXPECTED_COLUMNS.filter(
          (col) => !headers.includes(col)
        );
        if (missing.length > 0) {
          errors.push(`Colunas ausentes: ${missing.join(", ")}`);
        }

        // Check rows
        const rows = results.data;
        if (rows.length === 0) {
          errors.push("O CSV nao contem nenhuma linha de dados.");
        }

        rows.forEach((row, i) => {
          if (!row.asset_code?.trim()) {
            errors.push(`Linha ${i + 2}: asset_code vazio`);
          }
          if (!row.scene?.trim()) {
            errors.push(`Linha ${i + 2}: scene vazio`);
          }
        });

        // Cap error display
        if (errors.length > 10) {
          const total = errors.length;
          errors.length = 10;
          errors.push(`...e mais ${total - 10} erros`);
        }

        setParseErrors(errors);
        if (errors.length === 0) {
          setParsedRows(rows);
        }
      },
      error(err) {
        setParseErrors([`Erro ao ler CSV: ${err.message}`]);
      },
    });
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
      validateAndParse(file);
    } else {
      setParseErrors(["Apenas arquivos .csv sao aceitos."]);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      validateAndParse(file);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (parsedRows.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          csv: csvRawText,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Erro ${res.status}`);
      }

      const data = await res.json();
      router.push(`/projects/${data.project?.id ?? data.id}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Erro ao criar projeto"
      );
    } finally {
      setSubmitting(false);
    }
  }

  const nameValid = name.trim().length > 0;
  const csvValid = parsedRows.length > 0 && parseErrors.length === 0;
  const canSubmit = nameValid && csvValid && !submitting;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/projects"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-purple-400"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
            />
          </svg>
          Voltar para Projetos
        </Link>
        <h1 className="text-2xl font-bold text-white">Novo Projeto</h1>
        <p className="mt-1 text-sm text-slate-400">
          Importe um CSV com os assets do video para criar um novo projeto.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Name */}
        <div>
          <label
            htmlFor="project-name"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            Nome do Projeto
          </label>
          <input
            id="project-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Video Institucional 2026"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
          {name.length > 0 && !nameValid && (
            <p className="mt-1.5 text-xs text-red-400">
              O nome do projeto nao pode estar vazio.
            </p>
          )}
        </div>

        {/* CSV Upload */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Arquivo CSV
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragActive
                ? "border-purple-500 bg-purple-500/5"
                : csvFile
                ? "border-slate-600 bg-slate-900"
                : "border-slate-700 bg-slate-900/50 hover:border-slate-600"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileSelect}
              className="hidden"
            />

            {csvFile ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/15">
                  <svg
                    className="h-6 w-6 text-purple-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-white">{csvFile.name}</p>
                <p className="text-xs text-slate-400">
                  {parsedRows.length > 0
                    ? `${parsedRows.length} assets encontrados`
                    : "Processando..."}
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCsvFile(null);
                    setCsvRawText("");
                    setParsedRows([]);
                    setParseErrors([]);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="mt-1 text-xs text-slate-500 underline hover:text-slate-300"
                >
                  Trocar arquivo
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800">
                  <svg
                    className="h-6 w-6 text-slate-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-300">
                  Arraste o CSV aqui ou clique para selecionar
                </p>
                <p className="text-xs text-slate-500">
                  Formato: asset_code, scene, description, asset_type, ...
                </p>
              </div>
            )}
          </div>

          {/* Parse Errors */}
          {parseErrors.length > 0 && (
            <div className="mt-3 rounded-lg border border-red-800/50 bg-red-900/20 p-4">
              <p className="mb-2 text-xs font-semibold text-red-400">
                Erros encontrados:
              </p>
              <ul className="space-y-1">
                {parseErrors.map((err, i) => (
                  <li key={i} className="text-xs text-red-300">
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Preview Table */}
        {parsedRows.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-medium text-slate-300">
              Preview ({parsedRows.length} assets)
            </h3>
            <div className="overflow-hidden rounded-xl border border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900">
                      <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-400">
                        Asset Code
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-400">
                        Cena
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-400">
                        Tipo
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-400">
                        Descricao
                      </th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-400">
                        Duracao
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {parsedRows.slice(0, 20).map((row, i) => (
                      <tr
                        key={i}
                        className="bg-slate-950/50 transition-colors hover:bg-slate-900/50"
                      >
                        <td className="whitespace-nowrap px-4 py-2.5 font-medium text-white">
                          {row.asset_code}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-300">
                          {row.scene}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5">
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                            {row.asset_type || "-"}
                          </span>
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-2.5 text-slate-400">
                          {row.description || "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-400">
                          {row.duration ? `${row.duration}s` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 20 && (
                <div className="border-t border-slate-800 bg-slate-900/50 px-4 py-2 text-center text-xs text-slate-500">
                  Mostrando 20 de {parsedRows.length} assets
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit Error */}
        {submitError && (
          <div className="rounded-lg border border-red-800/50 bg-red-900/20 p-4">
            <p className="text-xs text-red-400">{submitError}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-6">
          <Link
            href="/projects"
            className="rounded-lg border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Criando...
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                Criar Projeto
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
