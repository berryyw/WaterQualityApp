import { Plus, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import { Modal } from "@/components/dialogs/Modal";
import { useAdminDataStore } from "@/stores/admin-data-store";
import type { UserFilters } from "@/types/data";
import { formatDateTime, getInitials } from "@/utils/format";

const defaultFilters: UserFilters = {
  nickname: "",
  email: "",
  status: "all",
};

export function UsersPage() {
  const users = useAdminDataStore((state) => state.users);
  const loadUsers = useAdminDataStore((state) => state.loadUsers);
  const addUser = useAdminDataStore((state) => state.addUser);
  const deleteUser = useAdminDataStore((state) => state.deleteUser);
  const toggleUserStatus = useAdminDataStore((state) => state.toggleUserStatus);

  const [filters, setFilters] = useState(defaultFilters);
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    avatarUrl: "",
    nickname: "",
    email: "",
    password: "password123",
  });

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          (!filters.nickname || user.nickname.toLowerCase().includes(filters.nickname.toLowerCase())) &&
          (!filters.email || user.email.toLowerCase().includes(filters.email.toLowerCase())) &&
          (filters.status === "all" || user.status === filters.status),
      ),
    [filters, users],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <button className="admin-primary-button" onClick={() => setCreateOpen(true)} type="button">
            <Plus className="h-4 w-4" />
            新增用户
          </button>
        }
        description="维护用户昵称、邮箱和状态，所有改动都会落到真实服务。"
        eyebrow="User Control"
        title="用户管理"
      />

      <SurfaceCard className="px-5 py-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm text-slate-500">用户昵称</span>
            <input className="admin-input" onChange={(e) => setFilters({ ...filters, nickname: e.target.value })} value={filters.nickname} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-500">用户邮箱</span>
            <input className="admin-input" onChange={(e) => setFilters({ ...filters, email: e.target.value })} value={filters.email} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-500">用户状态</span>
            <select className="admin-input" onChange={(e) => setFilters({ ...filters, status: e.target.value as UserFilters["status"] })} value={filters.status}>
              <option value="all">全部</option>
              <option value="normal">正常</option>
              <option value="disabled">禁用</option>
            </select>
          </label>
        </div>
      </SurfaceCard>

      {filteredUsers.length === 0 ? (
        <EmptyState description="尝试放宽昵称、邮箱或状态筛选条件。" title="没有符合条件的用户" />
      ) : (
        <SurfaceCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-slate-500">
                <tr>
                  {["用户 ID", "头像", "昵称", "邮箱", "状态", "注册时间", "操作"].map((head) => (
                    <th className="px-5 py-4 font-medium" key={head}>
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr className="border-t border-slate-100" key={user.id}>
                    <td className="px-5 py-4 text-slate-500">{user.id}</td>
                    <td className="px-5 py-4">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
                        {user.avatarUrl ? <img alt={user.nickname} className="h-full w-full object-cover" src={user.avatarUrl} /> : getInitials(user.nickname)}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-900">{user.nickname}</td>
                    <td className="px-5 py-4 text-slate-700">{user.email}</td>
                    <td className="px-5 py-4">
                      <StatusBadge label={user.status === "normal" ? "正常" : "禁用"} tone={user.status === "normal" ? "green" : "red"} />
                    </td>
                    <td className="px-5 py-4 text-slate-700">{formatDateTime(user.joinedAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button className="admin-chip" onClick={() => void toggleUserStatus(user.id)} type="button">
                          {user.status === "normal" ? "禁用" : "启用"}
                        </button>
                        <button className="admin-chip admin-chip-danger" onClick={() => void deleteUser(user.id)} type="button">
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      )}

      <Modal
        description="支持录入昵称、邮箱和头像链接，保存后立即写入真实服务。"
        footer={
          <div className="flex justify-end gap-3">
            <button className="admin-secondary-button" onClick={() => setCreateOpen(false)} type="button">
              取消
            </button>
            <button
              className="admin-primary-button"
              onClick={() => {
                if (!newUser.nickname.trim() || !newUser.email.trim()) {
                  return;
                }
                addUser({
                  avatarUrl: newUser.avatarUrl.trim(),
                  nickname: newUser.nickname.trim(),
                  email: newUser.email.trim(),
                  password: newUser.password.trim(),
                });
                setCreateOpen(false);
                setNewUser({
                  avatarUrl: "",
                  nickname: "",
                  email: "",
                  password: "password123",
                });
              }}
              type="button"
            >
              保存用户
            </button>
          </div>
        }
        onClose={() => setCreateOpen(false)}
        open={createOpen}
        title="新增用户"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-slate-500">头像链接</span>
            <input className="admin-input" onChange={(e) => setNewUser({ ...newUser, avatarUrl: e.target.value })} value={newUser.avatarUrl} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-500">用户昵称</span>
            <input className="admin-input" onChange={(e) => setNewUser({ ...newUser, nickname: e.target.value })} value={newUser.nickname} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-500">用户邮箱</span>
            <input className="admin-input" onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} value={newUser.email} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-slate-500">初始密码</span>
            <input className="admin-input" onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} value={newUser.password} />
          </label>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">默认状态</p>
                <p className="text-sm text-slate-500">首版创建后默认为正常用户。</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
