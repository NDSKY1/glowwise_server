const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/authMiddleware");
const wishlist = require("../controllers/wishlistController");

router.get("/myWishlist", verifyToken, wishlist.getWishlist);
router.post("/add", verifyToken, wishlist.addToWishlist);
router.delete("/remove/:productId", verifyToken, wishlist.removeFromWishlist);
router.get("/status/:productId", verifyToken, wishlist.getWishlistStatus);

module.exports = router;
