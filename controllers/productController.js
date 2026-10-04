const path = require("path");
const paths = require("../utils/paths");
const { readFileSafely, writeFileSafely } = require("../utils/fileUtils");
const productService = require("../services/productService");

const readProductsFile = () => readFileSafely(paths.products);
const writeProductsFile = (data) => writeFileSafely(paths.products, data);
const readCategoriesFile = () => readFileSafely(paths.categories);
const writeCategoriesFile = (data) => writeFileSafely(paths.categories, data);

/** Accepts a JSON array string, a comma separated string or an array. */
const parseList = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  const text = String(value).trim();
  if (text.startsWith("[")) {
    try {
      const arr = JSON.parse(text);
      if (Array.isArray(arr)) return arr.map((v) => String(v).trim()).filter(Boolean);
    } catch (e) {
      /* fall back to comma split */
    }
  }
  return text.split(",").map((v) => v.trim()).filter(Boolean);
};

const parseNumber = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
};

/**
 * Pack sizes. Accepts the legacy keys (wholesalerPrice/retailerPrice,
 * priceForWholesaler/priceForRetailer) and GlowWise keys
 * (price = MRP, discountPrice = selling price).
 */
const formatPackSizes = (availablePackSizes) => {
  const raw = typeof availablePackSizes === "string" ? JSON.parse(availablePackSizes) : availablePackSizes;
  if (!Array.isArray(raw)) return [];
  return raw.map((pack, index) => {
    const mrp = Number(pack.price || pack.retailerPrice || pack.priceForRetailer || 0);
    const selling = Number(pack.discountPrice || pack.wholesalerPrice || pack.priceForWholesaler || mrp || 0);
    return {
      _id: pack._id || `p${index + 1}`,
      size: pack.size,
      priceForWholesaler: selling, // GlowWise selling price
      priceForRetailer: mrp || selling, // MRP
    };
  });
};

/** Optional beauty attributes shared by add & update. */
const beautyFieldsFromBody = (body) => {
  const fields = {
    brand: body.brand ? String(body.brand).trim() : undefined,
    subcategory: body.subcategory ? String(body.subcategory).trim() : undefined,
    howToUse: body.howToUse ? String(body.howToUse).trim() : undefined,
    keyIngredients: parseList(body.keyIngredients || body.ingredients),
    benefits: parseList(body.benefits),
    skinTypes: parseList(body.skinTypes),
    skinConcerns: parseList(body.skinConcerns),
    stock: parseNumber(body.stock),
    rating: parseNumber(body.rating),
    reviewCount: parseNumber(body.reviewCount),
  };
  Object.keys(fields).forEach((k) => fields[k] === undefined && delete fields[k]);
  return fields;
};

const refreshCategoryCounts = () => {
  const counted = productService.countProductsPerCategory(readProductsFile(), readCategoriesFile());
  writeCategoriesFile(counted);
};

const nextProductId = (products) => {
  const max = products.reduce((m, p) => Math.max(m, parseInt(p._id, 10) || 0), 0);
  return String(max + 1);
};

