const express = require("express");
const mongoose = require("mongoose");
const aiClient = require("../services/aiClient");

const router = express.Router();

router.get("/health", async (req, res) => {
  let aiStatus = "error";
  let aiDetails = null;

  try {
    const aiData = await aiClient.health();
    if (aiData && (aiData.status === "ok" || aiData.status === "healthy")) {
      aiStatus = "ok";
      aiDetails = aiData;
    }
  } catch (err) {
    aiStatus = "error";
  }

  const dbStatus = mongoose.connection.readyState === 1 ? "ok" : "error";

  res.json({
    ok: true,
    service: "express",
    ai: aiStatus,
    db: dbStatus,
    aiDetails,
  });
});

module.exports = router;
