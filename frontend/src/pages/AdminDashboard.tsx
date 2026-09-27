import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Wifi,
  Activity,
  TrendingUp,
  AlertCircle,
  Loader,
} from "lucide-react";
import axios from "axios";
import "../styles/AdminDashboard.css";

interface AdminStats {
  users: number;
  devices: number;
  active_devices: number;
  data_points: number;
}

interface User {
  id: number;
  email: string;
  username: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface Device {
  id: string;
  name: string;
  device_type: string;
  status: string;
  latitude: number;
  longitude: number;
  last_heartbeat?: string;
}

export default function AdminDashboard() {
  const { isAdmin, accessToken, logout } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const API_URL = "http://localhost:8000";

  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }

    const fetchAdminData = async () => {
      try {
        const headers = { Authorization: `Bearer ${accessToken}` };

        const [statsRes, usersRes, devicesRes] = await Promise.all([
          axios.get(`${API_URL}/api/admin/stats`, { headers }),
          axios.get(`${API_URL}/api/admin/users`, { headers }),
          axios.get(`${API_URL}/api/admin/devices`, { headers }),
        ]);

        setStats(statsRes.data);
        setUsers(usersRes.data);
        setDevices(devicesRes.data);
      } catch (err: any) {
        setError(err.response?.data?.detail || "Failed to load admin data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdminData();
  }, [isAdmin, navigate, accessToken]);

  const toggleUserStatus = async (userId: number) => {
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      await axios.patch(`${API_URL}/api/admin/users/${userId}/activate`, {}, { headers });

      // Refresh users list
      const usersRes = await axios.get(`${API_URL}/api/admin/users`, { headers });
      setUsers(usersRes.data);
    } catch (err: any) {
      setError("Failed to update user status");
    }
  };

  const deviceStats = useMemo(() => {
    const online = devices.filter((d) => d.status === "online").length;
    const offline = devices.filter((d) => d.status === "offline").length;
    const error_count = devices.filter((d) => d.status === "error").length;
    return { online, offline, error: error_count };
  }, [devices]);

  if (isLoading) {
    return (
      <div className="admin-loading">
        <Loader className="spinner" size={40} />
        <p>Loading admin dashboard...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <button className="logout-btn" onClick={logout}>
          Logout
        </button>
      </div>

      {error && (
        <div className="admin-error">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon users-icon">
              <Users size={24} />
            </div>
            <div className="stat-content">
              <p className="stat-label">Total Users</p>
              <h3>{stats.users}</h3>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon devices-icon">
              <Wifi size={24} />
            </div>
            <div className="stat-content">
              <p className="stat-label">IoT Devices</p>
              <h3>{stats.devices}</h3>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon active-icon">
              <Activity size={24} />
            </div>
            <div className="stat-content">
              <p className="stat-label">Active Devices</p>
              <h3>{stats.active_devices}</h3>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon data-icon">
              <TrendingUp size={24} />
            </div>
            <div className="stat-content">
              <p className="stat-label">Data Points (24h)</p>
              <h3>{stats.data_points}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Device Status Overview */}
      <div className="section">
        <h2>Device Status Overview</h2>
        <div className="device-status">
          <div className="status-item online">
            <span className="status-dot"></span>
            <span>Online: {deviceStats.online}</span>
          </div>
          <div className="status-item offline">
            <span className="status-dot"></span>
            <span>Offline: {deviceStats.offline}</span>
          </div>
          <div className="status-item error">
            <span className="status-dot"></span>
            <span>Error: {deviceStats.error}</span>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="section">
        <h2>Users</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.username}</td>
                  <td>{user.role}</td>
                  <td>
                    <span className={`badge ${user.is_active ? "active" : "inactive"}`}>
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="action-btn"
                      onClick={() => toggleUserStatus(user.id)}
                    >
                      {user.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Devices Table */}
      <div className="section">
        <h2>IoT Devices</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Device ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Location</th>
                <th>Last Heartbeat</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id}>
                  <td className="monospace">{device.id.substring(0, 16)}...</td>
                  <td>{device.name}</td>
                  <td>{device.device_type}</td>
                  <td>
                    <span className={`badge ${device.status}`}>
                      {device.status}
                    </span>
                  </td>
                  <td>
                    ({device.latitude.toFixed(2)}, {device.longitude.toFixed(2)})
                  </td>
                  <td>
                    {device.last_heartbeat
                      ? new Date(device.last_heartbeat).toLocaleString()
                      : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
