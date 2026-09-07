import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  tone: "blue" | "green" | "amber" | "red" | "slate";
  label: string;
};

const toneClasses: Record<StatusBadgeProps["tone"], string> = {
  blue: "bg-sky-100 text-sky-700 border-sky-200",
  green: "bg-emerald-100 text-emerald-700 border-emerald-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  red: "bg-rose-100 text-rose-700 border-rose-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

export function StatusBadge({ tone, label }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        toneClasses[tone],
      )}
    >
      {label}
    </span>
  );
}
