const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const verifyToken = require("../middlewares/authMiddleware");
const verifyAdminToken = require("../middlewares/adminAuthMiddleware");

// ✅ Customer routes (used by the Flutter app)
router.post("/create", verifyToken, orderController.createOrder);
router.get("/myOrderList", verifyToken, orderController.getUserOrders);
router.get("/details/:id", verifyToken, orderController.getOrderDetails);
router.get("/statuses", orderController.getOrderStatuses);

// ✅ Admin routes
router.post("/updateOrderStatus", verifyAdminToken, orderController.updateOrderStatus);
router.get("/allOrders", verifyAdminToken, orderController.getAllOrdersForAdmin);
router.get("/cancelledOrders", verifyAdminToken, orderController.getAllCancelledOrders);
router.get("/getProductWiseOrderQuantity", verifyAdminToken, orderController.getProductWiseOrderQuantity);

module.exports = router;
