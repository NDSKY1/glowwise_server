const express = require("express");
const verifyAdminToken = require("../middlewares/adminAuthMiddleware");
const { 
    registerVendor, 
    verifyOtp, 
    loginVendor, 
    getProfile, 
    changePassword, 
    forgotPassword,            // New: Forgot Password API
    forgotPasswordVerifyOtp,
    updateAddress,
    getAllVendors,             // Get all vendors API (admin panel)
    updateProfile,             // GlowWise
    getSkinProfile,            // GlowWise
    updateSkinProfile          // GlowWise
} = require("../controllers/vendorController");

const verifyToken = require("../middlewares/authMiddleware"); // Import middleware

const router = express.Router();

// Public Routes (No Authentication Required)
router.post("/registration", registerVendor);
router.post("/registrationOtpVerification", verifyOtp);
router.post("/login", loginVendor);
router.post("/forgotPassword", forgotPassword);               
router.post("/forgotPasswordOTPVerification", forgotPasswordVerifyOtp); 

// Protected Routes (Authentication Required)
router.get("/getProfile", verifyToken, getProfile);
router.post("/changePassword", verifyToken, changePassword);
router.post("/updateAddress", verifyToken, updateAddress);
router.post("/updateProfile", verifyToken, updateProfile);

// GlowWise skin profile
router.get("/skinProfile", verifyToken, getSkinProfile);
router.post("/updateSkinProfile", verifyToken, updateSkinProfile);
// New: Get all vendors (public route)
router.get("/vendorsDetails", verifyAdminToken, getAllVendors); // 👈 Add this line






module.exports = router;
