const config = require("../config");

async function infer({ buffer, filename, sessionId }) {
  const form = new FormData();
  form.append(
    "image",
    new Blob([buffer], { type: "image/jpeg" }),
    filename || "frame.jpg"
  );
  if (sessionId) {
    form.append("session_id", sessionId);
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

module.exports = { infer };
