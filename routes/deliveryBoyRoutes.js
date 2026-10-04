const express = require("express");
const {
    loginDeliveryBoy,
    getDeliveryBoyProfile,
    getDeliveryBoyDashboard,
    getDeliveryBoyOrders,
    markAsDelivered,
    getAllDeliveryBoys,
    updateDeliveryBoyStatus,
    assignDeliveryBoy,
    getActiveDeliveryBoys
} = require("../controllers/deliveryBoyController");
const deliveryBoyAuthMiddleware = require("../middlewares/deliveryBoyAuthMiddleware");
const verifyAdminToken = require("../middlewares/adminAuthMiddleware") // Import middleware


const router = express.Router();

router.post("/login", loginDeliveryBoy);
router.get("/getMyProfile", deliveryBoyAuthMiddleware, getDeliveryBoyProfile);
router.get("/dashboard", deliveryBoyAuthMiddleware, getDeliveryBoyDashboard);
router.get("/getMyOrderlist", deliveryBoyAuthMiddleware, getDeliveryBoyOrders);
router.patch("/markAsDelivered/:id", deliveryBoyAuthMiddleware, markAsDelivered);

router.get("/getalldeliveryBoys",verifyAdminToken, getAllDeliveryBoys );
router.post("/updateDeliveryBoyStatus",verifyAdminToken, updateDeliveryBoyStatus);
router.get("/getactivedeliveryboys", getActiveDeliveryBoys);
router.post("/assignDeliveryBoy",verifyAdminToken, assignDeliveryBoy);




module.exports = router;
