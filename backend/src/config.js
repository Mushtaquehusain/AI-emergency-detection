require("dotenv").config();

const config = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGO_URI,
  aiServiceUrl: process.env.AI_SERVICE_URL || "http://127.0.0.1:8001",
};

if (!config.mongoUri) {
  console.warn("MONGO_URI is not set. Running without database persistence.");
}

module.exports = config;
