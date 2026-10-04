const path = require("path");
const { readFileSafely, writeFileSafely } = require("../utils/fileUtils");

const cartFilePath = path.join(__dirname, "../models/cart.json");
const orderFilePath = path.join(__dirname, "../models/orders.json");
const productFilePath = path.join(__dirname, "../models/products.json");
const usersFilePath = path.join(__dirname, "../models/users.json");
const cancelledOrderFilePath = path.join(
  __dirname,
  "../models/cancelled_orders.json"
);
const paymentFilePath = path.join(__dirname, "../models/payment.json");
const { ORDER_STATUSES } = require("../constants/glowwise");

/** Customer-facing GlowWise label for a stored status value. */
const statusLabel = (status) => {
  const found = ORDER_STATUSES.find(
    (s) => s.value.toLowerCase() === String(status || "").toLowerCase()
  );
  return found ? found.label : status;
};

/** FIX: old code searched `order.orderId`, which does not exist (crashed). */
const matchesOrderKeyword = (order, keyword) => {
  const k = String(keyword || "").toLowerCase();
  if (!k) return true;
  return (
    String(order.id || "").toLowerCase().includes(k) ||
    String(order.challanNo || "").toLowerCase().includes(k) ||
    String(order.mobile || "").includes(k) ||
    (order.products || []).some((p) =>
      String(p.productName || "").toLowerCase().includes(k) ||
      String(p.brand || "").toLowerCase().includes(k)
    )
  );
};

const newestFirst = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);

/** Adjust product stock (negative delta = reduce). Products without `stock` are untracked. */
const adjustStock = (lines, direction) => {
  const products = readFileSafely(productFilePath);
  let changed = false;
  (lines || []).forEach((line) => {
    const p = products.find((x) => x._id === line.productId);
    if (p && p.stock !== undefined && p.stock !== null) {
      p.stock = Math.max(0, Number(p.stock) + direction * Number(line.qty || 0));
      changed = true;
    }
  });
  if (changed) writeFileSafely(productFilePath, products);
};

const formatOrderProducts = (products) =>
  (products || []).map((product) => ({
    productId: product.productId, // FIX: was product._id (the cart line id)
    productName: product.productName,
    brand: product.brand || null,
    productMainImage: product.productMainImage,
    qty: product.qty,
    price: product.price,
    mrp: product.mrp || product.price,
    size: product.size,
    subtotal: product.subtotal,
    _id: product._id || null,
  }));

