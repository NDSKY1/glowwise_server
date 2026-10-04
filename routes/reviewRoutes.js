const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/authMiddleware");
const verifyAdminToken = require("../middlewares/adminAuthMiddleware");
const review = require("../controllers/reviewController");

router.get("/product/:productId", review.getProductReviews);
router.get("/all", verifyAdminToken, review.getAllReviews);
router.delete("/admin/:id", verifyAdminToken, review.adminDeleteReview);
router.post("/add", verifyToken, review.addReview);
router.post("/update/:id", verifyToken, review.updateReview); // POST: app client supports GET/POST/DELETE
router.delete("/delete/:id", verifyToken, review.deleteReview);

module.exports = router;
