import type { PropsWithChildren, ReactNode } from "react";

import { X } from "lucide-react";

type ModalProps = PropsWithChildren<{
  open: boolean;
  title: string;
  description?: string;
  footer?: ReactNode;
  onClose: () => void;
}>;

export function Modal({ open, title, description, footer, onClose, children }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 py-8 backdrop-blur-md">
      <div className="w-full max-w-3xl rounded-[32px] border border-white/65 bg-white/90 shadow-[0_32px_120px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between border-b border-slate-200/80 px-6 py-5">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
            {description ? <p className="text-sm text-slate-500">{description}</p> : null}
          </div>
          <button
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-6">{children}</div>
        {footer ? <div className="border-t border-slate-200/80 px-6 py-5">{footer}</div> : null}
      </div>
    </div>
  );
}