exports.createOrder = (req, res) => {
  try {
    const mobile = req.user.mobile;
    const { remark, type = "Online" } = req.body;

    let cartData = readFileSafely(cartFilePath);
    let userCart = cartData.find((cart) => cart.mobile === mobile);
    const created = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    });

    if (!userCart || userCart.productlist.length === 0) {
      return res
        .status(400)
        .json({ status: 400, message: "Cart is empty. Cannot create order." });
    }

    // GlowWise: make sure every item is still available / in stock
    const allProducts = readFileSafely(productFilePath);
    for (const line of userCart.productlist) {
      const p = allProducts.find((x) => x._id === line.productId);
      if (!p || String(p.status || "active").toLowerCase() !== "active") {
        return res.status(400).json({
          status: 400,
          message: `${line.productName} is no longer available. Please remove it from your cart.`,
        });
      }
      if (p.stock !== undefined && p.stock !== null && Number(line.qty) > Number(p.stock)) {
        return res.status(400).json({
          status: 400,
          message: `Only ${p.stock} unit(s) of ${line.productName} are available.`,
        });
      }
    }

    const total = userCart.productlist.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );
    const orderId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // ✅ Fetch vendor info using mobile from users.json
    let usersData = readFileSafely(usersFilePath);
    let vendor = usersData.find((user) => user.mobile === mobile);

    let vendorsData = null;
    if (vendor) {
      vendorsData = {
        id: String(vendor.id),
        vendorName: vendor.vendorName,
        shopName: vendor.shopName,
        mobile: vendor.mobile,
        gstNo: vendor.gstNo,
        shipment: {
          shopNo: vendor.shopNo,
          address: vendor.address,
          landmark: vendor.landmark,
          city: vendor.city,
          state: vendor.state,
          pinCode: vendor.pinCode,
        },
      };
    }

    const newOrder = {
      id: orderId,
      challanNo: orderId,
      mobile,
      total,
      products: userCart.productlist,
      remark: remark || "N/A",
      status: "Pending",
      deliveryBoy: null,
      createdAt: new Date(created).toISOString(),
      updatedAt: new Date(created).toISOString(),
      vendorsData: vendorsData,
      paymentOrderId: null,
    };

    // Save order
    let orderData = readFileSafely(orderFilePath);
    orderData.push(newOrder);
    writeFileSafely(orderFilePath, orderData);

    // Reserve stock
    adjustStock(newOrder.products, -1);

    // Clear cart
    cartData = cartData.filter((cart) => cart.mobile !== mobile);
    writeFileSafely(cartFilePath, cartData);

    // Update pending orders
    const vendorIndex = usersData.findIndex((user) => user.mobile === mobile);
    if (vendorIndex !== -1) {
      usersData[vendorIndex].pendingOrders += 1;
      writeFileSafely(usersFilePath, usersData);
    }

    // Create payment entry
    const paymentId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const paymentEntry = {
      id: paymentId,
      orderId: orderId,
      paymentOrderId: null,
      mobile,
      status: "Pending",
      type: type,
      amount: total,
      createdAt: new Date(created).toISOString(),
    };

    let paymentData = readFileSafely(paymentFilePath);
    paymentData.push(paymentEntry);
    writeFileSafely(paymentFilePath, paymentData);

    return res.status(201).json({
      status: 201,
      message: "Order created successfully",
      data: newOrder,
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// ✅ Get User Orders
exports.getUserOrders = (req, res) => {
  try {
    const mobile = req.user.mobile;
    const { keyword = "", page = 1, limit = 10, status = "" } = req.query;

    let orderData = readFileSafely(orderFilePath);
    let userOrders = orderData.filter((order) => order.mobile === mobile);

    if (status) {
      userOrders = userOrders.filter(
        (order) => order.status.toLowerCase() === status.toLowerCase()
      );
    }

    if (keyword) {
      userOrders = userOrders.filter((order) => matchesOrderKeyword(order, keyword));
    }

    userOrders.sort(newestFirst);

    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedOrders = userOrders.slice(
      startIndex,
      startIndex + parseInt(limit)
    );

    const formattedOrders = paginatedOrders.map((order) => ({
      id: order.id,
      vendorId: req.user.name, // If applicable, otherwise remove
      challanNo: order.challanNo,
      total: order.total,
      productList: formatOrderProducts(order.products),
      remark: order.remark || "",
      status: order.status,
      statusLabel: statusLabel(order.status),
      deliveryBoy: null, // If applicable
      createdAt: order.createdAt,
      updatedAt: order.updatedAt || order.createdAt,
    }));

    return res.status(200).json({
      status: 200,
      message: "User orders fetched successfully",
      data: {
        docs: formattedOrders,
        totalDocs: userOrders.length,
        limit: parseInt(limit),
        page: parseInt(page),
        totalPages: Math.ceil(userOrders.length / parseInt(limit)),
        pagingCounter: startIndex + 1,
        hasPrevPage: parseInt(page) > 1,
        hasNextPage: startIndex + parseInt(limit) < userOrders.length,
        prevPage: parseInt(page) > 1 ? parseInt(page) - 1 : null,
        nextPage:
          startIndex + parseInt(limit) < userOrders.length
            ? parseInt(page) + 1
            : null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// ✅ Get All Orders for Admin
exports.getAllOrdersForAdmin = (req, res) => {
  try {
    const { keyword = "", page = 1, limit = 10, status = "" } = req.query;

    let orders = readFileSafely(orderFilePath);
    let users = readFileSafely(usersFilePath);
    const payments = readFileSafely(paymentFilePath);

    // ✅ Filter by status if provided (no hardcoded pending anymore)
    if (status) {
      orders = orders.filter(
        (order) => order.status?.toLowerCase() === status.toLowerCase()
      );
    }

    // ✅ Filter by keyword (order id, mobile, product name or brand)
    if (keyword) {
      orders = orders.filter((order) => matchesOrderKeyword(order, keyword));
    }

    orders.sort(newestFirst);

    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedOrders = orders.slice(
      startIndex,
      startIndex + parseInt(limit)
    );

    const formattedOrders = paginatedOrders.map((order) => {
      const user = users.find((u) => u.mobile === order.mobile);
      return {
        id: order.id,
        mobile: order.mobile,
        userName: user ? user.vendorName || user.name : "Unknown",
        total: order.total,
        remark: order.remark || "",
        status: order.status,
        statusLabel: statusLabel(order.status),
        createdAt: order.createdAt,
        updatedAt: order.updatedAt || order.createdAt,
        productList: formatOrderProducts(order.products),
        customer: {
          name: user ? user.vendorName || user.name : "Unknown",
          mobile: order.mobile,
          email: user ? user.email || "" : "",
        },
        deliveryAddress: order.vendorsData ? order.vendorsData.shipment : null,
        payment: (() => {
          const p = payments.find((x) => x.orderId === order.id);
          return p
            ? { status: p.status, type: p.type || "Razorpay", amount: p.amount, paymentId: p.paymentId || null, paymentOrderId: p.paymentOrderId || null }
            : null;
        })(),
        deliveryBoy: order.deliveryBoy || null,
      };
    });

    return res.status(200).json({
      status: 200,
      message: "All orders fetched successfully",
      data: {
        docs: formattedOrders,
        totalDocs: orders.length,
        limit: parseInt(limit),
        page: parseInt(page),
        totalPages: Math.ceil(orders.length / parseInt(limit)),
        pagingCounter: startIndex + 1,
        hasPrevPage: parseInt(page) > 1,
        hasNextPage: startIndex + parseInt(limit) < orders.length,
        prevPage: parseInt(page) > 1 ? parseInt(page) - 1 : null,
        nextPage:
          startIndex + parseInt(limit) < orders.length
            ? parseInt(page) + 1
            : null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.updateOrderStatus = (req, res) => {
  try {
    const { orderId, status } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({
        status: 400,
        message: "orderId and status are required.",
      });
    }

    let orders = readFileSafely(orderFilePath);
    const index = orders.findIndex((order) => order.id === orderId);

    if (index === -1) {
      return res.status(404).json({
        status: 404,
        message: "Order not found.",
      });
    }

    const order = orders[index];

    // ✅ Handle "Cancelled" status: move to cancelled_orders.json and remove from orders.json
    if (status.toLowerCase() === "cancelled") {
      if (String(order.status).toLowerCase() === "cancelled") {
        return res.status(400).json({ status: 400, message: "Order is already cancelled." });
      }
      // Return reserved stock
      adjustStock(order.products, +1);

      const cancelledOrders = readFileSafely(cancelledOrderFilePath);

      // Add to cancelled_orders.json
      order.status = "Cancelled";
      order.updatedAt = new Date().toISOString();
      cancelledOrders.push(order);
      writeFileSafely(cancelledOrderFilePath, cancelledOrders);

      // // Remove from orders.json
      // orders.splice(index, 1);
      // writeFileSafely(orderFilePath, orders);

      // ✅ Update user.json: pendingOrders--, cancelledOrders++
      const users = readFileSafely(usersFilePath);
      const userIndex = users.findIndex((u) => u.mobile === order.mobile);

      if (userIndex !== -1) {
        // Ensure values are at least 0
        users[userIndex].pendingOrders = Math.max(
          (users[userIndex].pendingOrders || 0) - 1,
          0
        );
        users[userIndex].cancelledOrders =
          (users[userIndex].cancelledOrders || 0) + 1;
        writeFileSafely(usersFilePath, users);
      }
    }

    // ✅ For any other status (e.g., "PendingPayment")
    orders[index].status = status;
    orders[index].updatedAt = new Date().toISOString();
    writeFileSafely(orderFilePath, orders);

    // ✅ Also update payment.json if status is "PendingPayment"
    if (status.toLowerCase() === "pendingpayment") {
      const payments = readFileSafely(paymentFilePath);
      const paymentIndex = payments.findIndex((p) => p.orderId === orderId);

      if (paymentIndex !== -1) {
        payments[paymentIndex].status = "PendingPayment";
        payments[paymentIndex].updatedAt = new Date().toISOString();
        writeFileSafely(paymentFilePath, payments);
      }
    }

    return res.status(200).json({
      status: 200,
      message: `Order status updated to ${status}`,
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// ✅ Get All Cancelled Orders
exports.getAllCancelledOrders = (req, res) => {
  try {
    const { keyword = "", page = 1, limit = 10 } = req.query;

    let cancelledOrders = readFileSafely(cancelledOrderFilePath);
    let users = readFileSafely(usersFilePath);

    // ✅ Filter by keyword in orderId or mobile only
    if (keyword) {
      cancelledOrders = cancelledOrders.filter((order) => matchesOrderKeyword(order, keyword));
    }

    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const paginatedOrders = cancelledOrders.slice(
      startIndex,
      startIndex + parseInt(limit)
    );

    const formattedOrders = paginatedOrders.map((order) => {
      const user = users.find((u) => u.mobile === order.mobile);
      return {
        id: order.id,
        mobile: order.mobile,
        userName: user ? user.vendorName || user.name : "Unknown",
        total: order.total,
        remark: order.remark || "",
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt || order.createdAt,
        productList: order.products.map((product) => ({
          productId: product.productId,
          productName: product.productName,
          productMainImage: product.productMainImage,
          qty: product.qty,
          price: product.price,
          size: product.size,
          subtotal: product.subtotal,
        })),
      };
    });

    return res.status(200).json({
      status: 200,
      message: "Cancelled orders fetched successfully",
      data: {
        docs: formattedOrders,
        totalDocs: cancelledOrders.length,
        limit: parseInt(limit),
        page: parseInt(page),
        totalPages: Math.ceil(cancelledOrders.length / parseInt(limit)),
        pagingCounter: startIndex + 1,
        hasPrevPage: parseInt(page) > 1,
        hasNextPage: startIndex + parseInt(limit) < cancelledOrders.length,
        prevPage: parseInt(page) > 1 ? parseInt(page) - 1 : null,
        nextPage:
          startIndex + parseInt(limit) < cancelledOrders.length
            ? parseInt(page) + 1
            : null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// ✅ Product-wise sales report (units sold per pack size)
// GlowWise: replaces the old food "total kg sold" report with units & revenue.
exports.getProductWiseOrderQuantity = (req, res) => {
  try {
    const productIdFilter = req.query.productId;
    const countedStatuses = ["paid", "packed", "shipped", "out of delivery", "delivered"];

    const orders = readFileSafely(orderFilePath);
    const products = readFileSafely(productFilePath);

    const filteredProducts = productIdFilter
      ? products.filter((p) => p._id === productIdFilter)
      : products;

    if (filteredProducts.length === 0) {
      return res.status(404).json({ status: 404, message: "Product not found" });
    }

    const report = {};
    filteredProducts.forEach((product) => {
      const name = product.productName?.trim();
      if (!name) return;
      report[name] = {
        productId: product._id,
        brand: product.brand || null,
        packs: (product.availablePackSizes || []).map((pack) => ({
          size: pack.size,
          orderedQty: 0,
        })),
        totalUnitsSold: 0,
        totalRevenue: 0,
      };
    });

    orders
      .filter((order) => countedStatuses.includes(String(order.status).toLowerCase()))
      .forEach((order) => {
        (order.products || []).forEach((line) => {
          const name = line.productName?.trim();
          if (!name || !report[name]) return;
          if (productIdFilter && line.productId !== productIdFilter) return;
          const pack = report[name].packs.find((p) => p.size === line.size?.trim());
          if (pack) pack.orderedQty += Number(line.qty) || 0;
          report[name].totalUnitsSold += Number(line.qty) || 0;
          report[name].totalRevenue += Number(line.subtotal) || 0;
        });
      });

    return res.status(200).json({
      status: 200,
      message: productIdFilter
        ? "Product-wise order quantity for selected product fetched successfully"
        : "All product-wise order quantities fetched successfully",
      data: report,
    });
  } catch (error) {
    return res.status(500).json({ status: 500, message: "Internal Server Error", error: error.message });
  }
};

// 🆕 Order details for the logged-in user
exports.getOrderDetails = (req, res) => {
  try {
    const { id } = req.params;
    const all = [...readFileSafely(orderFilePath)];
    const order = all.find((o) => String(o.id) === String(id) && o.mobile === req.user.mobile);

    if (!order) {
      return res.status(404).json({ status: 404, message: "Order not found" });
    }

    const payment = readFileSafely(paymentFilePath).find((p) => p.orderId === order.id);

    return res.status(200).json({
      status: 200,
      message: "Order details fetched successfully",
      data: {
        id: order.id,
        challanNo: order.challanNo,
        total: order.total,
        productList: formatOrderProducts(order.products),
        remark: order.remark || "",
        status: order.status,
        statusLabel: statusLabel(order.status),
        deliveryAddress: order.vendorsData ? order.vendorsData.shipment : null,
        payment: payment
          ? { status: payment.status, type: payment.type, amount: payment.amount, paymentId: payment.paymentId || null }
          : null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt || order.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ status: 500, message: "Internal Server Error", error: error.message });
  }
};

// 🆕 List of order statuses (value stored + GlowWise label)
exports.getOrderStatuses = (req, res) => {
  return res.status(200).json({
    status: 200,
    message: "Order statuses fetched successfully",
    data: ORDER_STATUSES,
  });
};
