const express = require("express");
const router = express.Router();
const verifyAdminToken = require("../middlewares/adminAuthMiddleware");
const { adminLogin, getDashboard, getSkinInsights } = require("../controllers/adminController");

router.post("/login", adminLogin);
router.get("/dashboard", verifyAdminToken, getDashboard);
router.get("/skinInsights", verifyAdminToken, getSkinInsights);

module.exports = router;
