import { Droplets, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import { Modal } from "@/components/dialogs/Modal";
import { useAdminDataStore } from "@/stores/admin-data-store";
import type { VenueFilters, VenueItem, WaterQuality } from "@/types/data";
import { formatCoordinate, formatDateTime } from "@/utils/format";

const defaultFilters: VenueFilters = {
  name: "",
  location: "",
  status: "all",
  startDate: "",
  endDate: "",
};

const emptyWaterQuality: WaterQuality = {
  physical: { title: "物理信息", metrics: [{ label: "水温", value: "" }, { label: "浑浊度", value: "" }] },
  chemical: { title: "化学信息", metrics: [{ label: "PH 值", value: "" }, { label: "余氯", value: "" }] },
  biological: { title: "生物信息", metrics: [{ label: "菌落总数", value: "" }, { label: "大肠菌群", value: "" }] },
  other: { title: "其他信息", metrics: [{ label: "最近检修", value: "" }, { label: "巡检班次", value: "" }] },
};

export function VenuesPage() {
  const venues = useAdminDataStore((state) => state.venues);
  const cities = useAdminDataStore((state) => state.cities);
  const loadVenues = useAdminDataStore((state) => state.loadVenues);
  const loadCities = useAdminDataStore((state) => state.loadCities);
  const addVenue = useAdminDataStore((state) => state.addVenue);
  const deleteVenue = useAdminDataStore((state) => state.deleteVenue);
  const toggleVenueStatus = useAdminDataStore((state) => state.toggleVenueStatus);
  const updateVenueWaterQuality = useAdminDataStore((state) => state.updateVenueWaterQuality);

  const [filters, setFilters] = useState(defaultFilters);
  const [createOpen, setCreateOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<VenueItem | null>(null);
  const [qualityDraft, setQualityDraft] = useState<WaterQuality>(emptyWaterQuality);
  const [newVenue, setNewVenue] = useState({
    cityId: "",
    district: "",
    name: "",
    address: "",
    latitude: "39.900",
    longitude: "116.400",
    status: "normal" as const,
  });

  useEffect(() => {
    void loadVenues();
    void loadCities();
  }, [loadCities, loadVenues]);

  const filteredVenues = useMemo(() => {
    return venues.filter((venue) => {
      const updatedAt = venue.waterQualityUpdatedAt.slice(0, 10);
      return (
        (!filters.name || venue.name.toLowerCase().includes(filters.name.toLowerCase())) &&
        (!filters.location || venue.address.toLowerCase().includes(filters.location.toLowerCase())) &&
        (filters.status === "all" || venue.status === filters.status) &&
        (!filters.startDate || updatedAt >= filters.startDate) &&
        (!filters.endDate || updatedAt <= filters.endDate)
      );
    });
  }, [filters, venues]);

  const summary = useMemo(
    () => [
      { label: "场馆总数", value: String(venues.length) },
      { label: "正常场馆", value: String(venues.filter((item) => item.status === "normal").length) },
      { label: "近 24h 更新", value: String(venues.filter((item) => item.waterQualityUpdatedAt.startsWith("2026-07-12")).length) },
    ],
    [venues],
  );

  const openQualityModal = (venue: VenueItem) => {
    setSelectedVenue(venue);
    setQualityDraft(venue.waterQuality);
    setQualityOpen(true);
  };

  const handleCreate = async () => {
    if (!newVenue.cityId || !newVenue.name.trim() || !newVenue.address.trim() || !newVenue.district.trim()) {
      return;
    }

    await addVenue({
      cityId: newVenue.cityId,
      district: newVenue.district,
      name: newVenue.name.trim(),
      address: newVenue.address.trim(),
      latitude: newVenue.latitude,
      longitude: newVenue.longitude,
      status: newVenue.status,
    });
    setCreateOpen(false);
    setNewVenue({
      cityId: "",
      district: "",
      name: "",
      address: "",
      latitude: "39.900",
      longitude: "116.400",
      status: "normal",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <button className="admin-primary-button" onClick={() => setCreateOpen(true)} type="button">
            <Plus className="h-4 w-4" />
            新增游泳馆
          </button>
        }
        description="集中维护场馆资料、水质更新时间和可用状态，所有操作都会写入本地真实服务。"
        eyebrow="Venue Control"
        title="游泳馆管理"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {summary.map((item) => (
          <SurfaceCard className="px-5 py-5" key={item.label}>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900">{item.value}</p>
          </SurfaceCard>
        ))}
      </div>

      <SurfaceCard className="px-5 py-5">
        <div className="grid gap-4 lg:grid-cols-5">
          <label className="space-y-2">
            <span className="text-sm text-slate-500">场馆名称</span>
            <input className="admin-input" onChange={(e) => setFilters({ ...filters, name: e.target.value })} value={filters.name} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-500">场馆位置</span>
            <input className="admin-input" onChange={(e) => setFilters({ ...filters, location: e.target.value })} value={filters.location} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-500">状态</span>
            <select className="admin-input" onChange={(e) => setFilters({ ...filters, status: e.target.value as VenueFilters["status"] })} value={filters.status}>
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
        <div className="mt-4 flex items-center gap-3">
          <button className="admin-secondary-button" type="button">
            <Search className="h-4 w-4" />
            共 {filteredVenues.length} 条结果
          </button>
          <button className="text-sm text-slate-500 underline-offset-4 hover:underline" onClick={() => setFilters(defaultFilters)} type="button">
            重置筛选
          </button>
        </div>
      </SurfaceCard>

      {filteredVenues.length === 0 ? (
        <EmptyState description="尝试调整场馆名称、位置或时间范围筛选条件。" title="没有符合条件的游泳馆" />
      ) : (
        <SurfaceCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-slate-500">
                <tr>
                  {["场馆 ID", "场馆名称", "位置", "状态", "关注数", "水质更新时间", "操作"].map((head) => (
                    <th className="px-5 py-4 font-medium" key={head}>
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredVenues.map((venue) => (
                  <tr className="border-t border-slate-100" key={venue.id}>
                    <td className="px-5 py-4 text-slate-500">{venue.id}</td>
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">{venue.name}</p>
                        <p className="text-xs text-slate-400">{venue.cityName}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-slate-700">{venue.address}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatCoordinate(venue.latitude, venue.longitude)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge label={venue.status === "normal" ? "正常" : "禁用"} tone={venue.status === "normal" ? "green" : "red"} />
                    </td>
                    <td className="px-5 py-4 text-slate-700">{venue.followersCount}</td>
                    <td className="px-5 py-4 text-slate-700">{formatDateTime(venue.waterQualityUpdatedAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button className="admin-chip" onClick={() => openQualityModal(venue)} type="button">
                          <Droplets className="h-4 w-4" />
                          更新水质
                        </button>
                        <button className="admin-chip" onClick={() => void toggleVenueStatus(venue.id)} type="button">
                          {venue.status === "normal" ? "禁用" : "启用"}
                        </button>
                        <button className="admin-chip admin-chip-danger" onClick={() => void deleteVenue(venue.id)} type="button">
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
        description="录入基础资料后，系统将自动生成默认水质摘要。"
        footer={
          <div className="flex justify-end gap-3">
            <button className="admin-secondary-button" onClick={() => setCreateOpen(false)} type="button">
              取消
            </button>
            <button className="admin-primary-button" onClick={() => void handleCreate()} type="button">
              保存场馆
            </button>
          </div>
        }
        onClose={() => setCreateOpen(false)}
        open={createOpen}
        title="新增游泳馆"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-slate-500">所属城市</span>
            <select className="admin-input" onChange={(e) => setNewVenue({ ...newVenue, cityId: e.target.value })} value={newVenue.cityId}>
              <option value="">请选择城市</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-500">所在区</span>
            <input className="admin-input" onChange={(e) => setNewVenue({ ...newVenue, district: e.target.value })} value={newVenue.district} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-slate-500">场馆名称</span>
            <input className="admin-input" onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })} value={newVenue.name} />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm text-slate-500">场馆地址</span>
            <input className="admin-input" onChange={(e) => setNewVenue({ ...newVenue, address: e.target.value })} value={newVenue.address} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-500">纬度</span>
            <input className="admin-input" onChange={(e) => setNewVenue({ ...newVenue, latitude: e.target.value })} value={newVenue.latitude} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-500">经度</span>
            <input className="admin-input" onChange={(e) => setNewVenue({ ...newVenue, longitude: e.target.value })} value={newVenue.longitude} />
          </label>
        </div>
      </Modal>

      <Modal
        description={selectedVenue ? `正在编辑 ${selectedVenue.name} 的四类水质信息` : ""}
        footer={
          <div className="flex justify-end gap-3">
            <button className="admin-secondary-button" onClick={() => setQualityOpen(false)} type="button">
              取消
            </button>
            <button
              className="admin-primary-button"
              onClick={() => {
                if (selectedVenue) {
                  void updateVenueWaterQuality(selectedVenue.id, qualityDraft);
                }
                setQualityOpen(false);
              }}
              type="button"
            >
              保存更新
            </button>
          </div>
        }
        onClose={() => setQualityOpen(false)}
        open={qualityOpen}
        title="更新水质信息"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(qualityDraft).map(([key, group]) => (
            <SurfaceCard className="px-4 py-4" key={key}>
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900">{group.title}</h4>
                {group.metrics.map((metric, index) => (
                  <label className="block space-y-2" key={metric.label}>
                    <span className="text-sm text-slate-500">{metric.label}</span>
                    <input
                      className="admin-input"
                      onChange={(event) =>
                        setQualityDraft((current) => ({
                          ...current,
                          [key]: {
                            ...current[key as keyof WaterQuality],
                            metrics: current[key as keyof WaterQuality].metrics.map((item, metricIndex) =>
                              metricIndex === index ? { ...item, value: event.target.value } : item,
                            ),
                          },
                        }))
                      }
                      value={metric.value}
                    />
                  </label>
                ))}
              </div>
            </SurfaceCard>
          ))}
        </div>
      </Modal>
    </div>
  );
}
