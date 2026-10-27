const express = require("express");
const mongoose = require("mongoose");
const Alert = require("../models/Alert");
const alertService = require("../services/alertService");

const router = express.Router();

// Check if MongoDB is connected
const isDbConnected = () => mongoose.connection.readyState === 1;

router.get("/alerts", async (req, res, next) => {
  if (!isDbConnected()) {
    return res.json([]); // Return empty array if DB not connected
  }
  
  try {
    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 6) : 6;
    const category = req.query.category;
    const cameraId = req.query.cameraId;
    const status = req.query.status;
    
    let query = {};
    if (category) query.type = category;
    if (cameraId) query.cameraId = cameraId;
    if (status) query.status = status;
    
    const alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(alerts);
  } catch (err) {
    next(err);
  }
});

router.post("/alerts", async (req, res, next) => {
  if (!isDbConnected()) {
    return res.status(503).json({ 
      ok: false, 
      error: "Database not available. Configure MONGO_URI to enable alert persistence." 
    });
  }
  
  try {
    const { type, confidence, sessionId, source, scores, cameraId, cameraLabel, location } = req.body;
    
    if (!type || !confidence) {
      return res.status(400).json({ ok: false, error: "missing type or confidence" });
    }

    const result = await alertService.processConfirmedAlert({
      type,
      confidence,
      sessionId,
      source: source || "webcam",
      snapshotBuffer: null,
      scores,
      cameraId,
      cameraLabel,
      location,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/alerts/:id/actions", async (req, res, next) => {
  if (!isDbConnected()) {
    return res.status(503).json({ 
      ok: false, 
      error: "Database not available. Configure MONGO_URI to enable alert actions." 
    });
  }
  
  try {
    const { id } = req.params;
    const { action } = req.body;
    
    if (!action) {
      return res.status(400).json({ ok: false, error: "missing action" });
    }
    
    const validActions = ["CALL_POLICE", "REQUEST_AMBULANCE", "FIRE_DEPARTMENT", "ACKNOWLEDGE", "RESOLVE"];
    if (!validActions.includes(action)) {
      return res.status(400).json({ ok: false, error: "invalid action" });
    }
    
    const alert = await Alert.findById(id);
    if (!alert) {
      return res.status(404).json({ ok: false, error: "alert not found" });
    }
    
    // Add action to history
    alert.actions.push({
      type: action,
      timestamp: new Date(),
      simulated: true,
    });
    
    // Update status based on action
    if (action === "ACKNOWLEDGE") {
      alert.status = "ACKNOWLEDGED";
    } else if (action === "RESOLVE") {
      alert.status = "RESOLVED";
    }
    
    await alert.save();
    
    res.json({
      ok: true,
      alert: alert.toObject(),
      message: `Action ${action} recorded (SIMULATED)`,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
