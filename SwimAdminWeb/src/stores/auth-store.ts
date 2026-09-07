import { create } from "zustand";

import { adminApi } from "@/lib/api";
import { configureAuthHandlers } from "@/lib/api";
import { mapAdminAccount } from "@/lib/admin-mappers";
import type { AdminAccountItem } from "@/types/data";

const STORAGE_KEY = "swim-admin-auth";
let refreshPromise: Promise<string | null> | null = null;

type LoginResult = {
  success: boolean;
  message: string;
};

type StoredAuth = {
  currentAdmin: AdminAccountItem | null;
  accessToken: string | null;
  refreshToken: string | null;
};

type AuthState = {
  currentAdmin: AdminAccountItem | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (account: string, password: string) => Promise<LoginResult>;
  refreshAuth: () => Promise<string | null>;
  logout: () => Promise<void>;
  clearAuth: () => void;
};

function readStoredAdmin() {
  if (typeof window === "undefined") {
    return { currentAdmin: null, accessToken: null, refreshToken: null };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw
      ? (JSON.parse(raw) as StoredAuth)
      : { currentAdmin: null, accessToken: null, refreshToken: null };
  } catch {
    return { currentAdmin: null, accessToken: null, refreshToken: null };
  }
}

function writeStoredAdmin(payload: StoredAuth) {
  if (typeof window === "undefined") {
    return;
  }

  if (!payload.currentAdmin || !payload.accessToken || !payload.refreshToken) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

const storedAuth = readStoredAdmin();

export const useAuthStore = create<AuthState>((set) => ({
  currentAdmin: storedAuth.currentAdmin,
  accessToken: storedAuth.accessToken,
  refreshToken: storedAuth.refreshToken,
  login: async (account, password) => {
    try {
      const response = await adminApi.login(account, password);
      const admin = mapAdminAccount({
        ...response.admin,
        lastLoginAt: new Date().toISOString(),
      });

      writeStoredAdmin({
        currentAdmin: admin,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
      set({
        currentAdmin: admin,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
      return { success: true, message: "登录成功" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "登录失败";
      return { success: false, message };
    }
  },
  refreshAuth: async () => {
    if (refreshPromise) {
      return refreshPromise;
    }

    const { refreshToken, currentAdmin } = useAuthStore.getState();

    if (!refreshToken || !currentAdmin) {
      useAuthStore.getState().clearAuth();
      return null;
    }

    refreshPromise = (async () => {
      try {
        const response = await adminApi.refresh(refreshToken);
        const admin = mapAdminAccount({
          ...response.admin,
          lastLoginAt: response.admin.lastLoginAt ?? currentAdmin.lastLoginAt,
        });

        writeStoredAdmin({
          currentAdmin: admin,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
        });
        set({
          currentAdmin: admin,
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
        });
        return response.accessToken;
      } catch {
        useAuthStore.getState().clearAuth();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },
  logout: async () => {
    const accessToken = useAuthStore.getState().accessToken;

    try {
      if (accessToken) {
        await adminApi.logout(accessToken);
      }
    } catch {
      // Ignore logout request failures locally and clear session anyway.
    }

    useAuthStore.getState().clearAuth();
  },
  clearAuth: () => {
    writeStoredAdmin({ currentAdmin: null, accessToken: null, refreshToken: null });
    set({ currentAdmin: null, accessToken: null, refreshToken: null });
  },
}));

configureAuthHandlers({
  refreshAuth: () => useAuthStore.getState().refreshAuth(),
  clearAuth: () => useAuthStore.getState().clearAuth(),
});
