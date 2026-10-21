import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import "./App.css";
import DashboardLayout from "./layouts/DashboardLayout";
import LandingPage from "./pages/LandingPage";
import MapPage from "./pages/MapPage";
import ComparePage from "./pages/ComparePage";
import SimulatorPage from "./pages/SimulatorPage";
import FuturePage from "./pages/FuturePage";
import AskPage from "./pages/AskPage";
import ReportsPage from "./pages/ReportsPage";
import AdminDashboard from "./pages/AdminDashboard";
import IoTManagement from "./pages/IoTManagement";

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/analysis" element={<Navigate to="/map" replace />} />
      <Route path="/dashboard" element={<Navigate to="/map" replace />} />
      <Route path="/opportunities" element={<Navigate to="/map" replace />} />
      <Route element={<DashboardLayout />}>
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/simulator" element={<SimulatorPage />} />
        <Route path="/future" element={<FuturePage />} />
        <Route path="/ask" element={<AskPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/iot" element={isAuthenticated ? <IoTManagement /> : <Navigate to="/map" replace />} />
        <Route path="/admin" element={isAuthenticated ? <AdminDashboard /> : <Navigate to="/map" replace />} />
      </Route>

      {/* Account screens are removed from the public product flow. */}
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/signup" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
