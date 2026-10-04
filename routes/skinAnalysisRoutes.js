const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/authMiddleware");
const skinAnalysis = require("../controllers/skinAnalysisController");

router.get("/status", skinAnalysis.getStatus);
router.post("/analyze", verifyToken, skinAnalysis.analyze);

module.exports = router;
