import { Plus, Shield } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import { Modal } from "@/components/dialogs/Modal";
import { useAdminDataStore } from "@/stores/admin-data-store";

export function SettingsAccountsPage() {
  const adminAccounts = useAdminDataStore((state) => state.adminAccounts);
  const loadAdminAccounts = useAdminDataStore((state) => state.loadAdminAccounts);
  const addAdminAccount = useAdminDataStore((state) => state.addAdminAccount);
  const deleteAdminAccount = useAdminDataStore((state) => state.deleteAdminAccount);

  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({ account: "", name: "", password: "password123" });

  useEffect(() => {
    void loadAdminAccounts();
  }, [loadAdminAccounts]);

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <button className="admin-primary-button" onClick={() => setCreateOpen(true)} type="button">
            <Plus className="h-4 w-4" />
            新增后台账号
          </button>
        }
        description="默认提供 admin 管理员，同时支持新增与删除后台账号。"
        eyebrow="Admin Accounts"
        title="账号管理"
      />

      <div className="grid gap-4">
        {adminAccounts.map((account) => (
          <SurfaceCard className="px-5 py-5" key={account.id}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <Shield className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">{account.name}</h3>
                    <StatusBadge label={account.status === "active" ? "启用" : "禁用"} tone={account.status === "active" ? "green" : "red"} />
                  </div>
                  <p className="text-sm text-slate-500">账号：{account.account}</p>
                  <p className="text-sm text-slate-500">角色：{account.role}</p>
                  <p className="text-sm text-slate-500">最近登录：{account.lastLoginAt}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {account.account === "admin" ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">默认账号仅作演示，不建议删除</div>
                ) : (
                  <button className="admin-chip admin-chip-danger" onClick={() => void deleteAdminAccount(account.id)} type="button">
                    删除账号
                  </button>
                )}
              </div>
            </div>
          </SurfaceCard>
        ))}
      </div>

      <Modal
        description="首版新增的后台账号仍统一归属 admin 角色，用于演示账号管理流程。"
        footer={
          <div className="flex justify-end gap-3">
            <button className="admin-secondary-button" onClick={() => setCreateOpen(false)} type="button">
              取消
            </button>
            <button
              className="admin-primary-button"
              onClick={() => {
                if (!draft.account.trim() || !draft.name.trim() || !draft.password.trim()) {
                  return;
                }
                void addAdminAccount({
                  account: draft.account.trim(),
                  name: draft.name.trim(),
                  password: draft.password.trim(),
                });
                setCreateOpen(false);
                setDraft({ account: "", name: "", password: "password123" });
              }}
              type="button"
            >
              保存账号
            </button>
          </div>
        }
        onClose={() => setCreateOpen(false)}
        open={createOpen}
        title="新增后台账号"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-slate-500">登录账号</span>
            <input className="admin-input" onChange={(e) => setDraft({ ...draft, account: e.target.value })} value={draft.account} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-500">显示名称</span>
            <input className="admin-input" onChange={(e) => setDraft({ ...draft, name: e.target.value })} value={draft.name} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-slate-500">初始密码</span>
            <input className="admin-input" onChange={(e) => setDraft({ ...draft, password: e.target.value })} value={draft.password} />
          </label>
        </div>
      </Modal>
    </div>
  );
}
