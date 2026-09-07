import type { ReactNode } from "react";

import { SurfaceCard } from "@/components/common/SurfaceCard";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <SurfaceCard className="px-6 py-10 text-center">
      <div className="mx-auto max-w-sm space-y-3">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">暂无结果</p>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="text-sm leading-6 text-slate-500">{description}</p>
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </SurfaceCard>
  );
}
