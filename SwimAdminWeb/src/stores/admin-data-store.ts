import { create } from "zustand";

import { adminApi } from "@/lib/api";
import {
  buildQuery,
  mapAdminAccount,
  mapCity,
  mapFollow,
  mapReview,
  mapUser,
  mapVenue,
  toAdminAccountPayload,
  toCityPayload,
  toUserPayload,
  toVenuePayload,
  toWaterQualityPayload,
} from "@/lib/admin-mappers";
import { useAuthStore } from "@/stores/auth-store";
import type {
  AdminAccountItem,
  CityItem,
  FollowFilters,
  FollowRecordItem,
  ReviewFilters,
  ReviewItem,
  UserFilters,
  UserItem,
  VenueFilters,
  VenueItem,
  WaterQuality,
} from "@/types/data";

type CreateVenueInput = {
  cityId: string;
  name: string;
  district: string;
  address: string;
  latitude: string;
  longitude: string;
  status: "normal" | "disabled";
};

type CreateUserInput = {
  avatarUrl: string;
  nickname: string;
  email: string;
  password: string;
};

type CreateCityInput = Pick<CityItem, "name" | "code">;
type CreateAdminInput = {
  account: string;
  name: string;
  password: string;
};

type LoadingState = {
  venues: boolean;
  users: boolean;
  reviews: boolean;
  follows: boolean;
  cities: boolean;
  adminAccounts: boolean;
};

type AdminDataState = {
  venues: VenueItem[];
  users: UserItem[];
  reviews: ReviewItem[];
  follows: FollowRecordItem[];
  cities: CityItem[];
  adminAccounts: AdminAccountItem[];
  loading: LoadingState;
  error: string | null;
  clearError: () => void;
  loadVenues: (filters?: Partial<VenueFilters>) => Promise<void>;
  loadUsers: (filters?: Partial<UserFilters>) => Promise<void>;
  loadReviews: (filters?: Partial<ReviewFilters>) => Promise<void>;
  loadFollows: (filters?: Partial<FollowFilters>) => Promise<void>;
  loadCities: () => Promise<void>;
  loadAdminAccounts: () => Promise<void>;
  addVenue: (payload: CreateVenueInput) => Promise<void>;
  deleteVenue: (id: string) => Promise<void>;
  toggleVenueStatus: (id: string) => Promise<void>;
  updateVenueWaterQuality: (id: string, waterQuality: WaterQuality) => Promise<void>;
  addUser: (payload: CreateUserInput) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  toggleUserStatus: (id: string) => Promise<void>;
  deleteReview: (id: string) => Promise<void>;
  toggleReviewStatus: (id: string) => Promise<void>;
  addCity: (payload: CreateCityInput) => Promise<void>;
  toggleCityStatus: (id: string) => Promise<void>;
  addAdminAccount: (payload: CreateAdminInput) => Promise<void>;
  deleteAdminAccount: (id: string) => Promise<void>;
};

const initialLoading: LoadingState = {
  venues: false,
  users: false,
  reviews: false,
  follows: false,
  cities: false,
  adminAccounts: false,
};

function requireToken() {
  const token = useAuthStore.getState().accessToken;

  if (!token) {
    throw new Error("登录态已失效，请重新登录");
  }

  return token;
}

async function runAction<T>(
  set: (fn: (state: AdminDataState) => Partial<AdminDataState>) => void,
  key: keyof LoadingState,
  action: () => Promise<T>,
) {
  set((state) => ({
    loading: { ...state.loading, [key]: true },
    error: null,
  }));

  try {
    return await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : "请求失败";
    set((state) => ({
      loading: { ...state.loading, [key]: false },
      error: message,
    }));
    throw error;
  } finally {
    set((state) => ({
      loading: { ...state.loading, [key]: false },
    }));
  }
}

