const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const config = require("./config");
const healthRouter = require("./routes/health");
const alertsRouter = require("./routes/alerts");
const analyzeRouter = require("./routes/analyze");
const alertService = require("./services/alertService");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", healthRouter);
app.use("/api", alertsRouter);
app.use("/api", analyzeRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    ok: false,
    error: err.message || "Internal server error",
  });
});

async function start() {
  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }

  // Ensure snapshot directory exists
  await alertService.ensureSnapshotDir();
  console.log("Snapshot directory ready");

  app.listen(config.port, () => {
    console.log(`Express listening on http://localhost:${config.port}`);
  });
}

start();
