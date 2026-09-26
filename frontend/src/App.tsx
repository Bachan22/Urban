import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./layouts/DashboardLayout";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import MapPage from "./pages/MapPage";
import OpportunitiesPage from "./pages/OpportunitiesPage";
import ComparePage from "./pages/ComparePage";
import SimulatorPage from "./pages/SimulatorPage";
import FuturePage from "./pages/FuturePage";
import AskPage from "./pages/AskPage";
import ReportsPage from "./pages/ReportsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<LandingPage />} />

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
        </Route>

        {/* Catch-all redirect to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}