const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");
const verifyToken = require("../middlewares/authMiddleware");

// Endpoint names kept exactly as used by the Flutter app
router.post("/addProduct", verifyToken, cartController.addProductToCart);
router.post("/updateCart", verifyToken, cartController.updateCartProduct);
router.get("/showMyCart", verifyToken, cartController.showMyCart);
router.delete("/decreaseQTY/:id", verifyToken, cartController.removeCartProduct);
router.delete("/increaseQTY/:id", verifyToken, cartController.increaseCartProduct);
// (Express routes are case-insensitive, so the app's "/removeproduct/:id" matches too)
router.delete("/removeProduct/:id", verifyToken, cartController.removeParticularCartProduct);
router.delete("/clear", verifyToken, cartController.clearCart);

module.exports = router;
