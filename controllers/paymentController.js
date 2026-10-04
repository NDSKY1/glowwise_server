const path = require("path");
const Razorpay = require("razorpay");

const { readFileSafely, writeFileSafely } = require("../utils/fileUtils");



// Path to the JSON file storing payment data
const paymentFile = path.join(__dirname, "../models/payment.json");
const ordersFile = path.join(__dirname, "../models/orders.json");
const usersFilePath = path.join(__dirname, "../models/users.json");





  

exports.getAllPayments = (req, res) => {
  try {
    const mobile = req.user.mobile;

    let { keyword = "", page = "1", limit = "10", status = "" } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);


    let payments = readFileSafely(paymentFile) || [];

    // ✅ Filter payments by current user's mobile
    payments = payments.filter((p) => p.mobile === mobile);

    // ✅ Optional keyword filter (amount or status)
    if (keyword) {
      payments = payments.filter(
        (p) =>
          p.amount.toString().includes(keyword) ||
          p.status?.toLowerCase().includes(keyword.toLowerCase())
      );
    }

    // ✅ Optional status filter
    if (status) {
      payments = payments.filter(
        (p) => p.status?.toLowerCase() === status.toLowerCase()
      );
    }

    const totalDocs = payments.length;
    const totalPages = Math.ceil(totalDocs / limit);
     const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedPayments = payments.slice(startIndex, endIndex);


    // ✅ Build `docs` array (without salesman info)
    const paymentsDocs = paginatedPayments.map((p) => ({
      id: p.id,
      orderId: p.orderId || null,
      mobile: p.mobile || null,
      status: p.status,
      type: p.type,
      amount: p.amount,
      createdAt: p.createdAt,
    }));

    // ✅ Final response
    return res.status(200).json({
      status: 200,
      message: "Payments fetched successfully",
      data: {
        docs: paymentsDocs,
        totalDocs,
        limit,
        page,
        totalPages,
        pagingCounter: startIndex + 1,
        hasPrevPage: page > 1,
        hasNextPage: endIndex < totalDocs,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: endIndex < totalDocs ? page + 1 : null,
      },
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};



// Razorpay client – credentials come ONLY from .env
// Created lazily so the server still starts when keys are not configured
let razorpayClient = null;
const getRazorpay = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayClient;
};

// Razorpay order creation + update payment.json
// Body: { amount, paymentEntryId?, orderId? }
//  - paymentEntryId / orderId (optional) pick the exact pending payment
//  - SECURITY FIX: the charged amount always comes from payment.json,
//    never from the client.
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { amount, paymentEntryId, orderId } = req.body;
    const mobile = req.user?.mobile;

    if (!mobile) {
      return res.status(400).json({ success: false, message: "Missing user" });
    }

    const payments = readFileSafely(paymentFile);
    const pending = (entry) => entry.mobile === mobile && entry.status === "PendingPayment";

    let targetIndex = -1;
    if (paymentEntryId || orderId) {
      targetIndex = payments.findIndex(
        (e) => pending(e) && (String(e.id) === String(paymentEntryId) || String(e.orderId) === String(orderId))
      );
    }
    if (targetIndex === -1 && amount !== undefined) {
      targetIndex = payments.findIndex((e) => pending(e) && Number(e.amount) === Number(amount));
    }
    if (targetIndex === -1) targetIndex = payments.findIndex(pending);

    if (targetIndex === -1) {
      return res.status(404).json({ success: false, message: "No matching pending payment found" });
    }

    const targetPayment = payments[targetIndex];
    const payableAmount = Math.round(Number(targetPayment.amount));
    if (!payableAmount || payableAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid payment amount" });
    }

    const razorpay = getRazorpay();
    if (!razorpay) {
      return res.status(500).json({ success: false, message: "Payment gateway is not configured" });
    }

    const order = await razorpay.orders.create({
      amount: payableAmount * 100,
      currency: "INR",
      receipt: `glowwise_${targetPayment.orderId || Date.now()}`,
      notes: { app: "GlowWise", orderId: String(targetPayment.orderId || "") },
    });

    payments[targetIndex].paymentOrderId = order.id;
    payments[targetIndex].updatedAt = new Date().toISOString();
    writeFileSafely(paymentFile, payments);

    const orders = readFileSafely(ordersFile);
    const orderIndex = orders.findIndex((o) => o.id === targetPayment.orderId);
    if (orderIndex !== -1) {
      orders[orderIndex].paymentOrderId = order.id;
      orders[orderIndex].updatedAt = new Date().toISOString();
      writeFileSafely(ordersFile, orders);
    } else {
      console.warn("⚠️ Order not found in orders.json for orderId:", targetPayment.orderId);
    }

    // `key` (public key id) lets the app open checkout without hardcoding it
    return res.status(200).json({
      success: true,
      order,
      key: process.env.RAZORPAY_KEY_ID,
      amount: payableAmount,
      orderId: targetPayment.orderId,
    });
  } catch (err) {
    console.error("❌ Razorpay Order Creation Failed", err && err.error ? err.error : err);
    return res.status(500).json({ success: false, message: "Order creation failed" });
  }
};

