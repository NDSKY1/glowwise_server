/**
 * GlowWise seed script.
 *
 *   npm run seed          → rewrites categories.json and products.json
 *   npm run seed:reset    → also clears carts, orders, payments, wishlists,
 *                           reviews and resets user order counters
 *
 * User, admin, salesman and delivery-boy accounts are never deleted.
 */
const fs = require("fs");
const path = require("path");
const paths = require("../utils/paths");
const { readFileSafely, writeFileSafely } = require("../utils/fileUtils");
const seed = require("./seedData");

const slugify = (text) =>
  String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const existsUpload = (file) => fs.existsSync(path.join(__dirname, "..", file));

const buildProducts = () => {
  const now = new Date().toISOString();
  return seed.products.map((p, index) => {
    const slug = slugify(`${p.brand} ${p.productName}`);
    const main = `uploads/${slug}.jpg`;
    const others = [`uploads/${slug}-2.jpg`, `uploads/${slug}-3.jpg`].filter(existsUpload);

    return {
      _id: String(index + 1),
      categories_id: String(p.categoryId),
      productName: p.productName,
      brand: p.brand,
      subcategory: p.subcategory,
      productDescription: `<p>${p.description}</p>`,
      productMainImage: main,
      productOtherImages: [main, ...others].map((url, i) => ({ _id: `img${i + 1}`, url })),
      availablePackSizes: p.packs.map((pack, i) => ({
        _id: `p${i + 1}`,
        size: pack.size,
        priceForWholesaler: pack.discountPrice, // selling price
        priceForRetailer: pack.price, // MRP
      })),
      status: "active",
      slug,
      rating: p.rating,
      reviewCount: p.reviewCount,
      baseRating: p.rating, // demo baseline – real reviews are blended in
      baseReviewCount: p.reviewCount,
      stock: p.stock,
      keyIngredients: p.keyIngredients,
      benefits: p.benefits,
      howToUse: p.howToUse,
      skinTypes: p.skinTypes,
      skinConcerns: p.skinConcerns,
      createdAt: now,
      updatedAt: now,
    };
  });
};

const buildCategories = (products) =>
  seed.categories.map((c) => ({
    id: c.id,
    name: c.name,
    total_products: products.filter((p) => p.categories_id === String(c.id)).length,
    img: `/categories_img/${c.slug}.jpg`,
  }));

const run = () => {
  const products = buildProducts();
  const categories = buildCategories(products);
  writeFileSafely(paths.products, products);
  writeFileSafely(paths.categories, categories);
  console.log(`✅ Seeded ${categories.length} categories and ${products.length} products`);

  if (process.argv.includes("--reset")) {
    [paths.cart, paths.orders, paths.cancelledOrders, paths.payments, paths.wishlist, paths.reviews].forEach((file) =>
      writeFileSafely(file, [])
    );
    const users = readFileSafely(paths.users).map((u) => ({
      ...u,
      pendingOrders: 0,
      acceptedOrders: 0,
      cancelledOrders: 0,
      outOfDeliveryOrders: 0,
      deliveredOrders: 0,
      skinProfile: u.skinProfile || { skinType: null, skinConcerns: [], preferredCategories: [], beautyPreferences: [] },
    }));
    writeFileSafely(paths.users, users);
    const boys = readFileSafely(paths.deliveryBoys).map((b) => ({ ...b, activeOrders: 0 }));
    writeFileSafely(paths.deliveryBoys, boys);
    console.log("🧹 Cleared carts, orders, payments, wishlists and reviews; reset user order counters");
  }
};

if (require.main === module) run();

module.exports = { run, buildProducts, buildCategories, slugify };
