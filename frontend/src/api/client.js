const API_BASE = "/api";

export async function analyzeFrame({ blob, sessionId, source }) {
  const form = new FormData();
  form.append("image", blob, "frame.jpg");
  form.append("sessionId", sessionId);
  form.append("source", source);

  const response = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    body: form,
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

export async function getAlerts(limit = 50) {
  const response = await fetch(`${API_BASE}/alerts?limit=${limit}`);
  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload.error || `Failed to fetch alerts (${response.status})`);
  }
  return payload;
}
