const paths = require("../utils/paths");
const { readFileSafely } = require("../utils/fileUtils");

/**
 * GlowWise product helpers.
 *
 * Pricing (kept compatible with the existing pack-size structure):
 *   availablePackSizes[].priceForRetailer   → MRP (original price)
 *   availablePackSizes[].priceForWholesaler → GlowWise selling price (discounted)
 */

const readProducts = () => readFileSafely(paths.products);
const readCategories = () => readFileSafely(paths.categories);

/** Lower-case + strip accents so "lumiere" finds "Lumière". */
const lower = (v) =>
  String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const toList = (value) => {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
};

/** Selling price of a pack. */
const sellingPriceOf = (pack) => {
  if (!pack) return null;
  const selling = Number(pack.priceForWholesaler);
  if (!Number.isNaN(selling) && selling > 0) return selling;
  const retail = Number(pack.priceForRetailer);
  return Number.isNaN(retail) ? null : retail;
};

/** MRP of a pack (only when higher than the selling price). */
const mrpOf = (pack) => {
  if (!pack) return null;
  const selling = sellingPriceOf(pack);
  const retail = Number(pack.priceForRetailer);
  if (!Number.isNaN(retail) && selling !== null && retail > selling) return retail;
  return null;
};

const defaultPack = (product) =>
  Array.isArray(product.availablePackSizes) && product.availablePackSizes.length
    ? product.availablePackSizes[0]
    : null;

const sellingPrice = (product) => sellingPriceOf(defaultPack(product));

const discountPercentage = (product) => {
  const pack = defaultPack(product);
  const selling = sellingPriceOf(pack);
  const mrp = mrpOf(pack);
  if (!selling || !mrp) return 0;
  return Math.round(((mrp - selling) / mrp) * 100);
};

const isActive = (product) => lower(product.status || "active") === "active";

const isInStock = (product) =>
  product.stock === undefined || product.stock === null || Number(product.stock) > 0;

/** Adds read-only computed fields (category name, discount) to a product. */
const enrich = (product, categories = readCategories()) => {
  const category = categories.find((c) => String(c.id) === String(product.categories_id));
  return {
    ...product,
    categoryName: category ? category.name : null,
    discountPercentage: discountPercentage(product),
    inStock: isInStock(product),
  };
};

/** Keyword search across name, brand, category, subcategory, skin data & slug. */
const matchesKeyword = (product, keyword, categoryName) => {
  const k = lower(keyword);
  if (!k) return true;
  const haystack = [
    product.productName,
    product.brand,
    product.subcategory,
    product.slug,
    categoryName,
    ...(product.skinTypes || []),
    ...(product.skinConcerns || []),
    ...(product.keyIngredients || []),
  ]
    .map(lower)
    .join(" | ");
  // every word must match somewhere (e.g. "vitamin c serum")
  return k.split(/\s+/).every((word) => haystack.includes(word));
};

/** Relevance score for keyword searches (higher = better match). */
const relevanceScore = (product, keyword, categoryName) => {
  const k = lower(keyword);
  if (!k) return 0;
  const name = lower(product.productName);
  const words = k.split(/\s+/);
  let score = 0;
  if (name.includes(k)) score += 10; // whole phrase in the name
  if (words.every((w) => name.includes(w))) score += 5;
  if (lower(product.subcategory).includes(k) || k.includes(lower(product.subcategory))) score += 4;
  if (words.some((w) => lower(product.brand).includes(w))) score += 3;
  if (lower(categoryName).includes(k)) score += 2;
  return score + Number(product.rating || 0) / 10; // tie-breaker
};

const anyMatch = (values, wanted) => {
  if (!wanted.length) return true;
  const set = (values || []).map(lower);
  return wanted.some((w) => set.includes(lower(w)));
};

/**
 * Filters + sorts products.
 * Supported query params (all optional):
 *   keyword, categoryId, category (name), subcategory, brand,
 *   skinType, skinConcern (comma separated lists allowed),
 *   minPrice, maxPrice, minRating, inStock=true,
 *   sort = relevance | price_asc | price_desc | rating | discount | newest
 *   includeInactive=true (admin listing)
 */
