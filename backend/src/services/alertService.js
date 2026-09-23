const fs = require("fs").promises;
const path = require("path");
const Alert = require("../models/Alert");

const SNAPSHOT_DIR = path.join(__dirname, "../../data/snapshots");

// Emergency routing configuration
const ROUTING_CONFIG = {
  FIRE: ["FIRE DEPARTMENT"],
  ACCIDENT: ["AMBULANCE"],
  VIOLENCE: ["POLICE"],
};

/**
 * Initialize snapshot directory
 */
async function ensureSnapshotDir() {
  try {
    await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
  } catch (err) {
    if (err.code !== "EEXIST") {
      throw err;
    }
  }
}

/**
 * Save snapshot image to disk
 */
async function saveSnapshot(buffer, sessionId, emergencyType) {
  await ensureSnapshotDir();
  
  const timestamp = Date.now();
  const filename = `${sessionId}-${emergencyType}-${timestamp}.jpg`;
  const filepath = path.join(SNAPSHOT_DIR, filename);
  
  await fs.writeFile(filepath, buffer);
  return filename;
}

/**
 * Simulate emergency service routing
 */
function simulateRouting(emergencyType) {
  const routes = ROUTING_CONFIG[emergencyType] || [];
  return {
    routes,
    message: `SIMULATED: Would route ${emergencyType} to ${routes.join(", ")}`,
    simulated: true,
  };
}

/**
 * Process confirmed alert from AI service
 */
async function processConfirmedAlert({
  type,
  confidence,
  sessionId,
  source,
  snapshotBuffer,
  scores,
}) {
  try {
    // Save snapshot
    let snapshotPath = null;
    if (snapshotBuffer) {
      snapshotPath = await saveSnapshot(snapshotBuffer, sessionId, type);
    }

    // Simulate routing
    const routing = simulateRouting(type);

    // Create alert record
    const alert = new Alert({
      type,
      confidence,
      routedTo: routing.routes,
      status: "SIMULATED",
      source,
      sessionId,
      snapshotPath,
      scores,
      disclaimer:
        "College prototype. Not a real municipal emergency system. Response is SIMULATED.",
    });

    await alert.save();

    return {
      ok: true,
      alert: alert.toObject(),
      routing,
      message: `Alert confirmed: ${type} (confidence: ${confidence.toFixed(2)})`,
    };
  } catch (err) {
    console.error("Error processing confirmed alert:", err);
    throw new Error(`Failed to process alert: ${err.message}`);
  }
}

/**
 * Get recent alerts
 */
async function getRecentAlerts(limit = 50) {
  try {
    const alerts = await Alert.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return alerts;
  } catch (err) {
    console.error("Error fetching alerts:", err);
    throw new Error(`Failed to fetch alerts: ${err.message}`);
  }
}

module.exports = {
  processConfirmedAlert,
  getRecentAlerts,
  ensureSnapshotDir,
};
