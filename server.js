require("dotenv").config(); // Load environment variables
const app = require("./app");

// Fail fast if required configuration is missing (never log secret values)
const required = ["JWT_SECRET"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`❌ Missing required environment variables: ${missing.join(", ")}. See .env.example`);
  process.exit(1);
}
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn("⚠️  RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set – online payments will not work.");
}

const PORT = process.env.PORT || 5005;

app.listen(PORT, () => {
  console.log(`✨ GlowWise server is running on port ${PORT}`);
});
