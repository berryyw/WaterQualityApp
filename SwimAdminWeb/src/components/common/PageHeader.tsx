import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.28em] text-sky-500">{eyebrow}</p>
        <div className="space-y-1">
          <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-slate-900">{title}</h1>
          <p className="max-w-2xl text-sm text-slate-500">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
