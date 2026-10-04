const fs = require("fs");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config();

const SECRET_KEY = process.env.JWT_SECRET;
const orderFilePath = path.join(__dirname, '../models/orders.json');
const deliveryBoyFilePath = path.join(__dirname, '../models/deliveryBoy.json');
const userFilePath = path.join(__dirname, '../models/users.json');

const { readFileSafely, writeFileSafely } = require("../utils/fileUtils");
const { verifyPassword, hashPassword, needsUpgrade } = require("../utils/password");

// Load delivery boys from JSON file
const loadDeliveryBoys = () => {
    if (!fs.existsSync(deliveryBoyFilePath)) return [];
    const data = fs.readFileSync(deliveryBoyFilePath, "utf8");
    return JSON.parse(data);
};

// Delivery Boy Login
const loginDeliveryBoy = (req, res) => {
    const { mobile, password } = req.body;
    const users = loadDeliveryBoys();

    const user = users.find(user => user.mobile === mobile && verifyPassword(password, user.password));

    if (!user) {
        return res.status(401).json({ status: 401, message: "Invalid credentials" });
    }

    // Upgrade legacy plain-text password to a bcrypt hash
    if (needsUpgrade(user.password)) {
        user.password = hashPassword(password);
        writeFileSafely(deliveryBoyFilePath, users);
    }

    const token = jwt.sign({ id: user.id, mobile: user.mobile }, SECRET_KEY, { expiresIn: "7d" });

    res.json({ status: 200, message: "Login successful", data: { token } });
};

// Get Delivery Boy Profile
const getDeliveryBoyProfile = (req, res) => {
    const userId = req.user.id;
    const users = loadDeliveryBoys();
    const user = users.find(user => user.id === userId);

    if (!user) {
        return res.status(404).json({ status: 404, message: "User not found", data: null });
    }

    res.json({
        status: 200,
        message: "Profile fetched successfully",
        data: {
            _id: user.id.toString(),
            name: user.name || "Delivery Boy",
            dialcode: "+91",
            mobile: user.mobile,
            status: true
        }
    });
};

// Load Dashboard Data
const loadDashboardData = () => {
    try {
        const ordersData = readFileSafely(orderFilePath);

        const pendingOrder = ordersData.filter(order => order.status === "out of delivery").length;
        const deliveredOrder = ordersData.filter(order => order.status === "Delivered").length;

        return {
            status: 200,
            message: "Dashboard data fetched successfully",
            data: {
                pendingOrder,
                deliveredOrder
            }
        };
    } catch (error) {
        console.error("Error reading orders file:", error);
        return { status: 500, message: "Error loading dashboard data" };
    }
};

// Get Delivery Boy Dashboard
const getDeliveryBoyDashboard = (req, res) => {
    try {
        const dashboardData = loadDashboardData();
        res.status(200).json(dashboardData);
    } catch (error) {
        res.status(500).json({ status: 500, message: "Error fetching dashboard data", error: error.message });
    }
};

// Get Orders Assigned to Delivery Boy
const getDeliveryBoyOrders = (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 10, keyword = "", status = "" } = req.query;

    try {
        const ordersData = readFileSafely(orderFilePath);
        let filteredOrders = ordersData.filter(order => order.deliveryBoy === userId);

        if (status) {
            filteredOrders = filteredOrders.filter(order => order.status.toLowerCase() === status.toLowerCase());
        }

        if (keyword) {
            filteredOrders = filteredOrders.filter(order =>
                order.challanNo.includes(keyword) ||
                (order.vendorsData && order.vendorsData.id.includes(keyword))
            );
        }

        const totalDocs = filteredOrders.length;
        const totalPages = Math.ceil(totalDocs / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

        res.json({
            status: 200,
            message: "Orders fetched successfully",
            data: {
                docs: paginatedOrders,
                totalDocs,
                limit: parseInt(limit),
                page: parseInt(page),
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                nextPage: page < totalPages ? page + 1 : null,
                prevPage: page > 1 ? page - 1 : null
            }
        });

    } catch (error) {
        console.error("Error reading orders file:", error);
        res.status(500).json({ status: 500, message: "Error fetching orders", error: error.message });
    }
};

// Mark Order as Delivered
const markAsDelivered = (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        let orders = readFileSafely(orderFilePath);
        const index = orders.findIndex(order => order.id === id && order.deliveryBoy === userId);

        if (index === -1) {
            return res.status(404).json({ status: 404, message: "Order not found or unauthorized" });
        }

        orders[index].status = "Delivered";
        orders[index].updatedAt = new Date().toISOString();
        writeFileSafely(orderFilePath, orders);

         // ✅ Update user.json (vendor counters)
        const users = readFileSafely(userFilePath);
        const orderMobile = orders[index].mobile;
        const userIndex = users.findIndex(u => u.mobile === orderMobile);

        if (userIndex !== -1) {
            users[userIndex].outOfDeliveryOrders = Math.max((users[userIndex].outOfDeliveryOrders || 0) - 1, 0);
            users[userIndex].deliveredOrders = (users[userIndex].deliveredOrders || 0) + 1;
            writeFileSafely(userFilePath, users);
        }

        return res.status(200).json({
            status: 200,
            message: "Order marked as delivered successfully",
            data: { id }
        });

    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({ status: 500, message: "Error marking order as delivered", error: error.message });
    }
};

// SECURITY: never return password hashes in listings
const withoutPassword = ({ password, ...rest }) => rest;

