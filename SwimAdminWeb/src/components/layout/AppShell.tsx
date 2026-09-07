import { Building2, ChevronRight, LogOut, MapPinned, MessageSquareText, Settings2, ShieldCheck, Users } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { SurfaceCard } from "@/components/common/SurfaceCard";
import { useAuthStore } from "@/stores/auth-store";

const navItems = [
  { to: "/venues", label: "游泳馆管理", icon: Building2 },
  { to: "/users", label: "用户管理", icon: Users },
  { to: "/reviews", label: "评价管理", icon: MessageSquareText },
  { to: "/follows", label: "关注管理", icon: MapPinned },
  { to: "/settings/cities", label: "城市管理", icon: Settings2 },
  { to: "/settings/accounts", label: "账号管理", icon: ShieldCheck },
];

export function AppShell() {
  const currentAdmin = useAuthStore((state) => state.currentAdmin);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.22),_transparent_20%),radial-gradient(circle_at_85%_15%,_rgba(37,99,235,0.28),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.18),_transparent_26%),linear-gradient(180deg,_#f4faff_0%,_#ecf5ff_42%,_#f7fbff_100%)] px-4 py-4 text-slate-900 lg:px-6 lg:py-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1600px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <SurfaceCard className="flex flex-col justify-between overflow-hidden border-cyan-100/90 bg-white/78 px-5 py-5">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex overflow-hidden rounded-[18px] shadow-[0_18px_42px_rgba(18,149,255,0.3)]">
                  <img
                    alt="泳池水质通 Logo"
                    className="h-14 w-14 rounded-[18px] object-cover"
                    src="/brand/icon-1024.png"
                  />
                </div>
                <div className="space-y-1">
                  <h1 className="text-[22px] font-semibold leading-[1.05] tracking-[-0.04em] text-slate-900">
                    <span className="block">泳池水质通</span>
                    <span className="block">运营后台</span>
                  </h1>
                </div>
              </div>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    className={({ isActive }) =>
                      [
                        "group flex items-center justify-between rounded-2xl px-4 py-3 text-sm transition",
                        isActive
                          ? "bg-[linear-gradient(135deg,_#235cff_0%,_#1295ff_52%,_#1bd4f2_100%)] text-white shadow-[0_18px_40px_rgba(18,149,255,0.24)]"
                          : "text-slate-600 hover:bg-sky-50/90 hover:text-slate-900",
                      ].join(" ")
                    }
                    to={item.to}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    <ChevronRight className="h-4 w-4 opacity-60 transition group-hover:translate-x-0.5" />
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="space-y-4">
            <div className="rounded-[24px] border border-cyan-100 bg-[linear-gradient(180deg,_rgba(255,255,255,0.88),_rgba(234,246,255,0.92))] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.28em] text-sky-600">当前身份</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{currentAdmin?.name ?? "未登录"}</p>
              <p className="mt-1 text-sm text-slate-500">{currentAdmin?.account ?? "--"}</p>
            </div>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,_#235cff_0%,_#1295ff_52%,_#1bd4f2_100%)] px-4 py-3 text-sm font-medium text-white shadow-[0_16px_34px_rgba(18,149,255,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(18,149,255,0.28)]"
              onClick={() => void logout()}
              type="button"
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </button>
          </div>
        </SurfaceCard>

        <div className="min-w-0 space-y-4">
          <SurfaceCard className="flex justify-end border-cyan-100/90 bg-white/76 px-5 py-4">
            <div className="rounded-full border border-cyan-100 bg-[linear-gradient(135deg,_rgba(255,255,255,0.92),_rgba(234,246,255,0.94))] px-4 py-2 text-sm text-sky-700 shadow-sm">
              正式环境
            </div>
          </SurfaceCard>
          <main className="pb-10">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
