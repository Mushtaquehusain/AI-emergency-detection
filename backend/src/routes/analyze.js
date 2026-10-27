const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const aiClient = require("../services/aiClient");
const alertService = require("../services/alertService");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post("/analyze", upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ ok: false, error: "missing image" });
    }

    const sessionId = req.body.sessionId || req.body.session_id;
    const source = req.body.source || "webcam";
    const cameraId = req.body.cameraId;
    const cameraLabel = req.body.cameraLabel;
    
    // Parse location if provided
    let location = null;
    if (req.body.locationLat && req.body.locationLng) {
      location = {
        lat: parseFloat(req.body.locationLat),
        lng: parseFloat(req.body.locationLng),
        label: req.body.locationLabel || "Unknown Location",
      };
    }

    const result = await aiClient.infer({
      buffer: req.file.buffer,
      filename: req.file.originalname || "frame.jpg",
      sessionId,
      cameraId,
      cameraLabel,
    });

    // Process any confirmed alerts from AI service (only if DB is connected)
    const confirmedAlerts = [];
    if (result.confirmed && result.confirmed.length > 0 && mongoose.connection.readyState === 1) {
      for (const confirmed of result.confirmed) {
        try {
          const alertResult = await alertService.processConfirmedAlert({
            type: confirmed.type,
            confidence: confirmed.confidence,
            sessionId,
            source,
            snapshotBuffer: req.file.buffer,
            scores: result.scores,
            cameraId,
            cameraLabel,
            location,
          });
          confirmedAlerts.push(alertResult);
        } catch (alertErr) {
          console.error("Failed to process confirmed alert:", alertErr);
          // Continue processing other alerts even if one fails
        }
      }
    }

    res.json({
      ...result,
      confirmedAlerts,
      dbConnected: mongoose.connection.readyState === 1,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({
        ok: false,
        error: err.message,
      });
    }
    next(err);
  }
});

module.exports = router;
