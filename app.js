const express = require("express");
const cors = require("cors");
const path = require("path");

const vendorRoutes = require("./routes/vendorRoutes");
const salesmanRoutes = require("./routes/salesmanRoutes");
const productRoutes = require("./routes/productRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const adminRoutes = require("./routes/adminRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const categoriesRoutes = require("./routes/categoriesRoutes");
const deliveryBoyRoutes = require("./routes/deliveryBoyRoutes");

// GlowWise additions
const wishlistRoutes = require("./routes/wishlistRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const skinAnalysisRoutes = require("./routes/skinAnalysisRoutes");

const { notFound, errorHandler } = require("./middlewares/errorMiddleware");
const { APP_NAME } = require("./constants/glowwise");

const app = express();

// CORS – mobile apps are not affected; set CORS_ORIGIN for a web admin panel
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : "http://localhost:5005";
app.use(
  cors({
    origin: corsOrigin,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

// Static files (product & category images)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/categories_img", express.static(path.join(__dirname, "categories_img")));

// Routes (prefixes unchanged so the Flutter app keeps working)
app.use("/vendor", vendorRoutes);
app.use("/categories", categoriesRoutes);
app.use("/salesman", salesmanRoutes);
app.use("/product", productRoutes);
app.use("/cart", cartRoutes);
app.use("/order", orderRoutes);
app.use("/deliveryBoy", deliveryBoyRoutes);
app.use("/admin", adminRoutes);
app.use("/paymentEntry", paymentRoutes);

app.use("/wishlist", wishlistRoutes);
app.use("/review", reviewRoutes);
app.use("/recommendation", recommendationRoutes);
app.use("/skinAnalysis", skinAnalysisRoutes);

// Health check
app.get("/", (req, res) => {
  res.status(200).json({ message: `${APP_NAME} API is running successfully!` });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
