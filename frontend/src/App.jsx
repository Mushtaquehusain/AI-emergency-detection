import Disclaimer from "./components/Disclaimer.jsx";
import LiveMonitor from "./components/LiveMonitor.jsx";
import AlertDashboard from "./components/AlertDashboard.jsx";

export default function App() {
  return (
    <div className="app">
      <header>
        <p className="eyebrow">College MVP · Stage 1.5</p>
        <h1>AI-Based Smart Emergency Detection &amp; Response System</h1>
        <p className="sub">
          Webcam or local video → JPEG frames → Express → FastAPI AI → MongoDB
        </p>
      </header>
      <Disclaimer />
      <LiveMonitor />
      <AlertDashboard />
    </div>
  );
}
