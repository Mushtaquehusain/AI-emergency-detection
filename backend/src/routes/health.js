const express = require("express");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "express",
    message: "Express server is running",
  });
});

module.exports = router;
