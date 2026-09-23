import { useEffect, useState } from "react";
import { getAlerts } from "../api/client";

export default function AlertDashboard() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAlerts();
    // Refresh alerts every 5 seconds
    const interval = setInterval(loadAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadAlerts() {
    try {
      setError("");
      const data = await getAlerts(50);
      setAlerts(data);
      setLoading(false);
    } catch (err) {
      setError(err.message || "Failed to load alerts");
      setLoading(false);
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

  return (
    <section className="dashboard">
      <div className="dashboard-header">
        <h2>Alert Dashboard</h2>
        <button type="button" onClick={loadAlerts} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {alerts.length === 0 && !loading && (
        <p className="empty-state">No alerts recorded yet</p>
      )}

      {alerts.length > 0 && (
        <div className="alerts-list">
          {alerts.map((alert) => (
            <div key={alert._id} className="alert-card">
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
                  <span className="label">Source</span>
                  {alert.source || "unknown"}
                </p>
                <p>
                  <span className="label">Routed to</span>
                  {alert.routedTo?.join(", ") || "none"}
                </p>
                <p>
                  <span className="label">Session</span>
                  {alert.sessionId || "unknown"}
                </p>
                {alert.scores && (
                  <div className="alert-scores">
                    <span>FIRE: {Number(alert.scores.fire ?? 0).toFixed(2)}</span>
                    <span>ACCIDENT: {Number(alert.scores.accident ?? 0).toFixed(2)}</span>
                    <span>VIOLENCE: {Number(alert.scores.violence ?? 0).toFixed(2)}</span>
                  </div>
                )}
                {alert.snapshotPath && (
                  <p className="snapshot-info">
                    <span className="label">Snapshot</span>
                    {alert.snapshotPath}
                  </p>
                )}
                <p className="disclaimer">{alert.disclaimer}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
