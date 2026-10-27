import { useState } from "react";
import Disclaimer from "./components/Disclaimer.jsx";
import CameraGrid from "./components/CameraGrid.jsx";
import EnhancedDashboard from "./components/EnhancedDashboard.jsx";

export default function App() {
  const [monitoring, setMonitoring] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState([]);

  function handleAlert(alert) {
    setRecentAlerts((prev) => [alert, ...prev].slice(0, 6));
  }

  function toggleMonitoring() {
    setMonitoring((prev) => !prev);
  }

  return (
    <div className="app">
      <header>
        <p className="eyebrow">College MVP · Multi-Camera Emergency Detection</p>
        <h1>AI-Based Smart Emergency Detection &amp; Response System</h1>
        <p className="sub">
          Multi-camera monitoring → AI detection → Simulated emergency response
        </p>
        <div className="global-controls">
          <button
            type="button"
            onClick={toggleMonitoring}
            className={monitoring ? "stop-btn" : "start-btn"}
          >
            {monitoring ? "⏹ Stop Monitoring" : "▶ Start Monitoring"}
          </button>
          {recentAlerts.length > 0 && (
            <span className="alert-count">
              {recentAlerts.length} recent alert{recentAlerts.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </header>
      <Disclaimer />
      <CameraGrid onAlert={handleAlert} monitoring={monitoring} />
      <EnhancedDashboard monitoring={monitoring} recentAlerts={recentAlerts} />
    </div>
  );
}
