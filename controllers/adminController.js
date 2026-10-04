const path = require("path");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { readFileSafely, writeFileSafely } = require("../utils/fileUtils");
const { verifyPassword, hashPassword, needsUpgrade } = require("../utils/password");

const adminFilePath = path.join(__dirname, "../models/admin.json"); // NEW: Admin data

 // load env variables


// Admin Login
const adminLogin = (req, res) => {
  
  const { mobile, password } = req.body;

  const admins = readFileSafely(adminFilePath);
  const matchedAdmin = admins.find(
    (admin) => admin.mobile === mobile && verifyPassword(password, admin.password)
  );

  if (matchedAdmin) {
    // Upgrade legacy plain-text admin password to a bcrypt hash
    if (needsUpgrade(matchedAdmin.password)) {
      matchedAdmin.password = hashPassword(password);
      writeFileSafely(adminFilePath, admins);
    }
    const token = jwt.sign(
      { mobile: matchedAdmin.mobile, id: matchedAdmin.id, role: "admin"},
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    return res.status(200).json({
      status: 200,
      message: "Login successful",
      data: {
        id: matchedAdmin.id,
        name: matchedAdmin.name,
        mobile: matchedAdmin.mobile,
        token: token
      },
      
    });
  } else {
    // 400 (not 401) so the admin app shows this message instead of a generic error
    return res.status(400).json({ status: 400, message: "Invalid mobile number or password" });
  }
};


module.exports = {
  adminLogin,  
};

// ---------------------------------------------------------------------------
// GlowWise admin dashboard & insights
// ---------------------------------------------------------------------------
const modelFile = (name) => path.join(__dirname, "../models", `${name}.json`);
const { ORDER_STATUSES, SKIN_TYPES, SKIN_CONCERNS } = require("../constants/glowwise");

const REVENUE_STATUSES = ["paid", "packed", "shipped", "out of delivery", "delivered"];
const isRevenue = (o) => REVENUE_STATUSES.includes(String(o.status).toLowerCase());
const dayKey = (d) => d.toISOString().slice(0, 10);

// GET /admin/dashboard
const getDashboard = (req, res) => {
  try {
    const users = readFileSafely(modelFile("users"));
    const products = readFileSafely(modelFile("products"));
    const orders = readFileSafely(modelFile("orders"));
    const reviews = readFileSafely(modelFile("reviews"));

    const revenueOrders = orders.filter(isRevenue);
    const totalRevenue = revenueOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const statusCounts = {};
    ORDER_STATUSES.forEach((s) => (statusCounts[s.value] = 0));
    orders.forEach((o) => {
      const match = ORDER_STATUSES.find((s) => s.value.toLowerCase() === String(o.status).toLowerCase());
      if (match) statusCounts[match.value] += 1;
    });

    const now = new Date();
    // Last 7 days
    const daily = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      const key = dayKey(d);
      const dayOrders = revenueOrders.filter((o) => String(o.createdAt).slice(0, 10) === key);
      daily.push({ label: d.toLocaleDateString("en-IN", { weekday: "short" }), date: key,
        revenue: dayOrders.reduce((s, o) => s + Number(o.total || 0), 0), orders: dayOrders.length });
    }
    // Last 6 weeks
    const weekly = [];
    for (let i = 5; i >= 0; i--) {
      const end = new Date(now); end.setDate(now.getDate() - i * 7);
      const start = new Date(end); start.setDate(end.getDate() - 6);
      const inRange = revenueOrders.filter((o) => {
        const d = new Date(o.createdAt); return d >= new Date(dayKey(start)) && d <= new Date(dayKey(end) + "T23:59:59");
      });
      weekly.push({ label: `W${6 - i}`, from: dayKey(start), to: dayKey(end),
        revenue: inRange.reduce((s, o) => s + Number(o.total || 0), 0), orders: inRange.length });
    }
    // Last 6 months
    const monthly = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const m = revenueOrders.filter((o) => String(o.createdAt).slice(0, 7) === key);
      monthly.push({ label: d.toLocaleDateString("en-IN", { month: "short" }), month: key,
        revenue: m.reduce((s, o) => s + Number(o.total || 0), 0), orders: m.length });
    }

    // Top products by units
    const units = {};
    revenueOrders.forEach((o) => (o.products || []).forEach((l) => {
      units[l.productId] = units[l.productId] || { productId: l.productId, productName: l.productName, units: 0, revenue: 0 };
      units[l.productId].units += Number(l.qty) || 0;
      units[l.productId].revenue += Number(l.subtotal) || 0;
    }));

    const lowStock = products
      .filter((p) => p.stock !== undefined && p.stock !== null && Number(p.stock) <= 10)
      .map((p) => ({ _id: p._id, productName: p.productName, stock: p.stock }));

    res.status(200).json({
      status: 200,
      message: "Dashboard fetched successfully",
      data: {
        totalCustomers: users.length,
        totalProducts: products.length,
        activeProducts: products.filter((p) => String(p.status || "active").toLowerCase() === "active").length,
        totalOrders: orders.length,
        pendingOrders: statusCounts["Pending"] + statusCounts["PendingPayment"],
        totalRevenue,
        averageOrderValue: revenueOrders.length ? Math.round(totalRevenue / revenueOrders.length) : 0,
        totalReviews: reviews.length,
        statusCounts,
        sales: { daily, weekly, monthly },
        topProducts: Object.values(units).sort((a, b) => b.units - a.units).slice(0, 5),
        lowStock,
        recentOrders: [...orders]
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5)
          .map((o) => ({ id: o.id, mobile: o.mobile, total: o.total, status: o.status, createdAt: o.createdAt })),
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

// GET /admin/skinInsights – customer-declared skin profiles (NOT AI results)
const getSkinInsights = (req, res) => {
  try {
    const users = readFileSafely(modelFile("users"));
    const profiles = users.map((u) => u.skinProfile || {}).filter((p) => p.skinType || (p.skinConcerns || []).length);
    const typeCounts = Object.fromEntries(SKIN_TYPES.map((t) => [t, 0]));
    const concernCounts = Object.fromEntries(SKIN_CONCERNS.map((c) => [c, 0]));
    profiles.forEach((p) => {
      if (p.skinType && typeCounts[p.skinType] !== undefined) typeCounts[p.skinType] += 1;
      (p.skinConcerns || []).forEach((c) => { if (concernCounts[c] !== undefined) concernCounts[c] += 1; });
    });
    const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).find(([, v]) => v > 0)?.[0] || null;

    res.status(200).json({
      status: 200,
      message: "Skin insights fetched successfully",
      data: {
        aiAvailable: false,
        totalAiAnalyses: 0,
        profilesCompleted: profiles.length,
        totalCustomers: users.length,
        skinTypeDistribution: typeCounts,
        skinConcernDistribution: concernCounts,
        mostCommonSkinType: top(typeCounts),
        mostCommonConcern: top(concernCounts),
      },
    });
  } catch (error) {
    console.error("Skin insights error:", error);
    res.status(500).json({ status: 500, message: "Internal server error" });
  }
};
module.exports.getDashboard = getDashboard;
module.exports.getSkinInsights = getSkinInsights;
