const express = require("express");
const router = express.Router();
const uploadMiddleware = require("../middlewares/uploadMiddleware");
const verifyAdminToken = require("../middlewares/adminAuthMiddleware") // Import middleware


const categoriesController = require("../controllers/categoriesController");

// Get all categories (with optional search)
router.get("/all", categoriesController.getAllCategories);

// router.post("/addCategory" ,addCategory);
// router.post(
//   "/addCategory",
//   verifyAdminToken,
//   uploadMiddleware.single("img"), // 👈 image file input name is "img"
//   categoriesController.addCategory
// );
router.post(
  "/addCategory",
  verifyAdminToken,
  uploadMiddleware.single("img"), // 👈 image file input name is "img"
  categoriesController.addCategory
);
router.put(
  "/updatecategories/:id",
  verifyAdminToken,
  uploadMiddleware.single("img"),
  categoriesController.editCategory
);
router.delete("/deletecategories/:id",verifyAdminToken, categoriesController.deleteCategory); // 👈 DELETE route

module.exports = router;