const filterProducts = (products, query = {}, categories = readCategories()) => {
  const categoryById = {};
  categories.forEach((c) => (categoryById[String(c.id)] = c.name));

  const categoryIds = toList(query.categoryId);
  const categoryNames = toList(query.category).map(lower);
  const subcategories = toList(query.subcategory).map(lower);
  const brands = toList(query.brand).map(lower);
  const skinTypes = toList(query.skinType);
  const skinConcerns = toList(query.skinConcern);
  const num = (v) => (v !== undefined && v !== "" ? Number(v) : null);
  const minPrice = num(query.minPrice);
  const maxPrice = num(query.maxPrice);
  const minRating = num(query.minRating);

  let list = products.filter((p) => {
    const catName = categoryById[String(p.categories_id)];
    if (String(query.includeInactive) !== "true" && !isActive(p)) return false;
    if (categoryIds.length && !categoryIds.includes(String(p.categories_id))) return false;
    if (categoryNames.length && !categoryNames.includes(lower(catName))) return false;
    if (subcategories.length && !subcategories.includes(lower(p.subcategory))) return false;
    if (brands.length && !brands.includes(lower(p.brand))) return false;
    if (!anyMatch(p.skinTypes, skinTypes)) return false;
    if (!anyMatch(p.skinConcerns, skinConcerns)) return false;
    const price = sellingPrice(p);
    if (minPrice !== null && !Number.isNaN(minPrice) && (price === null || price < minPrice)) return false;
    if (maxPrice !== null && !Number.isNaN(maxPrice) && (price === null || price > maxPrice)) return false;
    if (minRating !== null && !Number.isNaN(minRating) && Number(p.rating || 0) < minRating) return false;
    if (String(query.inStock) === "true" && !isInStock(p)) return false;
    return matchesKeyword(p, query.keyword, catName);
  });

  switch (lower(query.sort)) {
    case "price_asc":
      list.sort((a, b) => (sellingPrice(a) || 0) - (sellingPrice(b) || 0));
      break;
    case "price_desc":
      list.sort((a, b) => (sellingPrice(b) || 0) - (sellingPrice(a) || 0));
      break;
    case "rating":
      list.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
      break;
    case "discount":
      list.sort((a, b) => discountPercentage(b) - discountPercentage(a));
      break;
    case "newest":
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      break;
    default:
      // relevance: best keyword matches first, otherwise stored order
      if (lower(query.keyword)) {
        list = list
          .map((p) => ({ p, score: relevanceScore(p, query.keyword, categoryById[String(p.categories_id)]) }))
          .sort((a, b) => b.score - a.score)
          .map((x) => x.p);
      }
      break;
  }

  return list.map((p) => enrich(p, categories));
};

/** Optional pagination – only applied when `page` is supplied. */
const paginate = (list, page, limit) => {
  if (page === undefined || page === "") return { data: list, pagination: null };
  const p = Math.max(parseInt(page, 10) || 1, 1);
  const l = Math.max(parseInt(limit, 10) || 10, 1);
  const start = (p - 1) * l;
  return {
    data: list.slice(start, start + l),
    pagination: {
      totalDocs: list.length,
      limit: l,
      page: p,
      totalPages: Math.ceil(list.length / l),
      hasPrevPage: p > 1,
      hasNextPage: start + l < list.length,
    },
  };
};

/** Recompute total_products for every category. */
const countProductsPerCategory = (products, categories) =>
  categories.map((c) => ({
    ...c,
    total_products: products.filter(
      (p) => String(p.categories_id) === String(c.id) && isActive(p)
    ).length,
  }));

module.exports = {
  readProducts,
  readCategories,
  toList,
  sellingPriceOf,
  mrpOf,
  defaultPack,
  sellingPrice,
  discountPercentage,
  isActive,
  isInStock,
  enrich,
  filterProducts,
  paginate,
  countProductsPerCategory,
};
