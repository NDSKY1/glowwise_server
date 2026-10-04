/**
 * ---------------------------------------------------------------------------
 * FUTURE SCOPE – AI skin analysis.
 *
 * Planned flow:
 *   User → Skin image → AI skin analysis → Skin type + concerns
 *        → saved to user.skinProfile (source: "ai") → personalised recommendations
 *
 * Nothing here analyses images today and NO results are simulated.
 * To integrate a real model later:
 *   1. Implement a provider object with `name` and `analyze(imageBuffer)`
 *      that resolves to { skinType, concerns: [], confidence }.
 *   2. Register it with `registerProvider(provider)` in app startup.
 *   3. `isAvailable()` will then return true and the
 *      POST /skinAnalysis/analyze endpoint will start working.
 * ---------------------------------------------------------------------------
 */
const { SKIN_TYPES, SKIN_CONCERNS } = require("../constants/glowwise");

let provider = null;

const registerProvider = (p) => {
  if (!p || typeof p.analyze !== "function") {
    throw new Error("Skin analysis provider must implement analyze(imageBuffer)");
  }
  provider = p;
};

const isAvailable = () => provider !== null;

/** Validates & normalises a provider result so bad model output is rejected. */
const normaliseResult = (raw) => {
  const skinType = SKIN_TYPES.find((t) => t.toLowerCase() === String(raw?.skinType || "").toLowerCase()) || null;
  const concerns = (Array.isArray(raw?.concerns) ? raw.concerns : [])
    .map((c) => SKIN_CONCERNS.find((k) => k.toLowerCase() === String(c).toLowerCase()))
    .filter(Boolean);
  const confidence = Number(raw?.confidence);
  return {
    skinType,
    concerns: [...new Set(concerns)],
    confidence: Number.isFinite(confidence) ? Math.min(Math.max(confidence, 0), 1) : null,
  };
};

const analyze = async (imageBuffer) => {
  if (!isAvailable()) {
    const err = new Error("AI skin analysis is not available yet.");
    err.statusCode = 501;
    throw err;
  }
  const raw = await provider.analyze(imageBuffer);
  return { provider: provider.name || "custom", ...normaliseResult(raw) };
};

module.exports = { registerProvider, isAvailable, analyze, normaliseResult };
