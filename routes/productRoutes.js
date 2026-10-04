const express = require("express");
const upload = require("../middlewares/upload");
const verifyAdminToken = require("../middlewares/adminAuthMiddleware");

const {
  addProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getAvailableForSell,
  getProductsByCategory,
  getFilterOptions,
} = require("../controllers/productController");

const router = express.Router();

const productImages = upload.fields([
  { name: "productMainImage", maxCount: 1 },
  { name: "productOtherImages", maxCount: 5 },
]);

// Public – listing, search & filters
router.get("/all", getAllProducts);
// FIX: these were declared after "/:id", which swallowed them
router.get("/availableForSell", getAvailableForSell);
router.get("/filters", getFilterOptions);
router.get("/category/:categoryId", getProductsByCategory);

// Admin
router.post("/addproducts", verifyAdminToken, productImages, addProduct);
router.put("/updateproducts/:id", verifyAdminToken, productImages, updateProduct);
router.delete("/deleteproducts/:id", verifyAdminToken, deleteProduct);
router.delete("/delete/:id", verifyAdminToken, deleteProduct);

// Must stay last – matches any id
router.get("/:id", getProductById);

module.exports = router;
