import React, { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  MapPin,
  GitCompare,
  FileText,
  ChevronRight,
  ShieldAlert,
  Home,
  Menu,
  X,
} from "lucide-react";

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: "GIS Map", path: "/map", icon: <MapPin size={18} /> },
  { label: "Compare", path: "/compare", icon: <GitCompare size={18} /> },
  { label: "Reports", path: "/reports", icon: <FileText size={18} /> },
];

export const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const currentNav = navItems.find((item) => item.path === location.pathname);

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      {/* SIDEBAR */}
      <aside
        style={{
          width: sidebarOpen ? "250px" : "72px",
          backgroundColor: "#08143a",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.2s ease-in-out",
          borderRight: "1px solid #1e293b",
          flexShrink: 0,
        }}
      >
        {/* LOGO & BRAND */}
        <div
          style={{
            height: "64px",
            display: "flex",
            alignItems: "center",
            justifyContent: sidebarOpen ? "space-between" : "center",
            padding: "0 18px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          {sidebarOpen ? (
            <Link
              to="/"
              style={{
                fontSize: "20px",
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: "-0.5px",
                textDecoration: "none",
              }}
            >
              Urban<span style={{ color: "#38bdf8" }}>IQ</span>
            </Link>
          ) : (
            <Link
              to="/"
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: "#38bdf8",
                textDecoration: "none",
              }}
            >
              UIQ
            </Link>
          )}

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              padding: "4px",
              cursor: "pointer",
            }}
            title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* NAVIGATION ITEMS */}
        <nav style={{ flex: 1, padding: "16px 10px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {navItems.map((item) => {
            let targetPath = item.path;
            if (item.path === "/map") {
              try {
                const raw = localStorage.getItem("urbaniq.latestAnalysisReport");
                if (raw) {
                  const r = JSON.parse(raw);
                  if (r.businessType && r.city) {
                    const q = new URLSearchParams({
                      business: r.businessType,
                      city: r.city,
                      lat: r.latitude.toFixed(5),
                      lon: r.longitude.toFixed(5),
                      radius: ((r.radiusMeters || 2000) / 1000).toString(),
                    });
                    if (r.areaName) q.set("location", r.areaName);
                    targetPath = `/map?${q.toString()}`;
                  }
                }
              } catch (e) {
                // fallback to /map
              }
            }

            return (
              <NavLink
                key={item.path}
                to={targetPath}
                style={({ isActive }) => ({
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#ffffff" : "#94a3b8",
                  backgroundColor: isActive ? "#1e3a8a" : "transparent",
                  transition: "all 0.15s ease",
                  textDecoration: "none",
                })}
                title={!sidebarOpen ? item.label : undefined}
              >
                <span style={{ display: "flex", alignItems: "center" }}>{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* SIDEBAR FOOTER / LANDING LINK */}
        <div
          style={{
            padding: "14px 16px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: "#64748b",
              fontSize: "13px",
              textDecoration: "none",
            }}
          >
            <Home size={16} />
            {sidebarOpen && <span>Landing Page</span>}
          </Link>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* HEADER */}
        <header
          style={{
            height: "64px",
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 28px",
          }}
        >
          {/* Breadcrumb / Title */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#64748b", fontSize: "14px" }}>
            <span>UrbanIQ</span>
            <ChevronRight size={14} />
            <span style={{ fontWeight: 600, color: "#0f172a" }}>
              {currentNav?.label || "Platform"}
            </span>
          </div>

          {/* Data Honesty Status Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                backgroundColor: "#fef3c7",
                color: "#92400e",
                padding: "4px 10px",
                borderRadius: "9999px",
                fontSize: "12px",
                fontWeight: 600,
                border: "1px solid #fde68a",
              }}
              title="Scores and metrics are prototype/estimated approximations and not commercial investment guarantees."
            >
              <ShieldAlert size={14} />
              <span>Prototype & Proxy Data Mode</span>
            </div>
          </div>
        </header>

        {/* OUTLET: The inner page renders here */}
        <main style={{ flex: 1, padding: "28px", overflowY: "auto" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