exports.verifyRazorpaySignature = (req, res) => {
  const crypto = require("crypto");
  // SECURITY FIX: secret is read from .env only (old code had a hardcoded
  // fallback secret and read a differently named variable).
  const RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET;
  if (!RAZORPAY_SECRET) {
    return res.status(500).json({ success: false, message: "Payment gateway is not configured" });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, message: "Missing payment details" });
  }

  const generatedSignature = crypto
    .createHmac("sha256", RAZORPAY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const valid =
    generatedSignature.length === String(razorpay_signature).length &&
    crypto.timingSafeEqual(Buffer.from(generatedSignature), Buffer.from(String(razorpay_signature)));

  if (!valid) {
    console.error("❌ Razorpay Signature Verification Failed");
    return res.status(400).json({ success: false, message: "Invalid signature" });
  }

  const payments = readFileSafely(paymentFile);
  const index = payments.findIndex((p) => p.paymentOrderId === razorpay_order_id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Payment not found" });
  }

  const matchedPayment = payments[index];

  // Payment must belong to the logged-in user
  if (req.user?.mobile && matchedPayment.mobile !== req.user.mobile) {
    return res.status(403).json({ success: false, message: "This payment does not belong to you" });
  }

  if (matchedPayment.status === "PaymentReceived") {
    return res.status(200).json({ success: true, message: "Payment already processed" });
  }

  const orderId = matchedPayment.orderId;
  matchedPayment.status = "PaymentReceived";
  matchedPayment.paymentId = razorpay_payment_id;
  matchedPayment.updatedAt = new Date().toISOString();
  matchedPayment.paymentTime = new Date().toISOString();
  writeFileSafely(paymentFile, payments);

  const orders = readFileSafely(ordersFile);
  const orderIndex = orders.findIndex((o) => o.id === orderId);
  if (orderIndex === -1) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  orders[orderIndex].status = "Paid"; // shown in the app as "Confirmed"
  orders[orderIndex].updatedAt = new Date().toISOString();
  writeFileSafely(ordersFile, orders);

  const users = readFileSafely(usersFilePath);
  const userIndex = users.findIndex((u) => u.mobile === orders[orderIndex].mobile);
  if (userIndex !== -1) {
    users[userIndex].pendingOrders = Math.max(0, (users[userIndex].pendingOrders || 0) - 1);
    users[userIndex].acceptedOrders = (users[userIndex].acceptedOrders || 0) + 1;
    writeFileSafely(usersFilePath, users);
  }

  return res.status(200).json({ success: true, message: "Signature verified and payment updated" });
};



exports.getAllPaymentsForAdmin = (req, res) => {
  try {
    let { keyword = "", page = "1", limit = "10", status = "" } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    let payments = readFileSafely(paymentFile) || [];
    let orders = readFileSafely(ordersFile) || [];

    // Optional keyword filter
    if (keyword) {
      payments = payments.filter(
        (p) =>
          p.amount.toString().includes(keyword) ||
          p.status?.toLowerCase().includes(keyword.toLowerCase())
      );
    }

    // Optional status filter
    if (status) {
      payments = payments.filter(
        (p) => p.status?.toLowerCase() === status.toLowerCase()
      );
    }

    const totalDocs = payments.length;
    const totalPages = Math.ceil(totalDocs / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedPayments = payments.slice(startIndex, endIndex);

    const paymentsDocs = paginatedPayments.map((p) => {
      const order = orders.find(o => o.id === p.orderId);
      const vendor = order?.vendorsData || {};

      return {
        id: p.id,
        orderId: p.orderId || null,
        mobile: p.mobile || null,
        status: p.status,
        type: p.type,
        amount: p.amount,
        createdAt: p.createdAt,
        vendorName: vendor.vendorName || "",
        shopName: vendor.shopName || "",
        city: vendor.shipment?.city || "",
        address: vendor.shipment?.address || ""
      };
    });

    return res.status(200).json({
      status: 200,
      message: "All payments fetched for admin",
      data: {
        docs: paymentsDocs,
        totalDocs,
        limit,
        page,
        totalPages,
        pagingCounter: startIndex + 1,
        hasPrevPage: page > 1,
        hasNextPage: endIndex < totalDocs,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: endIndex < totalDocs ? page + 1 : null,
      },
    });
  } catch (error) {
    console.error("Error fetching admin payments:", error);
    res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};


