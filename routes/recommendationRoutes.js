const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/authMiddleware");
const { getMyRecommendations } = require("../controllers/recommendationController");

router.get("/forMe", verifyToken, getMyRecommendations);

module.exports = router;
