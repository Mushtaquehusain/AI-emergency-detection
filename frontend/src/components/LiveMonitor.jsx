import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeFrame, getHealth } from "../api/client";
import { useFrameSampler } from "../hooks/useFrameSampler";

function emptyScores() {
  return { fire: 0, accident: 0, violence: 0 };
}

export default function LiveMonitor() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const fileUrlRef = useRef(null);

  const sessionId = useMemo(
    () => `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  const [source, setSource] = useState("webcam");
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState("");
  const [latest, setLatest] = useState(null);
  const [recentAlerts, setRecentAlerts] = useState([]);

  const { sampling, startSampling, stopSampling } = useFrameSampler({
    videoRef,
    canvasRef,
    fps: 5,
    onFrame: async (blob) => {
      try {
        const result = await analyzeFrame({
          blob,
          sessionId,
          source,
        });
        setLatest(result);
        setError("");
        setStatus("Analysis running — Emergency detection active");
        
        // Handle confirmed alerts
        if (result.confirmedAlerts && result.confirmedAlerts.length > 0) {
          setRecentAlerts((prev) => [
            ...result.confirmedAlerts,
            ...prev,
          ].slice(0, 10)); // Keep last 10 alerts
        }
      } catch (err) {
        setError(err.message || "Analyze request failed");
        setStatus("Analysis error");
      }
    },
  });

  function releaseWebcam() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function releaseFileUrl() {
    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current);
      fileUrlRef.current = null;
    }
  }

  async function startCamera() {
    setError("");
    stopSampling();
    releaseFileUrl();
    releaseWebcam();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setSource("webcam");
      const video = videoRef.current;
      video.srcObject = stream;
      video.src = "";
      await video.play();
      setStatus("Webcam ready");
    } catch (err) {
      setStatus("Webcam unavailable");
      setError(err.message || "Could not access the webcam");
    }
  }

  function stopCamera() {
    stopSampling();
    releaseWebcam();
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
    setStatus("Camera stopped");
  }

  function onFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    stopSampling();
    releaseWebcam();
    releaseFileUrl();
    const url = URL.createObjectURL(file);
    fileUrlRef.current = url;
    setSource("file");
    const video = videoRef.current;
    video.srcObject = null;
    video.src = url;
    video.play().catch(() => {});
    setStatus(`Video file loaded: ${file.name}`);
    setError("");
    event.target.value = "";
  }

  async function startAnalysis() {
    const video = videoRef.current;
    if (!video || (video.readyState < 2 && !video.srcObject && !video.src)) {
      setError("Start the webcam or choose a video file first.");
      return;
    }
    setError("");
    try {
      await getHealth();
    } catch (err) {
      setError(`Express is not reachable: ${err.message}`);
      setStatus("Backend offline");
      return;
    }
    startSampling();
    setStatus("Sampling ~5 FPS and sending JPEGs to Express");
  }

  function stopAnalysis() {
    stopSampling();
    setStatus("Analysis stopped");
  }

  function stopAll() {
    stopSampling();
    releaseWebcam();
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    setStatus("Stopped — webcam released, no more requests");
  }

  const scores = latest?.scores || emptyScores();
  const image = latest?.image;
  const detections = latest?.detections ?? [];
  const confirmed = latest?.confirmed ?? [];

  useEffect(() => {
    const overlay = overlayRef.current;
    const video = videoRef.current;
    if (!overlay || !video) {
      return;
    }
    const width = video.clientWidth || image?.width || 0;
    const height = video.clientHeight || image?.height || 0;
    if (!width || !height) {
      return;
    }
    overlay.width = width;
    overlay.height = height;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    if (!image?.width || !image?.height || detections.length === 0) {
      return;
    }
    const scaleX = width / image.width;
    const scaleY = height / image.height;
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.fillStyle = "#22d3ee";
    detections.forEach((det) => {
      const [x1, y1, x2, y2] = det.box || [];
      if ([x1, y1, x2, y2].some((v) => v === undefined)) {
        return;
      }
      const left = x1 * scaleX;
      const top = y1 * scaleY;
      const boxW = (x2 - x1) * scaleX;
      const boxH = (y2 - y1) * scaleY;
      ctx.strokeRect(left, top, boxW, boxH);
      const label = `${det.type} ${Number(det.confidence).toFixed(2)}`;
      ctx.fillText(label, left + 4, Math.max(12, top - 4));
    });
  }, [detections, image]);

  return (
    <section className="monitor">
      <div className="preview-panel">
        <div className="preview-wrap">
          <video ref={videoRef} className="preview" playsInline muted />
          <canvas ref={overlayRef} className="overlay-canvas" />
        </div>
        <canvas ref={canvasRef} className="hidden-canvas" />
        <div className="controls">
          <button type="button" onClick={startCamera}>
            Start Camera
          </button>
          <button type="button" onClick={stopCamera}>
            Stop Camera
          </button>
          <button type="button" onClick={startAnalysis} disabled={sampling}>
            Start Analysis
          </button>
          <button type="button" onClick={stopAnalysis} disabled={!sampling}>
            Stop Analysis
          </button>
          <button type="button" className="secondary" onClick={stopAll}>
            Stop All
          </button>
          <label className="file-picker">
            Load video file
            <input type="file" accept="video/*" onChange={onFileChange} />
          </label>
        </div>
      </div>

      <div className="status-panel">
        <p>
          <span className="label">Status</span>
          {status}
        </p>
        <p>
          <span className="label">Source</span>
          {source}
        </p>
        <p>
          <span className="label">Session</span>
          {sessionId}
        </p>
        {error ? <p className="error">{error}</p> : null}

        <h2>Latest YOLO result</h2>
        <p>
          <span className="label">Image</span>
          {image
            ? `${image.width} × ${image.height}`
            : "No frame analyzed yet"}
        </p>
        <div className="scores">
          <div>
            <span>FIRE</span>
            <strong>{Number(scores.fire ?? 0).toFixed(2)}</strong>
          </div>
          <div>
            <span>ACCIDENT</span>
            <strong>{Number(scores.accident ?? 0).toFixed(2)}</strong>
          </div>
          <div>
            <span>VIOLENCE</span>
            <strong>{Number(scores.violence ?? 0).toFixed(2)}</strong>
          </div>
        </div>
        <p>
          <span className="label">Model</span>
          {latest?.model || "loading"}
          {latest?.inference_ms != null ? ` · ${latest.inference_ms} ms` : ""}
        </p>
        <p>
          <span className="label">Detections</span>
          {detections.length === 0 ? "none" : `${detections.length} object(s)`}
        </p>
        {detections.length > 0 ? (
          <ul className="detection-list">
            {detections.map((det, index) => (
              <li key={`${det.type}-${index}`}>
                {det.type} · {Number(det.confidence).toFixed(2)} · [
                {(det.box || []).map((v) => Math.round(v)).join(", ")}]
              </li>
            ))}
          </ul>
        ) : null}
        <p>
          <span className="label">Confirmation</span>
          {Array.isArray(confirmed) && confirmed.length === 0
            ? "[] (none confirmed)"
            : JSON.stringify(confirmed)}
        </p>
        
        <h2>Recent Alerts</h2>
        {recentAlerts.length === 0 ? (
          <p className="empty-state">No alerts confirmed yet</p>
        ) : (
          <ul className="recent-alerts">
            {recentAlerts.map((alert, index) => (
              <li key={index} className="alert-item">
                <strong>{alert.alert?.type}</strong>
                <span>Confidence: {Number(alert.alert?.confidence).toFixed(2)}</span>
                <span className="routing-info">{alert.routing?.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
