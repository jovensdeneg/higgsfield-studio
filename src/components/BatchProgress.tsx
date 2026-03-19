"use client";

interface BatchSummary {
  completed: number;
  in_progress: number;
  failed: number;
  total: number;
  percent_complete: number;
}

interface BatchProgressProps {
  summary: BatchSummary;
}

export default function BatchProgress({ summary }: BatchProgressProps) {
  const { completed, in_progress, failed, total, percent_complete } = summary;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Progresso do Batch</h3>
        <span className="text-2xl font-bold text-purple-400">
          {Math.round(percent_complete)}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500 ease-out"
          style={{ width: `${Math.min(percent_complete, 100)}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-purple-500" />
          <span className="text-slate-400">
            <span className="font-medium text-slate-200">{completed}</span>{" "}
            {completed === 1 ? "completo" : "completos"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          <span className="text-slate-400">
            <span className="font-medium text-slate-200">{in_progress}</span> em
            progresso
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-slate-400">
            <span className="font-medium text-slate-200">{failed}</span>{" "}
            {failed === 1 ? "falho" : "falhos"}
          </span>
        </div>

        <div className="ml-auto text-slate-500">
          {completed + in_progress + failed} / {total} cenas
        </div>
      </div>
    </div>
  );
}
