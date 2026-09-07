import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { FollowsPage } from "@/pages/follows/FollowsPage";
import { LoginPage } from "@/pages/login/LoginPage";
import { ReviewsPage } from "@/pages/reviews/ReviewsPage";
import { SettingsAccountsPage } from "@/pages/settings-accounts/SettingsAccountsPage";
import { SettingsCitiesPage } from "@/pages/settings-cities/SettingsCitiesPage";
import { UsersPage } from "@/pages/users/UsersPage";
import { VenuesPage } from "@/pages/venues/VenuesPage";
import { useAuthStore } from "@/stores/auth-store";

function ProtectedLayout() {
  const currentAdmin = useAuthStore((state) => state.currentAdmin);

  if (!currentAdmin) {
    return <Navigate replace to="/login" />;
  }

  return <AppShell />;
}

export function AppRouter() {
  const currentAdmin = useAuthStore((state) => state.currentAdmin);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={currentAdmin ? <Navigate replace to="/venues" /> : <LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Navigate replace to="/venues" />} />
          <Route path="/venues" element={<VenuesPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/follows" element={<FollowsPage />} />
          <Route path="/settings/cities" element={<SettingsCitiesPage />} />
          <Route path="/settings/accounts" element={<SettingsAccountsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
