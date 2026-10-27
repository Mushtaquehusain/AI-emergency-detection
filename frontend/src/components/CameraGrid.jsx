import { useEffect, useRef, useState } from "react";
import { analyzeFrame } from "../api/client";

const MAX_CAMERAS = 3;
const JPEG_QUALITY = 0.7;

export default function CameraGrid({ onAlert, monitoring }) {
  const [cameras, setCameras] = useState([]);
  const [availableDevices, setAvailableDevices] = useState([]);
  const selectedDevicesRef = useRef(new Set());
  const samplingIntervalsRef = useRef({});
  const monitoringRef = useRef(monitoring);
  const inFlightRef = useRef({});
  const abortControllersRef = useRef({});
  const startingCamerasRef = useRef(new Set());

  // Keep monitoringRef synchronized with prop
  monitoringRef.current = monitoring;

  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === "videoinput");
        setAvailableDevices(videoDevices.slice(0, MAX_CAMERAS));
        if (videoDevices.length > 0 && selectedDevicesRef.current.size === 0) {
          addCamera(videoDevices[0].deviceId, videoDevices[0].label || "Camera 1");
        }
      } catch (err) {
        console.error("Failed to enumerate devices:", err);
      }
    }
    getDevices();
  }, []);

  function addCamera(deviceId, label) {
    if (cameras.length >= MAX_CAMERAS || selectedDevicesRef.current.has(deviceId)) {
      return;
    }

    const cameraId = `cam-${Date.now()}`;
    const newCamera = {
      id: cameraId,
      deviceId,
      label: label || `Camera ${cameras.length + 1}`,
      videoRef: { current: null },
      canvasRef: { current: null },
      overlayRef: { current: null },
      streamRef: { current: null },
      sessionId: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: "Idle",
      error: "",
      latest: null,
      location: null,
    };

    setCameras((prev) => [...prev, newCamera]);
    selectedDevicesRef.current.add(deviceId);

    if (monitoringRef.current) {
      setTimeout(() => {
        if (monitoringRef.current) {
          startCamera(newCamera);
        }
      }, 50);
    }
  }

  function updateCameraLocation(cameraId, location) {
    setCameras((prev) =>
      prev.map((c) =>
        c.id === cameraId ? { ...c, location } : c
      )
    );
  }

  function removeCamera(cameraId) {
    const camera = cameras.find((c) => c.id === cameraId);
    if (camera) {
      stopCamera(camera);
      selectedDevicesRef.current.delete(camera.deviceId);
    }
    setCameras((prev) => prev.filter((c) => c.id !== cameraId));
  }

  function clearOverlay(camera) {
    const canvas = camera.overlayRef?.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }

  function drawOverlay(camera, result) {
    const canvas = camera.overlayRef?.current;
    const video = camera.videoRef?.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const displayWidth = video.clientWidth;
    const displayHeight = video.clientHeight;

    if (!displayWidth || !displayHeight) return;

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const detections = result?.detections;
    if (!detections || detections.length === 0) return;

    const srcWidth = result?.image?.width || video.videoWidth || displayWidth;
    const srcHeight = result?.image?.height || video.videoHeight || displayHeight;
    if (!srcWidth || !srcHeight) return;

    const videoAspect = srcWidth / srcHeight;
    const displayAspect = displayWidth / displayHeight;

    let renderWidth, renderHeight, offsetX, offsetY;
    if (displayAspect > videoAspect) {
      renderHeight = displayHeight;
      renderWidth = displayHeight * videoAspect;
      offsetX = (displayWidth - renderWidth) / 2;
      offsetY = 0;
    } else {
      renderWidth = displayWidth;
      renderHeight = displayWidth / videoAspect;
      offsetX = 0;
      offsetY = (displayHeight - renderHeight) / 2;
    }

    const scaleX = renderWidth / srcWidth;
    const scaleY = renderHeight / srcHeight;

    detections.forEach((det) => {
      if (!det.box || det.box.length < 4) return;
      const [x1, y1, x2, y2] = det.box;

      const drawX = offsetX + x1 * scaleX;
      const drawY = offsetY + y1 * scaleY;
      const drawW = (x2 - x1) * scaleX;
      const drawH = (y2 - y1) * scaleY;

      let boxColor = "#00f0ff";
      const typeLower = (det.type || "").toLowerCase();
      if (typeLower === "person") {
        boxColor = "#00e5ff";
      } else if (["car", "bus", "truck", "motorcycle", "bicycle"].includes(typeLower)) {
        boxColor = "#00ff88";
      } else {
        boxColor = "#ffb700";
      }

      // Draw bounding box
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX, drawY, drawW, drawH);

      // Label with class name and actual model confidence score
      const confStr = det.confidence != null ? Number(det.confidence).toFixed(2) : "";
      const labelText = `${det.type} ${confStr}`.trim();
      ctx.font = "bold 12px 'Segoe UI', Roboto, sans-serif";
      const textMetrics = ctx.measureText(labelText);
      const textHeight = 14;
      const padX = 6;
      const padY = 3;
      const badgeW = textMetrics.width + padX * 2;
      const badgeH = textHeight + padY * 2;
      const badgeY = drawY >= badgeH ? drawY - badgeH : drawY;

      ctx.fillStyle = "rgba(10, 15, 25, 0.85)";
      ctx.fillRect(drawX, badgeY, badgeW, badgeH);

      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(drawX, badgeY, badgeW, badgeH);

      ctx.fillStyle = "#ffffff";
      ctx.fillText(labelText, drawX + padX, badgeY + badgeH - padY - 2);
    });
  }

  async function startCamera(camera) {
    if (!monitoringRef.current) return;
    if (startingCamerasRef.current.has(camera.id)) return;
    startingCamerasRef.current.add(camera.id);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: camera.deviceId } },
        audio: false,
      });

      if (!monitoringRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        startingCamerasRef.current.delete(camera.id);
        return;
      }

      camera.streamRef.current = stream;
      const video = camera.videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch((e) => console.warn("Video play interrupted:", e));
      }

      if (!monitoringRef.current) {
        stopCamera(camera);
        startingCamerasRef.current.delete(camera.id);
        return;
      }

      setCameras((prev) =>
        prev.map((c) =>
          c.id === camera.id ? { ...c, status: "Active", error: "" } : c
        )
      );
    } catch (err) {
      if (!monitoringRef.current) {
        startingCamerasRef.current.delete(camera.id);
        return;
      }
      setCameras((prev) =>
        prev.map((c) =>
          c.id === camera.id
            ? { ...c, status: "Error", error: err.message }
            : c
        )
      );
    } finally {
      startingCamerasRef.current.delete(camera.id);
    }
  }

  function stopCamera(camera) {
    if (abortControllersRef.current[camera.id]) {
      try {
        abortControllersRef.current[camera.id].abort();
      } catch {}
      delete abortControllersRef.current[camera.id];
    }
    inFlightRef.current[camera.id] = false;

    if (samplingIntervalsRef.current[camera.id]) {
      clearInterval(samplingIntervalsRef.current[camera.id]);
      delete samplingIntervalsRef.current[camera.id];
    }

    if (camera.streamRef.current) {
      camera.streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      camera.streamRef.current = null;
    }

    const video = camera.videoRef?.current;
    if (video) {
      try {
        video.pause();
      } catch {}
      video.srcObject = null;
    }

    clearOverlay(camera);
  }

  function startSampling(camera) {
    if (!monitoringRef.current || camera.status !== "Active") return;
    if (samplingIntervalsRef.current[camera.id]) return;

    const video = camera.videoRef.current;
    const canvas = camera.canvasRef.current;

    const captureAndSend = async () => {
      if (!monitoringRef.current) return;
      if (inFlightRef.current[camera.id]) return;
      if (!video || !canvas || video.readyState < 2) return;

      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return;

      inFlightRef.current[camera.id] = true;
      const controller = new AbortController();
      abortControllersRef.current[camera.id] = controller;

      try {
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, width, height);

        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (result) => {
              if (result) resolve(result);
              else reject(new Error("Could not capture frame"));
            },
            "image/jpeg",
            JPEG_QUALITY
          );
        });

        if (!monitoringRef.current || controller.signal.aborted) return;

        const result = await analyzeFrame({
          blob,
          sessionId: camera.sessionId,
          source: "webcam",
          cameraId: camera.id,
          cameraLabel: camera.label,
          locationLat: camera.location?.lat,
          locationLng: camera.location?.lng,
          locationLabel: camera.location?.label,
          signal: controller.signal,
        });

        if (!monitoringRef.current || controller.signal.aborted) return;

        drawOverlay(camera, result);

        setCameras((prev) =>
          prev.map((c) =>
            c.id === camera.id ? { ...c, latest: result, error: "" } : c
          )
        );

        const alertsToDispatch = (result.confirmedAlerts && result.confirmedAlerts.length > 0)
          ? result.confirmedAlerts
          : (result.confirmed || []).map((c) => ({
              _id: `alert-${camera.id}-${c.type}-${Math.floor((c.timestamp || Date.now()) / 1000)}`,
              type: c.type,
              confidence: c.confidence,
              status: "SIMULATED",
              createdAt: c.timestamp ? new Date(c.timestamp * 1000).toISOString() : new Date().toISOString(),
            }));

        if (monitoringRef.current && alertsToDispatch.length > 0) {
          alertsToDispatch.forEach((alert) => {
            onAlert({
              ...alert,
              cameraId: camera.id,
              cameraLabel: camera.label,
              location: camera.location,
            });
          });
        }
      } catch (err) {
        if (err.name === "AbortError" || !monitoringRef.current) {
          return;
        }
        setCameras((prev) =>
          prev.map((c) =>
            c.id === camera.id
              ? { ...c, error: err.message, status: "Analysis Error" }
              : c
          )
        );
      } finally {
        inFlightRef.current[camera.id] = false;
        if (abortControllersRef.current[camera.id] === controller) {
          delete abortControllersRef.current[camera.id];
        }
      }
    };

    captureAndSend();
    samplingIntervalsRef.current[camera.id] = setInterval(captureAndSend, 500);
  }

  function stopSampling(cameraId) {
    if (abortControllersRef.current[cameraId]) {
      try {
        abortControllersRef.current[cameraId].abort();
      } catch {}
      delete abortControllersRef.current[cameraId];
    }
    inFlightRef.current[cameraId] = false;

    if (samplingIntervalsRef.current[cameraId]) {
      clearInterval(samplingIntervalsRef.current[cameraId]);
      delete samplingIntervalsRef.current[cameraId];
    }

    const cam = cameras.find((c) => c.id === cameraId);
    if (cam) clearOverlay(cam);
  }

  // Handle monitoring state changes
  useEffect(() => {
    monitoringRef.current = monitoring;

    if (monitoring) {
      cameras.forEach((camera) => {
        if (camera.status === "Idle" || camera.status === "Stopped") {
          startCamera(camera);
        }
      });
    } else {
      cameras.forEach((camera) => {
        stopCamera(camera);
      });
      Object.keys(samplingIntervalsRef.current).forEach((id) => {
        clearInterval(samplingIntervalsRef.current[id]);
        delete samplingIntervalsRef.current[id];
      });
      Object.keys(abortControllersRef.current).forEach((id) => {
        try {
          abortControllersRef.current[id].abort();
        } catch {}
        delete abortControllersRef.current[id];
      });
      inFlightRef.current = {};

      setCameras((prev) =>
        prev.map((c) => ({
          ...c,
          status: "Stopped",
          error: "",
        }))
      );
    }
  }, [monitoring]);

  // Start sampling when cameras become active while monitoring is enabled
  useEffect(() => {
    if (!monitoring) return;

    cameras.forEach((camera) => {
      if (camera.status === "Active" && !samplingIntervalsRef.current[camera.id]) {
        startSampling(camera);
      }
    });
  }, [monitoring, cameras.map((c) => `${c.id}:${c.status}`).join(",")]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      monitoringRef.current = false;
      cameras.forEach((camera) => {
        stopCamera(camera);
      });
      Object.values(samplingIntervalsRef.current).forEach(clearInterval);
      Object.values(abortControllersRef.current).forEach((ctrl) => {
        try {
          ctrl.abort();
        } catch {}
      });
    };
  }, []);

  return (
    <div className="camera-grid">
      <div className="camera-controls">
        <h3>Cameras ({cameras.length}/{MAX_CAMERAS})</h3>
        <select
          onChange={(e) => {
            const deviceId = e.target.value;
            const device = availableDevices.find((d) => d.deviceId === deviceId);
            if (device) addCamera(deviceId, device.label);
          }}
          value=""
        >
          <option value="">Add Camera...</option>
          {availableDevices
            .filter((d) => !selectedDevicesRef.current.has(d.deviceId))
            .map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
        </select>
      </div>

      <div className="camera-feeds">
        {cameras.map((camera) => (
          <div key={camera.id} className="camera-feed">
            <div className="camera-header">
              <span>{camera.label}</span>
              <button
                type="button"
                onClick={() => removeCamera(camera.id)}
                className="remove-btn"
              >
                ×
              </button>
            </div>
            <div className="camera-preview">
              <video
                ref={camera.videoRef}
                className="preview"
                playsInline
                muted
              />
              <canvas
                ref={camera.overlayRef}
                className="overlay-canvas"
              />
              <canvas
                ref={camera.canvasRef}
                className="hidden-canvas"
              />
            </div>
            <div className="camera-status">
              <span>{camera.status}</span>
              {camera.error && <span className="error">{camera.error}</span>}
              {camera.latest?.scores && (
                <div className="mini-scores">
                  <span>F: {camera.latest.scores.fire.toFixed(2)}</span>
                  <span>A: {camera.latest.scores.accident.toFixed(2)}</span>
                  <span>V: {camera.latest.scores.violence.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="camera-location">
              <input
                type="text"
                placeholder="Location label (e.g., 'Main Entrance')"
                value={camera.location?.label || ""}
                onChange={(e) => updateCameraLocation(camera.id, {
                  ...camera.location,
                  label: e.target.value
                })}
                className="location-input"
              />
              <input
                type="number"
                placeholder="Lat"
                value={camera.location?.lat || ""}
                onChange={(e) => updateCameraLocation(camera.id, {
                  ...camera.location,
                  lat: parseFloat(e.target.value) || null
                })}
                className="location-input"
              />
              <input
                type="number"
                placeholder="Lng"
                value={camera.location?.lng || ""}
                onChange={(e) => updateCameraLocation(camera.id, {
                  ...camera.location,
                  lng: parseFloat(e.target.value) || null
                })}
                className="location-input"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
