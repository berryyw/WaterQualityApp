const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api").replace(/\/$/, "");

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  retryOnAuthFailure?: boolean;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type AuthHandlers = {
  refreshAuth?: () => Promise<string | null>;
  clearAuth?: () => void;
};

let authHandlers: AuthHandlers = {};

export function configureAuthHandlers(handlers: AuthHandlers) {
  authHandlers = handlers;
}

async function doFetch(path: string, options: RequestOptions, token = options.token) {
  return fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

async function request<T>(path: string, options: RequestOptions = {}) {
  let response = await doFetch(path, options);

  if (
    response.status === 401 &&
    options.token &&
    options.retryOnAuthFailure !== false &&
    path !== "/admin/auth/refresh" &&
    authHandlers.refreshAuth
  ) {
    const nextToken = await authHandlers.refreshAuth();

    if (nextToken) {
      response = await doFetch(path, options, nextToken);
    } else {
      authHandlers.clearAuth?.();
    }
  }

  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload && payload.message
        ? String(payload.message)
        : "请求失败";
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export const adminApi = {
  login(account: string, password: string) {
    return request<{
      accessToken: string;
      refreshToken: string;
      admin: {
        id: string;
        account: string;
        name: string;
        role: "admin";
        status: "active" | "disabled";
        lastLoginAt?: string | null;
      };
    }>("/admin/auth/login", {
      method: "POST",
      body: { account, password },
    });
  },
  refresh(refreshToken: string) {
    return request<{
      accessToken: string;
      refreshToken: string;
      admin: {
        id: string;
        account: string;
        name: string;
        role: "admin";
        status: "active" | "disabled";
        lastLoginAt?: string | null;
      };
    }>("/admin/auth/refresh", {
      method: "POST",
      body: { refreshToken },
      retryOnAuthFailure: false,
    });
  },
  logout(token: string) {
    return request<{ success: boolean; message: string }>("/admin/auth/logout", {
      method: "POST",
      token,
    });
  },
  listVenues(token: string, query = "") {
    return request<any[]>(`/admin/venues${query}`, { token });
  },
  createVenue(token: string, body: unknown) {
    return request<any>("/admin/venues", { method: "POST", body, token });
  },
  updateVenueStatus(token: string, id: string, status: "normal" | "disabled") {
    return request<any>(`/admin/venues/${id}/status`, {
      method: "PATCH",
      body: { status },
      token,
    });
  },
  deleteVenue(token: string, id: string) {
    return request<{ success: boolean }>(`/admin/venues/${id}`, {
      method: "DELETE",
      token,
    });
  },
  createWaterQuality(token: string, venueId: string, body: unknown) {
    return request<any>(`/admin/venues/${venueId}/water-quality`, {
      method: "POST",
      body,
      token,
    });
  },
  listCities(token: string) {
    return request<any[]>("/admin/cities", { token });
  },
  createCity(token: string, body: unknown) {
    return request<any>("/admin/cities", {
      method: "POST",
      body,
      token,
    });
  },
  updateCity(token: string, id: string, body: unknown) {
    return request<any>(`/admin/cities/${id}`, {
      method: "PATCH",
      body,
      token,
    });
  },
  listReviews(token: string, query = "") {
    return request<any[]>(`/admin/reviews${query}`, { token });
  },
  updateReviewStatus(
    token: string,
    id: string,
    body: { status: "normal" | "disabled" | "deleted"; reason?: string },
  ) {
    return request<any>(`/admin/reviews/${id}/status`, {
      method: "PATCH",
      body,
      token,
    });
  },
  listFollows(token: string, query = "") {
    return request<any[]>(`/admin/follows${query}`, { token });
  },
  listUsers(token: string, query = "") {
    return request<any[]>(`/admin/users${query}`, { token });
  },
  createUser(token: string, body: unknown) {
    return request<any>("/admin/users", {
      method: "POST",
      body,
      token,
    });
  },
  updateUserStatus(token: string, id: string, status: "active" | "disabled") {
    return request<any>(`/admin/users/${id}/status`, {
      method: "PATCH",
      body: { status },
      token,
    });
  },
  deleteUser(token: string, id: string) {
    return request<{ success: boolean }>(`/admin/users/${id}`, {
      method: "DELETE",
      token,
    });
  },
  listAdminAccounts(token: string) {
    return request<any[]>("/admin/accounts", { token });
  },
  createAdminAccount(token: string, body: unknown) {
    return request<any>("/admin/accounts", {
      method: "POST",
      body,
      token,
    });
  },
  deleteAdminAccount(token: string, id: string) {
    return request<{ success: boolean }>(`/admin/accounts/${id}`, {
      method: "DELETE",
      token,
    });
  },
};
