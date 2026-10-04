const paths = require("../utils/paths");
const { readFileSafely, writeFileSafely } = require("../utils/fileUtils");
const productService = require("../services/productService");

/**
 * Wishlist stored in models/wishlist.json:
 * [{ mobile, items: [{ productId, addedAt }] }]
 * Responses return full product objects (same shape as product APIs).
 */
const readWishlist = () => readFileSafely(paths.wishlist);
const writeWishlist = (data) => writeFileSafely(paths.wishlist, data);

const userEntry = (all, mobile) => {
  let entry = all.find((w) => w.mobile === mobile);
  if (!entry) {
    entry = { mobile, items: [] };
    all.push(entry);
  }
  return entry;
};

const productsFor = (entry) => {
  const products = productService.readProducts();
  const categories = productService.readCategories();
  return (entry ? entry.items : [])
    .map((item) => {
      const p = products.find((x) => x._id === item.productId);
      return p ? { ...productService.enrich(p, categories), addedAt: item.addedAt } : null;
    })
    .filter(Boolean);
};

// GET /wishlist/myWishlist
exports.getWishlist = (req, res) => {
  try {
    const entry = readWishlist().find((w) => w.mobile === req.user.mobile);
    const data = productsFor(entry);
    return res.status(200).json({ status: 200, message: "Wishlist fetched successfully", data });
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

// POST /wishlist/add  { productId }
exports.addToWishlist = (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json({ status: 400, message: "Product ID is required" });

    const product = productService.readProducts().find((p) => p._id === String(productId));
    if (!product) return res.status(404).json({ status: 404, message: "Product not found" });

    const all = readWishlist();
    const entry = userEntry(all, req.user.mobile);
    if (entry.items.some((i) => i.productId === product._id)) {
      return res.status(200).json({ status: 200, message: "Product already in wishlist", data: productsFor(entry) });
    }
    entry.items.unshift({ productId: product._id, addedAt: new Date().toISOString() });
    writeWishlist(all);

    return res.status(201).json({ status: 201, message: "Added to wishlist", data: productsFor(entry) });
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

// DELETE /wishlist/remove/:productId
exports.removeFromWishlist = (req, res) => {
  try {
    const all = readWishlist();
    const entry = all.find((w) => w.mobile === req.user.mobile);
    const before = entry ? entry.items.length : 0;
    if (entry) entry.items = entry.items.filter((i) => i.productId !== req.params.productId);

    if (!entry || entry.items.length === before) {
      return res.status(404).json({ status: 404, message: "Product not found in wishlist" });
    }
    writeWishlist(all);
    return res.status(200).json({ status: 200, message: "Removed from wishlist", data: productsFor(entry) });
  } catch (error) {
    console.error("Error removing from wishlist:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

// GET /wishlist/status/:productId
exports.getWishlistStatus = (req, res) => {
  try {
    const entry = readWishlist().find((w) => w.mobile === req.user.mobile);
    const isWishlisted = !!entry && entry.items.some((i) => i.productId === req.params.productId);
    return res.status(200).json({
      status: 200,
      message: "Wishlist status fetched successfully",
      data: { productId: req.params.productId, isWishlisted },
    });
  } catch (error) {
    console.error("Error checking wishlist:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};
