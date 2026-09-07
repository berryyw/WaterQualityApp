import type {
  AdminAccountItem,
  CityItem,
  FollowRecordItem,
  ReviewItem,
  UserItem,
  VenueItem,
  WaterQuality,
} from "@/types/data";

function withUnit(value: unknown, unit = "") {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return `${value}${unit}`;
}

function getMetricValue(waterQuality: WaterQuality, group: keyof WaterQuality, label: string) {
  return waterQuality[group].metrics.find((item) => item.label === label)?.value ?? "";
}

function parseNumericMetric(value: string, fallback: number) {
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseIntegerMetric(value: string, fallback: number) {
  const parsed = Number.parseInt(value.replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function mapAdminAccount(apiItem: any): AdminAccountItem {
  return {
    id: apiItem.id,
    account: apiItem.account,
    name: apiItem.name,
    role: "admin",
    status: apiItem.status,
    lastLoginAt: apiItem.lastLoginAt ?? "尚未登录",
  };
}

export function mapCity(apiItem: any): CityItem {
  return {
    id: apiItem.id,
    name: apiItem.name,
    code: apiItem.code,
    status: apiItem.status,
    venueCount: apiItem._count?.venues ?? 0,
  };
}

export function mapWaterQuality(apiItem?: any): WaterQuality {
  if (!apiItem) {
    return {
      physical: {
        title: "物理信息",
        metrics: [
          { label: "水温", value: "" },
          { label: "浑浊度", value: "" },
        ],
      },
      chemical: {
        title: "化学信息",
        metrics: [
          { label: "PH 值", value: "" },
          { label: "余氯", value: "" },
        ],
      },
      biological: {
        title: "生物信息",
        metrics: [
          { label: "菌落总数", value: "" },
          { label: "大肠菌群", value: "" },
        ],
      },
      other: {
        title: "其他信息",
        metrics: [
          { label: "最近检修", value: "" },
          { label: "巡检班次", value: "" },
        ],
      },
    };
  }

  return {
    physical: {
      title: "物理信息",
      metrics: [
        { label: "水温", value: withUnit(apiItem.waterTemperature, "°C") },
        { label: "浑浊度", value: withUnit(apiItem.turbidity, "NTU") },
      ],
    },
    chemical: {
      title: "化学信息",
      metrics: [
        { label: "PH 值", value: withUnit(apiItem.phValue) },
        { label: "余氯", value: withUnit(apiItem.freeChlorine, "mg/L") },
      ],
    },
    biological: {
      title: "生物信息",
      metrics: [
        { label: "菌落总数", value: apiItem.bacterialCount ?? "" },
        { label: "大肠菌群", value: apiItem.totalColiforms ?? "" },
      ],
    },
    other: {
      title: "其他信息",
      metrics: [
        { label: "最近检修", value: apiItem.note ?? "" },
        { label: "巡检班次", value: `${apiItem.grade ?? ""}` },
      ],
    },
  };
}

export function toWaterQualityPayload(waterQuality: WaterQuality) {
  return {
    grade: "good",
    note: getMetricValue(waterQuality, "other", "最近检修") || "后台运营更新水质信息",
    updatedAt: new Date().toISOString(),
    turbidity: parseNumericMetric(getMetricValue(waterQuality, "physical", "浑浊度"), 0.3),
    waterTemperature: parseNumericMetric(getMetricValue(waterQuality, "physical", "水温"), 27.0),
    phValue: parseNumericMetric(getMetricValue(waterQuality, "chemical", "PH 值"), 7.2),
    freeChlorine: parseNumericMetric(getMetricValue(waterQuality, "chemical", "余氯"), 0.4),
    combinedChlorine: 0.1,
    orp: 710,
    bacterialCount: getMetricValue(waterQuality, "biological", "菌落总数") || "12CFU/mL",
    totalColiforms: getMetricValue(waterQuality, "biological", "大肠菌群") || "未检出",
    urea: 2.2,
    cyanuricAcid: 18.5,
    tds: 410,
  };
}

export function mapVenue(apiItem: any): VenueItem {
  const currentWaterQuality = Array.isArray(apiItem.waterQuality)
    ? apiItem.waterQuality[0]
    : apiItem.waterQuality;

  return {
    id: apiItem.id,
    cityId: apiItem.cityId,
    cityName: apiItem.city?.name ?? "",
    name: apiItem.name,
    address: apiItem.address,
    latitude: Number(apiItem.latitude),
    longitude: Number(apiItem.longitude),
    status: apiItem.status,
    followersCount: apiItem.followersCount ?? 0,
    waterQualityUpdatedAt: currentWaterQuality?.updatedAt ?? apiItem.updatedAt,
    waterQuality: mapWaterQuality(currentWaterQuality),
  };
}

export function mapUser(apiItem: any): UserItem {
  return {
    id: apiItem.id,
    avatarUrl: apiItem.profile?.avatarUrl ?? "",
    nickname: apiItem.profile?.nickname ?? apiItem.email,
    email: apiItem.email,
    status: apiItem.status === "active" ? "normal" : "disabled",
    joinedAt: apiItem.createdAt,
  };
}

export function mapReview(apiItem: any): ReviewItem {
  return {
    id: apiItem.id,
    venueId: apiItem.venueId,
    venueName: apiItem.venue?.name ?? "",
    userId: apiItem.userId,
    userNickname: apiItem.user?.profile?.nickname ?? apiItem.user?.email ?? "",
    content: apiItem.content,
    createdAt: apiItem.createdAt,
    status: apiItem.status === "deleted" ? "disabled" : apiItem.status,
  };
}

export function mapFollow(apiItem: any): FollowRecordItem {
  return {
    id: apiItem.id,
    venueId: apiItem.venueId,
    venueName: apiItem.venue?.name ?? "",
    userId: apiItem.userId,
    userNickname: apiItem.user?.profile?.nickname ?? apiItem.user?.email ?? "",
    type: apiItem.eventType,
    operatedAt: apiItem.createdAt,
  };
}

export function toVenuePayload(input: {
  cityId: string;
  name: string;
  district: string;
  address: string;
  latitude: string;
  longitude: string;
  status: "normal" | "disabled";
}) {
  return {
    cityId: input.cityId,
    name: input.name.trim(),
    district: input.district.trim(),
    address: input.address.trim(),
    latitude: Number(input.latitude),
    longitude: Number(input.longitude),
    status: input.status,
    summary: "",
    imageCaption: "",
  };
}

export function toUserPayload(input: {
  avatarUrl: string;
  nickname: string;
  email: string;
  password: string;
}) {
  return {
    avatarUrl: input.avatarUrl.trim(),
    nickname: input.nickname.trim(),
    email: input.email.trim(),
    password: input.password.trim(),
  };
}

export function toAdminAccountPayload(input: {
  account: string;
  name: string;
  password: string;
}) {
  return {
    account: input.account.trim(),
    name: input.name.trim(),
    password: input.password.trim(),
  };
}

export function toCityPayload(input: { name: string; code: string }) {
  return {
    name: input.name.trim(),
    code: input.code.trim().toLowerCase(),
    status: "enabled",
    sortOrder: 0,
  };
}

export function buildQuery(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}
