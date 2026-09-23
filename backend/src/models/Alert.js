const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["FIRE", "ACCIDENT", "VIOLENCE"],
      required: true,
    },
    confidence: {
      type: Number,
      required: true,
    },
    routedTo: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["SIMULATED"],
      default: "SIMULATED",
    },
    source: {
      type: String,
      enum: ["webcam", "file"],
    },
    sessionId: {
      type: String,
    },
    snapshotPath: {
      type: String,
    },
    scores: {
      fire: Number,
      accident: Number,
      violence: Number,
    },
    disclaimer: {
      type: String,
      default:
        "College prototype. Not a real municipal emergency system. Response is SIMULATED.",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

module.exports = mongoose.model("Alert", alertSchema);
