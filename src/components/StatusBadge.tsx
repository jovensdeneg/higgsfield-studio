"use client";

type SceneStatus =
  | "images_generated"
  | "approved"
  | "video_submitted"
  | "completed";

interface StatusBadgeProps {
  status: string;
}

const STATUS_CONFIG: Record<
  SceneStatus,
  { label: string; bg: string; text: string; ring: string }
> = {
  images_generated: {
    label: "Imagens Geradas",
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    ring: "ring-blue-500/30",
  },
  approved: {
    label: "Aprovada",
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    ring: "ring-amber-500/30",
  },
  video_submitted: {
    label: "V\u00eddeo Enviado",
    bg: "bg-purple-500/15",
    text: "text-purple-400",
    ring: "ring-purple-500/30",
  },
  completed: {
    label: "Completa",
    bg: "bg-purple-500/15",
    text: "text-purple-400",
    ring: "ring-purple-500/30",
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status as SceneStatus];

  if (!config) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-700/50 text-slate-400 ring-1 ring-inset ring-slate-600/30">
        {status}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${config.bg} ${config.text} ${config.ring}`}
    >
      {config.label}
    </span>
  );
}
