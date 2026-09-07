import type { PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

type SurfaceCardProps = PropsWithChildren<{
  className?: string;
}>;

export function SurfaceCard({ children, className }: SurfaceCardProps) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-cyan-100/80 bg-white/82 shadow-[0_24px_80px_rgba(19,109,240,0.08)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </section>
  );
}
