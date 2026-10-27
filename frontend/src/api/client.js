const API_BASE = "/api";

export async function analyzeFrame({ blob, sessionId, source, cameraId, cameraLabel, locationLat, locationLng, locationLabel, signal }) {
  const form = new FormData();
  form.append("image", blob, "frame.jpg");
  form.append("sessionId", sessionId);
  form.append("source", source);
  if (cameraId) form.append("cameraId", cameraId);
  if (cameraLabel) form.append("cameraLabel", cameraLabel);
  if (locationLat) form.append("locationLat", locationLat);
  if (locationLng) form.append("locationLng", locationLng);
  if (locationLabel) form.append("locationLabel", locationLabel);

  const response = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    body: form,
    signal,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error || payload.detail || `Analyze failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

export async function getHealth() {
  const response = await fetch(`${API_BASE}/health`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Health check failed (${response.status})`);
  }
  return payload;
}

export async function getAlerts(limit = 6, category, cameraId, status) {
  const safeLimit = Math.min(parseInt(limit, 10) || 6, 6);
  const params = new URLSearchParams({ limit: safeLimit.toString() });
  if (category) params.append("category", category);
  if (cameraId) params.append("cameraId", cameraId);
  if (status) params.append("status", status);
  
  const response = await fetch(`${API_BASE}/alerts?${params}`);
  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload.error || `Failed to fetch alerts (${response.status})`);
  }
  return payload;
}

export async function recordAlertAction(alertId, action) {
  const response = await fetch(`${API_BASE}/alerts/${alertId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Failed to record action (${response.status})`);
  }
  return payload;
}
