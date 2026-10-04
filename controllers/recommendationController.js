const recommendationService = require("../services/recommendationService");

// GET /recommendation/forMe?limit=10&categoryId=1
exports.getMyRecommendations = (req, res) => {
  try {
    const result = recommendationService.recommendFor(req.user.mobile, req.query);
    return res.status(200).json({
      status: 200,
      message: result.personalised
        ? "Personalised recommendations fetched successfully"
        : "Popular picks (set up your skin profile for personalised results)",
      data: result.products,
      meta: {
        engine: result.engine, // "rule-based-v1" – not AI
        personalised: result.personalised,
        basedOn: result.basedOn,
        suggestedRoutine: result.suggestedRoutine,
      },
    });
  } catch (error) {
    console.error("Error building recommendations:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};