export const useAdminDataStore = create<AdminDataState>((set, get) => ({
  venues: [],
  users: [],
  reviews: [],
  follows: [],
  cities: [],
  adminAccounts: [],
  loading: initialLoading,
  error: null,
  clearError: () => set({ error: null }),
  loadVenues: async (filters) =>
    runAction(set, "venues", async () => {
      const token = requireToken();
      const query = buildQuery({
        name: filters?.name,
        location: filters?.location,
        status: filters?.status && filters.status !== "all" ? filters.status : undefined,
        startDate: filters?.startDate,
        endDate: filters?.endDate,
      });
      const response = await adminApi.listVenues(token, query);
      set({ venues: response.map(mapVenue) });
    }),
  loadUsers: async (filters) =>
    runAction(set, "users", async () => {
      const token = requireToken();
      const query = buildQuery({
        nickname: filters?.nickname,
        email: filters?.email,
        status:
          filters?.status && filters.status !== "all"
            ? filters.status === "normal"
              ? "active"
              : "disabled"
            : undefined,
      });
      const response = await adminApi.listUsers(token, query);
      set({ users: response.map(mapUser) });
    }),
  loadReviews: async (filters) =>
    runAction(set, "reviews", async () => {
      const token = requireToken();
      const query = buildQuery({
        userId: filters?.userId,
        nickname: filters?.nickname,
        content: filters?.content,
        status: filters?.status && filters.status !== "all" ? filters.status : undefined,
        startDate: filters?.startDate,
        endDate: filters?.endDate,
      });
      const response = await adminApi.listReviews(token, query);
      set({
        reviews: response
          .map(mapReview)
          .filter((item) => item.status !== "disabled" || filters?.status === "disabled" || filters?.status === "all" || !filters?.status),
      });
    }),
  loadFollows: async (filters) =>
    runAction(set, "follows", async () => {
      const token = requireToken();
      const query = buildQuery({
        venueId: filters?.venueId,
        venueName: filters?.venueName,
        userId: filters?.userId,
        userNickname: filters?.userNickname,
        type: filters?.type && filters.type !== "all" ? filters.type : undefined,
        startDate: filters?.startDate,
        endDate: filters?.endDate,
      });
      const response = await adminApi.listFollows(token, query);
      set({ follows: response.map(mapFollow) });
    }),
  loadCities: async () =>
    runAction(set, "cities", async () => {
      const token = requireToken();
      const response = await adminApi.listCities(token);
      set({ cities: response.map(mapCity) });
    }),
  loadAdminAccounts: async () =>
    runAction(set, "adminAccounts", async () => {
      const token = requireToken();
      const response = await adminApi.listAdminAccounts(token);
      set({ adminAccounts: response.map(mapAdminAccount) });
    }),
  addVenue: async (payload) =>
    runAction(set, "venues", async () => {
      const token = requireToken();
      await adminApi.createVenue(token, toVenuePayload(payload));
      await get().loadVenues();
    }),
  deleteVenue: async (id) =>
    runAction(set, "venues", async () => {
      const token = requireToken();
      await adminApi.deleteVenue(token, id);
      await get().loadVenues();
    }),
  toggleVenueStatus: async (id) =>
    runAction(set, "venues", async () => {
      const token = requireToken();
      const venue = get().venues.find((item) => item.id === id);

      if (!venue) {
        throw new Error("场馆不存在");
      }

      await adminApi.updateVenueStatus(
        token,
        id,
        venue.status === "normal" ? "disabled" : "normal",
      );
      await get().loadVenues();
    }),
  updateVenueWaterQuality: async (id, waterQuality) =>
    runAction(set, "venues", async () => {
      const token = requireToken();
      await adminApi.createWaterQuality(token, id, toWaterQualityPayload(waterQuality));
      await get().loadVenues();
    }),
  addUser: async (payload) =>
    runAction(set, "users", async () => {
      const token = requireToken();
      await adminApi.createUser(token, toUserPayload(payload));
      await get().loadUsers();
    }),
  deleteUser: async (id) =>
    runAction(set, "users", async () => {
      const token = requireToken();
      await adminApi.deleteUser(token, id);
      await get().loadUsers();
    }),
  toggleUserStatus: async (id) =>
    runAction(set, "users", async () => {
      const token = requireToken();
      const user = get().users.find((item) => item.id === id);

      if (!user) {
        throw new Error("用户不存在");
      }

      await adminApi.updateUserStatus(
        token,
        id,
        user.status === "normal" ? "disabled" : "active",
      );
      await get().loadUsers();
    }),
  deleteReview: async (id) =>
    runAction(set, "reviews", async () => {
      const token = requireToken();
      await adminApi.updateReviewStatus(token, id, {
        status: "deleted",
        reason: "后台删除评价",
      });
      await get().loadReviews();
    }),
  toggleReviewStatus: async (id) =>
    runAction(set, "reviews", async () => {
      const token = requireToken();
      const review = get().reviews.find((item) => item.id === id);

      if (!review) {
        throw new Error("评价不存在");
      }

      await adminApi.updateReviewStatus(token, id, {
        status: review.status === "normal" ? "disabled" : "normal",
        reason: review.status === "normal" ? "后台拉黑评价" : "后台恢复评价",
      });
      await get().loadReviews();
    }),
  addCity: async (payload) =>
    runAction(set, "cities", async () => {
      const token = requireToken();
      await adminApi.createCity(token, toCityPayload(payload));
      await get().loadCities();
    }),
  toggleCityStatus: async (id) =>
    runAction(set, "cities", async () => {
      const token = requireToken();
      const city = get().cities.find((item) => item.id === id);

      if (!city) {
        throw new Error("城市不存在");
      }

      await adminApi.updateCity(token, id, {
        status: city.status === "enabled" ? "disabled" : "enabled",
      });
      await get().loadCities();
    }),
  addAdminAccount: async (payload) =>
    runAction(set, "adminAccounts", async () => {
      const token = requireToken();
      await adminApi.createAdminAccount(token, toAdminAccountPayload(payload));
      await get().loadAdminAccounts();
    }),
  deleteAdminAccount: async (id) =>
    runAction(set, "adminAccounts", async () => {
      const token = requireToken();
      await adminApi.deleteAdminAccount(token, id);
      await get().loadAdminAccounts();
    }),
}));
