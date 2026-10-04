const skinAnalysisService = require("../services/skinAnalysisService");
const { SKIN_TYPES, SKIN_CONCERNS } = require("../constants/glowwise");

// GET /skinAnalysis/status
exports.getStatus = (req, res) => {
  return res.status(200).json({
    status: 200,
    message: skinAnalysisService.isAvailable()
      ? "AI skin analysis is available"
      : "AI skin analysis is coming soon",
    data: {
      available: skinAnalysisService.isAvailable(),
      detectableSkinTypes: SKIN_TYPES,
      detectableConcerns: SKIN_CONCERNS,
    },
  });
};

// POST /skinAnalysis/analyze
// Returns 501 until a real AI provider is registered. No fake results.
exports.analyze = async (req, res) => {
  if (!skinAnalysisService.isAvailable()) {
    return res.status(501).json({
      status: 501,
      message: "AI skin analysis is not available yet. Please set up your skin profile manually.",
    });
  }
  // Future: accept an uploaded image (multer memory storage), run the
  // provider, save the result to user.skinProfile with source "ai" and
  // return it together with recommendations.
  return res.status(501).json({ status: 501, message: "Image upload for skin analysis is not implemented yet." });
};
