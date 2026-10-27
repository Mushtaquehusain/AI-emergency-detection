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
      enum: ["SIMULATED", "ACKNOWLEDGED", "RESOLVED"],
      default: "SIMULATED",
    },
    source: {
      type: String,
      enum: ["webcam", "file"],
    },
    cameraId: {
      type: String,
    },
    cameraLabel: {
      type: String,
    },
    location: {
      lat: Number,
      lng: Number,
      label: String,
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
    actions: [{
      type: {
        type: String,
        enum: ["CALL_POLICE", "REQUEST_AMBULANCE", "FIRE_DEPARTMENT", "ACKNOWLEDGE", "RESOLVE"],
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
      simulated: {
        type: Boolean,
        default: true,
      },
    }],
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
