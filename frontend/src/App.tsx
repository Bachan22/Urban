import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import DashboardLayout from "./layouts/DashboardLayout";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import MapPage from "./pages/MapPage";
import OpportunitiesPage from "./pages/OpportunitiesPage";
import ComparePage from "./pages/ComparePage";
import SimulatorPage from "./pages/SimulatorPage";
import FuturePage from "./pages/FuturePage";
import AskPage from "./pages/AskPage";
import ReportsPage from "./pages/ReportsPage";
import AdminDashboard from "./pages/AdminDashboard";
import IoTManagement from "./pages/IoTManagement";

function ProtectedRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      {/* Public Landing Page */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Protected Routes */}
      {isAuthenticated ? (
        <>
          {/* Dashboard Shell with Persistent Sidebar and Top Navigation */}
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/opportunities" element={<OpportunitiesPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/simulator" element={<SimulatorPage />} />
            <Route path="/future" element={<FuturePage />} />
            <Route path="/ask" element={<AskPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/iot" element={<IoTManagement />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </>
      ) : (
        <Route path="/dashboard*" element={<Navigate to="/login" replace />} />
      )}

      {/* Catch-all redirect to Home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ProtectedRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}