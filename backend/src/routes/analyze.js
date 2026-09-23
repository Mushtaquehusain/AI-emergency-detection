const express = require("express");
const multer = require("multer");
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

    const result = await aiClient.infer({
      buffer: req.file.buffer,
      filename: req.file.originalname || "frame.jpg",
      sessionId,
    });

    // Process any confirmed alerts from AI service
    const confirmedAlerts = [];
    if (result.confirmed && result.confirmed.length > 0) {
      for (const confirmed of result.confirmed) {
        try {
          const alertResult = await alertService.processConfirmedAlert({
            type: confirmed.type,
            confidence: confirmed.confidence,
            sessionId,
            source,
            snapshotBuffer: req.file.buffer,
            scores: result.scores,
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
