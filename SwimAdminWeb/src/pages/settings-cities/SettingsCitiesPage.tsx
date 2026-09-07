import { Building, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import { Modal } from "@/components/dialogs/Modal";
import { useAdminDataStore } from "@/stores/admin-data-store";

export function SettingsCitiesPage() {
  const cities = useAdminDataStore((state) => state.cities);
  const loadCities = useAdminDataStore((state) => state.loadCities);
  const addCity = useAdminDataStore((state) => state.addCity);
  const toggleCityStatus = useAdminDataStore((state) => state.toggleCityStatus);

  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", code: "" });

  useEffect(() => {
    void loadCities();
  }, [loadCities]);

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <button className="admin-primary-button" onClick={() => setCreateOpen(true)} type="button">
            <Plus className="h-4 w-4" />
            新增城市
          </button>
        }
        description="维护与 App 端联动的城市范围，状态切换会直接更新本地数据库。"
        eyebrow="City Settings"
        title="城市管理"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {cities.map((city) => (
          <SurfaceCard className="px-5 py-5" key={city.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                  <Building className="h-5 w-5" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">{city.name}</h3>
                    <StatusBadge label={city.status === "enabled" ? "启用" : "停用"} tone={city.status === "enabled" ? "green" : "red"} />
                  </div>
                  <p className="text-sm text-slate-500">城市代码：{city.code}</p>
                  <p className="text-sm text-slate-500">当前关联场馆：{city.venueCount} 家</p>
                </div>
              </div>
              <button className="admin-chip" onClick={() => void toggleCityStatus(city.id)} type="button">
                {city.status === "enabled" ? "停用" : "启用"}
              </button>
            </div>
          </SurfaceCard>
        ))}
      </div>

      <Modal
        description="保存后将追加到本地城市列表，用于演示配置管理能力。"
        footer={
          <div className="flex justify-end gap-3">
            <button className="admin-secondary-button" onClick={() => setCreateOpen(false)} type="button">
              取消
            </button>
            <button
              className="admin-primary-button"
              onClick={() => {
                if (!draft.name.trim() || !draft.code.trim()) {
                  return;
                }
                void addCity({ name: draft.name.trim(), code: draft.code.trim() });
                setCreateOpen(false);
                setDraft({ name: "", code: "" });
              }}
              type="button"
            >
              保存城市
            </button>
          </div>
        }
        onClose={() => setCreateOpen(false)}
        open={createOpen}
        title="新增城市"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm text-slate-500">城市名称</span>
            <input className="admin-input" onChange={(e) => setDraft({ ...draft, name: e.target.value })} value={draft.name} />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-500">城市代码</span>
            <input className="admin-input" onChange={(e) => setDraft({ ...draft, code: e.target.value })} value={draft.code} />
          </label>
        </div>
      </Modal>
    </div>
  );
}
