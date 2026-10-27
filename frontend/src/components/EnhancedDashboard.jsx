import { useEffect, useState } from "react";
import { getAlerts, recordAlertAction } from "../api/client";
import { useSoundAlert } from "../hooks/useSoundAlert";
import GoogleMap from "./GoogleMap";

export default function EnhancedDashboard({ monitoring = false, recentAlerts = [] }) {
  const [alerts, setAlerts] = useState([]);
  const [filteredAlerts, setFilteredAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ category: "", camera: "", status: "" });
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [backendHealth, setBackendHealth] = useState("unknown");
  const [aiHealth, setAiHealth] = useState("unknown");
  const [dbConnected, setDbConnected] = useState("unknown");

  const {
    muted,
    activeAlert,
    isAlarming,
    playAlertSound,
    stopSound,
    acknowledgeAlert,
    toggleMute,
    cleanup,
  } = useSoundAlert({ monitoring });

  useEffect(() => {
    loadAlerts();
    checkHealth();
    const interval = setInterval(loadAlerts, 5000);
    const healthInterval = setInterval(checkHealth, 30000);
    return () => {
      clearInterval(interval);
      clearInterval(healthInterval);
      cleanup();
    };
  }, []);

  // Trigger alarm on new confirmed emergency during active monitoring
  useEffect(() => {
    if (monitoring && recentAlerts.length > 0) {
      const latest = recentAlerts[0];
      const alertId = latest._id || latest.id || `alert-${latest.timestamp || Date.now()}`;
      playAlertSound(alertId);
    }
  }, [recentAlerts, monitoring, playAlertSound]);

  useEffect(() => {
    let filtered = alerts;
    if (filter.category) {
      filtered = filtered.filter((a) => a.type === filter.category);
    }
    if (filter.camera) {
      filtered = filtered.filter((a) => a.cameraId === filter.camera);
    }
    if (filter.status) {
      filtered = filtered.filter((a) => a.status === filter.status);
    }
    setFilteredAlerts(filtered.slice(0, 6));
  }, [alerts, filter]);

  useEffect(() => {
    loadAlerts();
  }, [filter.category, filter.camera, filter.status, recentAlerts]);

  async function loadAlerts() {
    try {
      const data = await getAlerts(6, filter.category, filter.camera, filter.status);
      const limited = Array.isArray(data) ? data.slice(0, 6) : [];
      setAlerts(limited);
      setLoading(false);
      
      // Play sound for new alerts only during active monitoring
      if (monitoring) {
        const newAlerts = limited.filter((a) => a.status === "SIMULATED");
        newAlerts.forEach((alert) => {
          playAlertSound(alert._id);
        });
      }
    } catch (err) {
      console.error("Failed to load alerts:", err);
      setAlerts([]);
      setLoading(false);
    }
  }

  async function checkHealth() {
    try {
      const response = await fetch("/api/health");
      const data = await response.json().catch(() => ({}));
      setBackendHealth(response.ok && data.ok ? "ok" : "error");
      setAiHealth(data.ai === "ok" ? "ok" : "error");
      setDbConnected(data.db === "ok" ? "ok" : "error");
    } catch {
      setBackendHealth("error");
      setAiHealth("error");
      setDbConnected("error");
    }
  }

  async function handleAction(action) {
    if (!selectedAlert) return;

    try {
      await recordAlertAction(selectedAlert._id, action);
      await loadAlerts();
      setShowActionDialog(false);
      setSelectedAlert(null);
      
      if (action === "ACKNOWLEDGE" || action === "RESOLVE") {
        acknowledgeAlert(selectedAlert._id);
      }
    } catch (err) {
      console.error("Failed to record action:", err);
    }
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  function getEmergencyColor(type) {
    switch (type) {
      case "FIRE":
        return "#ef4444";
      case "ACCIDENT":
        return "#f59e0b";
      case "VIOLENCE":
        return "#8b5cf6";
      default:
        return "#6b7280";
    }
  }

  const cameras = [...new Set(alerts.map((a) => a.cameraId).filter(Boolean))];

  return (
    <section className="enhanced-dashboard">
      <div className="dashboard-header">
        <h2>Emergency Dashboard</h2>
        <div className="health-indicators">
          <span className={`health ${backendHealth}`}>
            Backend: {backendHealth}
          </span>
          <span className={`health ${aiHealth}`}>
            AI: {aiHealth}
          </span>
          <span className={`health ${dbConnected}`}>
            DB: {dbConnected}
          </span>
        </div>
        <div className="sound-controls">
          <button
            type="button"
            onClick={toggleMute}
            className={muted ? "muted" : ""}
          >
            {muted ? "🔇 Unmute" : "🔊 Mute"}
          </button>
          {(isAlarming || activeAlert) && (
            <>
              <button
                type="button"
                onClick={stopSound}
                className="stop-sound-btn"
                style={{ background: "#dc2626", color: "white", fontWeight: "bold" }}
              >
                ⏹ Stop Sound
              </button>
              <button
                type="button"
                onClick={() => acknowledgeAlert(activeAlert)}
                className="ack-sound-btn"
                style={{ background: "#d97706", color: "white", fontWeight: "bold" }}
              >
                ✓ Acknowledge Alert
              </button>
            </>
          )}
        </div>
      </div>

      <div className="dashboard-filters">
        <select
          value={filter.category}
          onChange={(e) => setFilter({ ...filter, category: e.target.value })}
        >
          <option value="">All Categories</option>
          <option value="FIRE">FIRE</option>
          <option value="ACCIDENT">ACCIDENT</option>
          <option value="VIOLENCE">VIOLENCE</option>
        </select>
        <select
          value={filter.camera}
          onChange={(e) => setFilter({ ...filter, camera: e.target.value })}
        >
          <option value="">All Cameras</option>
          {cameras.map((cam) => (
            <option key={cam} value={cam}>
              {cam}
            </option>
          ))}
        </select>
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
        >
          <option value="">All Status</option>
          <option value="SIMULATED">SIMULATED</option>
          <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
          <option value="RESOLVED">RESOLVED</option>
        </select>
      </div>

      <div className="dashboard-content">
        <div className="alerts-section">
          <h3>Recent Alerts ({filteredAlerts.length})</h3>
          {dbConnected === "error" && (
            <p className="warning">
              Database not connected. Configure MONGO_URI to enable alert persistence.
            </p>
          )}
          {loading ? (
            <p>Loading...</p>
          ) : filteredAlerts.length === 0 ? (
            <p className="empty-state">No alerts match current filters</p>
          ) : (
            <div className="alerts-list">
              {filteredAlerts.map((alert) => (
                <div
                  key={alert._id}
                  className={`alert-card ${alert.status.toLowerCase()}`}
                  onClick={() => setSelectedAlert(alert)}
                >
                  <div
                    className="alert-type"
                    style={{ backgroundColor: getEmergencyColor(alert.type) }}
                  >
                    {alert.type}
                  </div>
                  <div className="alert-details">
                    <p>
                      <span className="label">Confidence</span>
                      {Number(alert.confidence).toFixed(2)}
                    </p>
                    <p>
                      <span className="label">Time</span>
                      {formatTime(alert.createdAt)}
                    </p>
                    <p>
                      <span className="label">Camera</span>
                      {alert.cameraLabel || alert.cameraId || "Unknown"}
                    </p>
                    <p>
                      <span className="label">Status</span>
                      {alert.status}
                    </p>
                    {alert.location && (
                      <p>
                        <span className="label">Location</span>
                        {alert.location.label ||
                          `${alert.location.lat.toFixed(4)}, ${alert.location.lng.toFixed(4)}`}
                      </p>
                    )}
                    {alert.actions && alert.actions.length > 0 && (
                      <div className="alert-actions">
                        <span className="label">Actions:</span>
                        {alert.actions.map((action, idx) => (
                          <span key={idx} className="action-tag">
                            {action.type}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="disclaimer">{alert.disclaimer}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="map-section">
          <h3>Alert Map</h3>
          <GoogleMap alerts={alerts} onMarkerClick={setSelectedAlert} />
        </div>
      </div>

      {showActionDialog && selectedAlert && (
        <div className="action-dialog-overlay">
          <div className="action-dialog">
            <h3>Emergency Response - SIMULATED</h3>
            <div className="dialog-details">
              <p>
                <strong>Type:</strong> {selectedAlert.type}
              </p>
              <p>
                <strong>Confidence:</strong> {Number(selectedAlert.confidence).toFixed(2)}
              </p>
              <p>
                <strong>Camera:</strong> {selectedAlert.cameraLabel || selectedAlert.cameraId}
              </p>
              <p>
                <strong>Time:</strong> {formatTime(selectedAlert.createdAt)}
              </p>
              {selectedAlert.location && (
                <p>
                  <strong>Location:</strong> {selectedAlert.location.label ||
                    `${selectedAlert.location.lat.toFixed(4)}, ${selectedAlert.location.lng.toFixed(4)}`}
                </p>
              )}
            </div>
            <div className="dialog-actions">
              <button
                type="button"
                onClick={() => handleAction("CALL_POLICE")}
                className="action-btn police"
              >
                Call Police — Simulation
              </button>
              <button
                type="button"
                onClick={() => handleAction("REQUEST_AMBULANCE")}
                className="action-btn ambulance"
              >
                Request Ambulance — Simulation
              </button>
              <button
                type="button"
                onClick={() => handleAction("FIRE_DEPARTMENT")}
                className="action-btn fire"
              >
                Fire Department — Simulation
              </button>
              <button
                type="button"
                onClick={() => handleAction("ACKNOWLEDGE")}
                className="action-btn acknowledge"
              >
                Acknowledge Alert
              </button>
              <button
                type="button"
                onClick={() => handleAction("RESOLVE")}
                className="action-btn resolve"
              >
                Mark Resolved
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowActionDialog(false);
                  setSelectedAlert(null);
                }}
                className="action-btn cancel"
              >
                Cancel
              </button>
            </div>
            <p className="dialog-disclaimer">
              All actions are SIMULATED. No real emergency services will be contacted.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
