const express = require("express");
const alertService = require("../services/alertService");

const router = express.Router();

router.get("/alerts", async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const alerts = await alertService.getRecentAlerts(limit);
    res.json(alerts);
  } catch (err) {
    next(err);
  }
});

router.post("/alerts", async (req, res, next) => {
  try {
    const { type, confidence, sessionId, source, scores } = req.body;
    
    if (!type || !confidence) {
      return res.status(400).json({ ok: false, error: "missing type or confidence" });
    }

    const result = await alertService.processConfirmedAlert({
      type,
      confidence,
      sessionId,
      source: source || "webcam",
      snapshotBuffer: null, // No snapshot for manual alerts
      scores,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
