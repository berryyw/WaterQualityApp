import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import { useAdminDataStore } from "@/stores/admin-data-store";
import type { FollowFilters } from "@/types/data";
import { formatDateTime } from "@/utils/format";

const defaultFilters: FollowFilters = {
  venueId: "",
  venueName: "",
  userId: "",
  userNickname: "",
  type: "all",
  startDate: "",
  endDate: "",
};

export function FollowsPage() {
  const follows = useAdminDataStore((state) => state.follows);
  const loadFollows = useAdminDataStore((state) => state.loadFollows);
  const [filters, setFilters] = useState(defaultFilters);

  useEffect(() => {
    void loadFollows();
  }, [loadFollows]);

  const filteredRecords = useMemo(
    () =>
      follows.filter((record) => {
        const operatedDay = record.operatedAt.slice(0, 10);
        return (
          (!filters.venueId || record.venueId.toLowerCase().includes(filters.venueId.toLowerCase())) &&
          (!filters.venueName || record.venueName.toLowerCase().includes(filters.venueName.toLowerCase())) &&
          (!filters.userId || record.userId.toLowerCase().includes(filters.userId.toLowerCase())) &&
          (!filters.userNickname || record.userNickname.toLowerCase().includes(filters.userNickname.toLowerCase())) &&
          (filters.type === "all" || record.type === filters.type) &&
          (!filters.startDate || operatedDay >= filters.startDate) &&
          (!filters.endDate || operatedDay <= filters.endDate)
        );
      }),
    [filters, follows],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        description="按泳馆、用户与操作时间检索关注和取消关注行为记录。"
        eyebrow="Follow Records"
        title="关注管理"
      />

      <SurfaceCard className="px-5 py-5">
        <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <label className="space-y-2">
            <span className="text-sm text-slate-500">被关注游泳馆 ID</span>
            <input className="admin-input" onChange={(e) => setFilters({ ...filters, venueId: e.target.value })} value={filters.venueId} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-500">被关注游泳馆名称</span>
            <input className="admin-input" onChange={(e) => setFilters({ ...filters, venueName: e.target.value })} value={filters.venueName} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-500">关注用户 ID</span>
            <input className="admin-input" onChange={(e) => setFilters({ ...filters, userId: e.target.value })} value={filters.userId} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-500">关注用户昵称</span>
            <input className="admin-input" onChange={(e) => setFilters({ ...filters, userNickname: e.target.value })} value={filters.userNickname} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-500">类型</span>
            <select className="admin-input" onChange={(e) => setFilters({ ...filters, type: e.target.value as FollowFilters["type"] })} value={filters.type}>
              <option value="all">全部</option>
              <option value="follow">关注</option>
              <option value="unfollow">取消关注</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="text-sm text-slate-500">开始时间</span>
              <input className="admin-input" onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} type="date" value={filters.startDate} />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-500">结束时间</span>
              <input className="admin-input" onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} type="date" value={filters.endDate} />
            </label>
          </div>
        </div>
      </SurfaceCard>

      {filteredRecords.length === 0 ? (
        <EmptyState description="可以尝试放宽场馆、用户或时间范围筛选条件。" title="没有符合条件的关注记录" />
      ) : (
        <SurfaceCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-slate-500">
                <tr>
                  {["泳馆 ID", "泳馆名称", "用户 ID", "用户昵称", "类型", "时间"].map((head) => (
                    <th className="px-5 py-4 font-medium" key={head}>
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr className="border-t border-slate-100" key={record.id}>
                    <td className="px-5 py-4 text-slate-500">{record.venueId}</td>
                    <td className="px-5 py-4 text-slate-700">{record.venueName}</td>
                    <td className="px-5 py-4 text-slate-700">{record.userId}</td>
                    <td className="px-5 py-4 text-slate-700">{record.userNickname}</td>
                    <td className="px-5 py-4">
                      <StatusBadge label={record.type === "follow" ? "关注" : "取消关注"} tone={record.type === "follow" ? "blue" : "amber"} />
                    </td>
                    <td className="px-5 py-4 text-slate-700">{formatDateTime(record.operatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      )}
    </div>
  );
}
