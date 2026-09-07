import { Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import { Modal } from "@/components/dialogs/Modal";
import { useAdminDataStore } from "@/stores/admin-data-store";
import type { ReviewFilters, ReviewItem } from "@/types/data";
import { formatDateTime } from "@/utils/format";

const defaultFilters: ReviewFilters = {
  userId: "",
  nickname: "",
  content: "",
  status: "all",
  startDate: "",
  endDate: "",
};

export function ReviewsPage() {
  const reviews = useAdminDataStore((state) => state.reviews);
  const loadReviews = useAdminDataStore((state) => state.loadReviews);
  const deleteReview = useAdminDataStore((state) => state.deleteReview);
  const toggleReviewStatus = useAdminDataStore((state) => state.toggleReviewStatus);

  const [filters, setFilters] = useState(defaultFilters);
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const filteredReviews = useMemo(
    () =>
      reviews.filter((review) => {
        const reviewDay = review.createdAt.slice(0, 10);
        return (
          (!filters.userId || review.userId.toLowerCase().includes(filters.userId.toLowerCase())) &&
          (!filters.nickname || review.userNickname.toLowerCase().includes(filters.nickname.toLowerCase())) &&
          (!filters.content || review.content.toLowerCase().includes(filters.content.toLowerCase())) &&
          (filters.status === "all" || review.status === filters.status) &&
          (!filters.startDate || reviewDay >= filters.startDate) &&
          (!filters.endDate || reviewDay <= filters.endDate)
        );
      }),
    [filters, reviews],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        description="查看评价内容、时间和状态，支持真实删除与拉黑处理。"
        eyebrow="Review Moderation"
        title="评价管理"
      />

      <SurfaceCard className="px-5 py-5">
        <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <label className="space-y-2">
            <span className="text-sm text-slate-500">评价用户 ID</span>
            <input className="admin-input" onChange={(e) => setFilters({ ...filters, userId: e.target.value })} value={filters.userId} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-500">评价昵称</span>
            <input className="admin-input" onChange={(e) => setFilters({ ...filters, nickname: e.target.value })} value={filters.nickname} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-500">评价内容</span>
            <input className="admin-input" onChange={(e) => setFilters({ ...filters, content: e.target.value })} value={filters.content} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-500">状态</span>
            <select className="admin-input" onChange={(e) => setFilters({ ...filters, status: e.target.value as ReviewFilters["status"] })} value={filters.status}>
              <option value="all">全部</option>
              <option value="normal">正常</option>
              <option value="disabled">禁用</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-500">开始时间</span>
            <input className="admin-input" onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} type="date" value={filters.startDate} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-500">结束时间</span>
            <input className="admin-input" onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} type="date" value={filters.endDate} />
          </label>
        </div>
      </SurfaceCard>

      {filteredReviews.length === 0 ? (
        <EmptyState description="可以尝试放宽评价内容、用户或时间筛选范围。" title="没有符合条件的评价" />
      ) : (
        <SurfaceCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-slate-500">
                <tr>
                  {["评价 ID", "评价内容", "用户 ID", "用户昵称", "评价时间", "状态", "操作"].map((head) => (
                    <th className="px-5 py-4 font-medium" key={head}>
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredReviews.map((review) => (
                  <tr className="border-t border-slate-100" key={review.id}>
                    <td className="px-5 py-4 text-slate-500">{review.id}</td>
                    <td className="px-5 py-4">
                      <p className="max-w-md line-clamp-2 text-slate-700">{review.content}</p>
                      <p className="mt-1 text-xs text-slate-400">{review.venueName}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-700">{review.userId}</td>
                    <td className="px-5 py-4 text-slate-700">{review.userNickname}</td>
                    <td className="px-5 py-4 text-slate-700">{formatDateTime(review.createdAt)}</td>
                    <td className="px-5 py-4">
                      <StatusBadge label={review.status === "normal" ? "正常" : "禁用"} tone={review.status === "normal" ? "green" : "red"} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button className="admin-chip" onClick={() => setSelectedReview(review)} type="button">
                          <Eye className="h-4 w-4" />
                          详情
                        </button>
                        <button className="admin-chip" onClick={() => void toggleReviewStatus(review.id)} type="button">
                          {review.status === "normal" ? "拉黑" : "恢复"}
                        </button>
                        <button className="admin-chip admin-chip-danger" onClick={() => void deleteReview(review.id)} type="button">
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
        description={selectedReview ? `${selectedReview.userNickname} · ${selectedReview.userId}` : ""}
        footer={
          <div className="flex justify-end">
            <button className="admin-secondary-button" onClick={() => setSelectedReview(null)} type="button">
              关闭
            </button>
          </div>
        }
        onClose={() => setSelectedReview(null)}
        open={Boolean(selectedReview)}
        title="评价详情"
      >
        {selectedReview ? (
          <div className="space-y-4">
            <SurfaceCard className="px-4 py-4">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-400">评价内容</p>
              <p className="mt-3 text-sm leading-7 text-slate-700">{selectedReview.content}</p>
            </SurfaceCard>
            <div className="grid gap-4 md:grid-cols-2">
              <SurfaceCard className="px-4 py-4">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">关联场馆</p>
                <p className="mt-3 text-sm text-slate-700">{selectedReview.venueName}</p>
              </SurfaceCard>
              <SurfaceCard className="px-4 py-4">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-400">评价时间</p>
                <p className="mt-3 text-sm text-slate-700">{formatDateTime(selectedReview.createdAt)}</p>
              </SurfaceCard>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
