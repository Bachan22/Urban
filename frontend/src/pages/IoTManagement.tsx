import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Plus, Trash2, RefreshCw, Wifi, AlertCircle, Loader } from "lucide-react";
import axios from "axios";
import "../styles/IoTManagement.css";

interface IoTDevice {
  id: string;
  name: string;
  device_type: string;
  latitude: number;
  longitude: number;
  status: string;
  last_heartbeat?: string;
  created_at: string;
}

export default function IoTManagement() {
  const { accessToken } = useAuth();
  const [devices, setDevices] = useState<IoTDevice[]>([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    device_type: "sensor",
    latitude: "0",
    longitude: "0",
  });

  const API_URL = "http://localhost:8000";

  const fetchDevices = async () => {
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const response = await axios.get(`${API_URL}/api/iot/devices`, { headers });
      setDevices(response.data);
      setError("");
    } catch (err: any) {
      setError("Failed to load devices");
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [accessToken]);

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const payload = {
        name: formData.name,
        device_type: formData.device_type,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        metadata: {},
      };

      await axios.post(`${API_URL}/api/iot/devices`, payload, { headers });
      setFormData({ name: "", device_type: "sensor", latitude: "0", longitude: "0" });
      setShowForm(false);
      await fetchDevices();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create device");
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!window.confirm("Are you sure you want to delete this device?")) return;

    try {
      // Note: We'll need to add delete endpoint in backend
      console.log("Deleting device:", deviceId);
      setError("Delete functionality coming soon");
    } catch (err: any) {
      setError("Failed to delete device");
    }
  };

  if (devices.length === 0 && !showForm) {
    return (
      <div className="iot-loading">
        <Loader className="spinner" size={40} />
        <p>Loading IoT devices...</p>
      </div>
    );
  }

  return (
    <div className="iot-container">
      <div className="iot-header">
        <div>
          <h1>IoT Devices Management</h1>
          <p className="subtitle">Manage and monitor your IoT devices</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={20} />
          Add Device
        </button>
      </div>

      {error && (
        <div className="error-alert">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <div className="device-form-card">
          <h2>Add New IoT Device</h2>
          <form onSubmit={handleAddDevice}>
            <div className="form-row">
              <div className="form-group">
                <label>Device Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Temperature Sensor 1"
                  required
                />
              </div>
              <div className="form-group">
                <label>Device Type</label>
                <select
                  value={formData.device_type}
                  onChange={(e) => setFormData({ ...formData, device_type: e.target.value })}
                >
                  <option value="sensor">Sensor</option>
                  <option value="camera">Camera</option>
                  <option value="gateway">Gateway</option>
                  <option value="actuator">Actuator</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  placeholder="0.0"
                  required
                />
              </div>
              <div className="form-group">
                <label>Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  placeholder="0.0"
                  required
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">
                Create Device
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Devices Grid */}
      <div className="devices-section">
        <div className="devices-header">
          <h2>Your Devices ({devices.length})</h2>
          <button className="btn-refresh" onClick={fetchDevices}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {devices.length === 0 ? (
          <div className="empty-state">
            <Wifi size={48} />
            <h3>No IoT devices yet</h3>
            <p>Create your first IoT device to get started</p>
          </div>
        ) : (
          <div className="devices-grid">
            {devices.map((device) => (
              <div key={device.id} className="device-card">
                <div className="device-header">
                  <div className="device-title">
                    <Wifi size={20} />
                    <div>
                      <h3>{device.name}</h3>
                      <p className="device-id">{device.id.substring(0, 12)}...</p>
                    </div>
                  </div>
                  <button
                    className="btn-delete"
                    onClick={() => handleDeleteDevice(device.id)}
                    title="Delete device"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="device-body">
                  <div className="device-detail">
                    <span className="label">Type</span>
                    <span className="value">{device.device_type}</span>
                  </div>

                  <div className="device-detail">
                    <span className="label">Status</span>
                    <span className={`status-badge ${device.status}`}>
                      {device.status}
                    </span>
                  </div>

                  <div className="device-detail">
                    <span className="label">Location</span>
                    <span className="value">
                      {device.latitude.toFixed(4)}, {device.longitude.toFixed(4)}
                    </span>
                  </div>

                  <div className="device-detail">
                    <span className="label">Last Heartbeat</span>
                    <span className="value">
                      {device.last_heartbeat
                        ? new Date(device.last_heartbeat).toLocaleString()
                        : "Never"}
                    </span>
                  </div>

                  <div className="device-detail">
                    <span className="label">Created</span>
                    <span className="value">
                      {new Date(device.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="device-footer">
                  <button className="btn-view">View Data</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
