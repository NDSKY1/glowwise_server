const express = require("express");
const router = express.Router();
const verifyToken = require("../middlewares/authMiddleware"); // Import middleware
const verifyAdminToken = require("../middlewares/adminAuthMiddleware");

const paymentController = require("../controllers/paymentController");

// Create a payment entry

// Get all payments with filtering, pagination, and status
router.get("/getPayment",verifyToken, paymentController.getAllPayments);


router.post("/create-order",verifyToken, paymentController.createRazorpayOrder);


router.post("/verify-signature",verifyToken, paymentController.verifyRazorpaySignature);
router.get("/getAllPaymentsForAdmin", verifyAdminToken, paymentController.getAllPaymentsForAdmin);


module.exports = router;