// ➕ Add product
const addProduct = (req, res) => {
  try {
    const { productName, productDescription, categories_id, status, slug, availablePackSizes } = req.body;

    if (!productName || !productDescription || !req.files?.productMainImage) {
      return res.status(400).json({ status: 400, message: "Missing required fields" });
    }

    let packSizes = [];
    try {
      packSizes = availablePackSizes ? formatPackSizes(availablePackSizes) : [];
    } catch (e) {
      return res.status(400).json({ status: 400, message: "availablePackSizes must be a valid JSON array" });
    }

    const mainImage = req.files.productMainImage[0];
    const otherImages = req.files.productOtherImages || [];
    const products = readProductsFile();
    const now = new Date().toISOString();

    const newProduct = {
      _id: nextProductId(products), // FIX: length+1 could duplicate ids after a delete
      categories_id: String(categories_id || ""),
      productName,
      productDescription,
      productMainImage: `uploads/${path.basename(mainImage.path)}`,
      productOtherImages: otherImages.map((file, i) => ({
        _id: `img${i + 1}`,
        url: `uploads/${path.basename(file.path)}`,
      })),
      availablePackSizes: packSizes,
      status: status || "active",
      slug: slug || productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      rating: 0,
      reviewCount: 0,
      ...beautyFieldsFromBody(req.body),
      createdAt: now,
      updatedAt: now,
    };

    products.push(newProduct);
    writeProductsFile(products);
    refreshCategoryCounts();

    return res.status(201).json({ status: 201, message: "Product added successfully", product: newProduct });
  } catch (error) {
    console.error("Error adding product:", error);
    return res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

// 📃 Get all products – supports search, filters, sorting and optional pagination
const getAllProducts = (req, res) => {
  try {
    const list = productService.filterProducts(readProductsFile(), req.query, readCategoriesFile());
    const { data, pagination } = productService.paginate(list, req.query.page, req.query.limit);
    const response = { status: 200, message: "Products fetched successfully", data };
    if (pagination) response.pagination = pagination;
    res.status(200).json(response);
  } catch (error) {
    console.error("Error in getAllProducts:", error);
    res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

// 🔎 Get a single product by ID
const getProductById = (req, res) => {
  try {
    const { id } = req.params;
    // FIX: products use `_id` (old code compared `p.id`, so it always 404'd)
    const product = readProductsFile().find((p) => String(p._id) === String(id));
    if (!product) {
      return res.status(404).json({ status: 404, message: "Product not found" });
    }
    res.status(200).json({
      status: 200,
      message: "Product fetched successfully",
      data: productService.enrich(product, readCategoriesFile()),
    });
  } catch (error) {
    console.error("Error in getProductById:", error);
    res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

// ✏️ Update product
const updateProduct = (req, res) => {
  try {
    const { id } = req.params;
    const { productName, productDescription, categories_id, status, slug, availablePackSizes } = req.body;

    const products = readProductsFile();
    const productIndex = products.findIndex((p) => p._id === id);
    if (productIndex === -1) {
      return res.status(404).json({ status: 404, message: "Product not found" });
    }

    const product = products[productIndex];
    if (productName) product.productName = productName;
    if (productDescription) product.productDescription = productDescription;
    if (categories_id) product.categories_id = String(categories_id);
    if (slug) product.slug = slug;
    if (status) product.status = status;

    if (availablePackSizes) {
      try {
        product.availablePackSizes = formatPackSizes(availablePackSizes);
      } catch (e) {
        return res.status(400).json({ status: 400, message: "availablePackSizes must be a valid JSON array" });
      }
    }

    Object.assign(product, beautyFieldsFromBody(req.body));

    if (req.files?.productMainImage?.length) {
      product.productMainImage = `uploads/${path.basename(req.files.productMainImage[0].path)}`;
    }
    if (req.files?.productOtherImages?.length) {
      product.productOtherImages = req.files.productOtherImages.map((file, i) => ({
        _id: `img${i + 1}`,
        url: `uploads/${path.basename(file.path)}`,
      }));
    }

    product.updatedAt = new Date().toISOString();
    products[productIndex] = product;
    writeProductsFile(products);
    refreshCategoryCounts();

    return res.status(200).json({ status: 200, message: "Product updated successfully", product });
  } catch (error) {
    console.error("Error updating product:", error);
    return res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

// 🗑️ Delete product
const deleteProduct = (req, res) => {
  try {
    const { id } = req.params;
    const products = readProductsFile();
    const productIndex = products.findIndex((p) => p._id === id);
    if (productIndex === -1) {
      return res.status(404).json({ status: 404, message: "Product not found" });
    }

    products.splice(productIndex, 1);
    writeProductsFile(products);
    refreshCategoryCounts();

    return res.status(200).json({ status: 200, message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    return res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

// 🛍️ Active products available for sale (same filters as /all)
const getAvailableForSell = (req, res) => {
  try {
    const query = { ...req.query, includeInactive: "false" };
    const list = productService.filterProducts(readProductsFile(), query, readCategoriesFile());

    if (list.length === 0 && req.query.keyword && req.query.keyword.trim() !== "") {
      return res.status(404).json({ status: 404, message: "Product not found" });
    }

    res.status(200).json({ status: 200, message: "Available products fetched successfully", data: list });
  } catch (error) {
    console.error("Error in getAvailableForSell:", error);
    res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

// 🗂️ Products by category ID (used by the Flutter app) – supports the same filters
const getProductsByCategory = (req, res) => {
  try {
    const { categoryId } = req.params;
    const query = { ...req.query, categoryId, includeInactive: "false" };
    const list = productService.filterProducts(readProductsFile(), query, readCategoriesFile());

    // Empty result is a valid 200 response (old API returned 404, which the
    // app displayed as an error instead of an empty state).
    res.status(200).json({
      status: 200,
      message: list.length ? "Products fetched successfully" : "No products found for this category",
      data: list,
    });
  } catch (error) {
    console.error("Error in getProductsByCategory:", error);
    res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

// 🧾 Filter options for building filter UIs
const getFilterOptions = (req, res) => {
  try {
    const { SKIN_TYPES, SKIN_CONCERNS } = require("../constants/glowwise");
    const products = readProductsFile().filter(productService.isActive);
    const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))].sort();
    const subcategories = [...new Set(products.map((p) => p.subcategory).filter(Boolean))].sort();
    const prices = products.map(productService.sellingPrice).filter((p) => p !== null);
    res.status(200).json({
      status: 200,
      message: "Filter options fetched successfully",
      data: {
        categories: readCategoriesFile().map((c) => ({ id: c.id, name: c.name })),
        brands,
        subcategories,
        skinTypes: SKIN_TYPES,
        skinConcerns: SKIN_CONCERNS,
        priceRange: { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 },
        sortOptions: ["relevance", "price_asc", "price_desc", "rating", "discount", "newest"],
      },
    });
  } catch (error) {
    console.error("Error in getFilterOptions:", error);
    res.status(500).json({ status: 500, message: "Internal server error" });
  }
};

module.exports = {
  addProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getAvailableForSell,
  getProductsByCategory,
  getFilterOptions,
};