// Get All Delivery Boys (For Admin)
const getAllDeliveryBoys = (req, res) => {
    try {
        const { keyword } = req.query;
        let deliveryBoys = loadDeliveryBoys();

        if (keyword && keyword.trim() !== "") {
            const lowerKeyword = keyword.toLowerCase();
            deliveryBoys = deliveryBoys.filter(boy =>
                boy.name.toLowerCase().includes(lowerKeyword)
            );
        }

        res.status(200).json({
            status: 200,
            message: "All delivery boys fetched successfully",
            data: deliveryBoys.map(withoutPassword)
        });
    } catch (error) {
        console.error("Error reading deliveryBoy.json:", error);
        res.status(500).json({
            status: 500,
            message: "Failed to fetch delivery boys",
            error: error.message
        });
    }
};

// Update Delivery Boy Active Status
const updateDeliveryBoyStatus = (req, res) => {
    const { id, status } = req.body;

    if (!id || !status) {
        return res.status(400).json({
            status: 400,
            message: "Both 'id' and 'status' fields are required"
        });
    }

    try {
        let deliveryBoys = loadDeliveryBoys();
        const index = deliveryBoys.findIndex(boy => boy.id === id);

        if (index === -1) {
            return res.status(404).json({ status: 404, message: "Delivery boy not found" });
        }

        deliveryBoys[index].isActive = status.toLowerCase() === "active";
        fs.writeFileSync(deliveryBoyFilePath, JSON.stringify(deliveryBoys, null, 2));

        return res.status(200).json({
            status: 200,
            message: `Delivery boy status updated to ${status}`
        });

    } catch (error) {
        console.error("Error updating delivery boy status:", error);
        return res.status(500).json({
            status: 500,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Assign Delivery Boy to Order
const assignDeliveryBoy = async (req, res) => {
    try {
        const { orderId, deliveryBoyId } = req.body;

        if (!orderId || !deliveryBoyId) {
            return res.status(400).json({ status: 400, message: "Order ID and Delivery Boy ID are required" });
        }

        let orders = readFileSafely(orderFilePath);
        let deliveryBoys = readFileSafely(deliveryBoyFilePath);
        let users = readFileSafely(userFilePath);

        const orderIndex = orders.findIndex(order => order.id === orderId);
        if (orderIndex === -1) {
            return res.status(404).json({ status: 404, message: "Order not found" });
        }

        const deliveryBoyIndex = deliveryBoys.findIndex(boy => boy.id === deliveryBoyId);
        if (deliveryBoyIndex === -1) {
            return res.status(404).json({ status: 404, message: "Delivery Boy not found" });
        }

        deliveryBoys[deliveryBoyIndex].activeOrders =
            (deliveryBoys[deliveryBoyIndex].activeOrders || 0) + 1;
        writeFileSafely(deliveryBoyFilePath, deliveryBoys);

        const mobileNumber = orders[orderIndex].mobile;
        const userIndex = users.findIndex(u => u.mobile === mobileNumber);
        const user = users[userIndex];

        orders[orderIndex].deliveryBoy = deliveryBoyId;
        orders[orderIndex].status = "out of delivery";
        orders[orderIndex].updatedAt = new Date().toISOString();

        if (!orders[orderIndex].vendorsData && user) {
            orders[orderIndex].vendorsData = {
                id: String(user.id),
                vendorName: user.vendorName,
                shopName: user.shopName,
                mobile: user.mobile,
                gstNo: user.gstNo,
                shipment: {
                    shopNo: user.shopNo,
                    address: user.address,
                    landmark: user.landmark,
                    city: user.city,
                    state: user.state,
                    pinCode: user.pinCode
                }
            };
        }

        writeFileSafely(orderFilePath, orders);

        
         // ✅ Update user.json: acceptedOrders--, outOfDeliveryOrders++
        if (userIndex !== -1) {
            users[userIndex].acceptedOrders = Math.max((users[userIndex].acceptedOrders || 0) - 1, 0);
            users[userIndex].outOfDeliveryOrders = (users[userIndex].outOfDeliveryOrders || 0) + 1;
            writeFileSafely(userFilePath, users);
        }

        return res.status(200).json({ status: 200, message: "Delivery Boy assigned successfully, order status updated to 'out of delivery', and active orders updated",
            order: orders[orderIndex]
        });

    } catch (error) {
        console.error("Error assigning delivery boy:", error);
        return res.status(500).json({ status: 500, message: "Internal Server Error" });
    }
};

// Get Active Delivery Boys Only
const getActiveDeliveryBoys = (req, res) => {
    try {
        const deliveryBoys = loadDeliveryBoys();
        const activeBoys = deliveryBoys.filter(boy => boy.isActive === true);

        res.status(200).json({
            status: 200,
            message: "Active delivery boys fetched successfully",
            data: activeBoys.map(withoutPassword)
        });
    } catch (error) {
        console.error("Error fetching active delivery boys:", error);
        res.status(500).json({
            status: 500,
            message: "Failed to fetch active delivery boys",
            error: error.message
        });
    }
};

module.exports = {
    loginDeliveryBoy,
    getDeliveryBoyProfile,
    getDeliveryBoyDashboard,
    getDeliveryBoyOrders,
    markAsDelivered,
    getAllDeliveryBoys,
    updateDeliveryBoyStatus,
    assignDeliveryBoy,
    getActiveDeliveryBoys
};