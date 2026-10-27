const config = require("../config");

async function infer({ buffer, filename, sessionId, cameraId, cameraLabel }) {
  const form = new FormData();
  form.append(
    "image",
    new Blob([buffer], { type: "image/jpeg" }),
    filename || "frame.jpg"
  );
  if (sessionId) {
    form.append("session_id", sessionId);
  }
  if (cameraId) {
    form.append("camera_id", cameraId);
  }
  if (cameraLabel) {
    form.append("camera_label", cameraLabel);
  }

  const response = await fetch(`${config.aiServiceUrl}/infer`, {
    method: "POST",
    body: form,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(payload.error || payload.detail || "AI infer failed");
    err.status = response.status;
    throw err;
  }
  return payload;
}

async function health() {
  const response = await fetch(`${config.aiServiceUrl}/health`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(payload.error || payload.detail || "AI health check failed");
    err.status = response.status;
    throw err;
  }
  return payload;
}

module.exports = { infer, health };
