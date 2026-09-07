import { ArrowRight, Mail, QrCode } from "lucide-react";
import { useState } from "react";

import { SurfaceCard } from "@/components/common/SurfaceCard";
import { useAuthStore } from "@/stores/auth-store";

export function LoginPage() {
  const login = useAuthStore((state) => state.login);
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    const result = await login(account.trim(), password.trim());
    setFeedback(result.message);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.24),_transparent_20%),radial-gradient(circle_at_80%_15%,_rgba(37,99,235,0.3),_transparent_24%),radial-gradient(circle_at_50%_100%,_rgba(14,165,233,0.18),_transparent_35%),linear-gradient(180deg,_#f4faff_0%,_#ebf5ff_42%,_#f7fbff_100%)] px-4 py-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[1400px] items-center gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="relative px-6 lg:px-16">
          <div className="absolute left-10 top-14 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(34,211,238,0.38),_transparent_68%)] blur-3xl" />
          <div className="relative max-w-2xl space-y-8">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="absolute -inset-6 rounded-[40px] border border-cyan-300/30" />
                <div className="absolute inset-0 rounded-[32px] bg-[radial-gradient(circle_at_50%_50%,_rgba(56,189,248,0.24),_transparent_68%)] blur-2xl" />
                <div className="relative overflow-hidden rounded-[32px] shadow-[0_28px_70px_rgba(19,152,255,0.28)]">
                  <img
                    alt="泳池水质通 Logo"
                    className="h-28 w-28 rounded-[32px] object-cover"
                    src="/brand/icon-1024.png"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h1 className="bg-[linear-gradient(135deg,_#0f172a_0%,_#1d4ed8_46%,_#06b6d4_100%)] bg-clip-text text-5xl font-semibold tracking-[-0.065em] text-transparent lg:text-6xl">
                  泳池水质通运营后台
                </h1>
                <p className="max-w-lg text-base leading-7 text-slate-500">好水质，好运动</p>
              </div>
            </div>

            <div className="grid gap-4 pt-2 md:grid-cols-2">
              <SurfaceCard className="border-cyan-100/80 bg-white/78 px-5 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#2563eb_0%,_#06b6d4_100%)] text-white">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">APP 下载</p>
                    <p className="text-sm text-slate-500">占位入口</p>
                  </div>
                </div>
                <div className="mt-4 grid h-36 place-items-center rounded-[24px] border border-dashed border-sky-200 bg-[linear-gradient(180deg,_rgba(255,255,255,0.9),_rgba(235,246,255,0.92))] text-center">
                  <div>
                    <p className="text-sm font-medium text-slate-800">二维码占位</p>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.28em] text-slate-400">download later</p>
                  </div>
                </div>
              </SurfaceCard>

              <SurfaceCard className="border-cyan-100/80 bg-white/78 px-5 py-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-sky-700">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">联系运营</p>
                      <p className="text-sm text-slate-500">邮箱入口</p>
                    </div>
                  </div>
                  <a
                    className="block rounded-2xl border border-sky-100 bg-white/90 px-4 py-3 text-sm text-slate-700 transition hover:border-sky-200 hover:bg-sky-50"
                    href="mailto:david061939@hotmail.com"
                  >
                    david061939@hotmail.com
                  </a>
                </div>
              </SurfaceCard>
            </div>
          </div>
        </div>

        <div className="grid justify-end gap-4 lg:grid-cols-[minmax(0,1fr)]">
          <SurfaceCard className="w-full max-w-[470px] border-cyan-100/80 bg-white/82 px-6 py-6 lg:px-7 lg:py-7">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-sky-600">Sign In</p>
                  <span className="rounded-full border border-cyan-100 bg-cyan-50/80 px-3 py-1 text-xs font-medium text-sky-700">
                    正式环境
                  </span>
                </div>
                <h2 className="text-[28px] font-semibold tracking-[-0.05em] text-slate-950">账号登录</h2>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-600">账号</span>
                <input
                  className="h-12 w-full rounded-2xl border border-sky-100 bg-white/90 px-4 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  onChange={(event) => setAccount(event.target.value)}
                  placeholder="请输入后台账号"
                  value={account}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-600">密码</span>
                <input
                  className="h-12 w-full rounded-2xl border border-sky-100 bg-white/90 px-4 text-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入密码"
                  type="password"
                  value={password}
                />
              </label>

              <button
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,_#235cff_0%,_#1295ff_52%,_#1bd4f2_100%)] text-sm font-medium text-white shadow-[0_18px_36px_rgba(18,149,255,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(18,149,255,0.34)]"
                disabled={submitting}
                type="submit"
              >
                {submitting ? "登录中..." : "进入后台"}
                <ArrowRight className="h-4 w-4" />
              </button>

              {feedback ? (
                <div className="rounded-2xl border border-sky-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.9),_rgba(236,248,255,0.95))] px-4 py-3 text-sm text-slate-500">
                  {feedback}
                </div>
              ) : null}
            </form>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
