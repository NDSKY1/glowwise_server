const paths = require("../utils/paths");
const { readFileSafely } = require("../utils/fileUtils");
const productService = require("./productService");
const { ROUTINE_BY_SKIN_TYPE, SUBCATEGORY_BOOST_BY_SKIN_TYPE } = require("../constants/glowwise");

/**
 * RULE-BASED recommendations (current version).
 *
 * This is NOT artificial intelligence. It scores products with transparent
 * rules using data that already exists:
 *   +3  product suits the user's skin type
 *   +2  per matching skin concern
 *   +2  subcategory fits the routine for that skin type
 *   +1  category is one of the user's preferred categories
 *   +1  category the user bought from before
 *   +1  category of a wishlisted product
 *   +rating/5 as a tie-breaker
 * Products already in the wishlist, out of stock or inactive are skipped.
 *
 * FUTURE: an AI ranker can replace `scoreProducts` while keeping the same
 * input (user context) and output (ranked products + reasons).
 */
const ENGINE = "rule-based-v1";

const lower = (v) => String(v || "").toLowerCase();

const buildUserContext = (mobile) => {
  const user = readFileSafely(paths.users).find((u) => u.mobile === mobile) || {};
  const skinProfile = user.skinProfile || {};
  const products = productService.readProducts();
  const categories = productService.readCategories();
  const catName = (id) => (categories.find((c) => String(c.id) === String(id)) || {}).name;

  const orderedCategories = new Set();
  const orderedProductIds = new Set();
  readFileSafely(paths.orders)
    .filter((o) => o.mobile === mobile)
    .forEach((o) =>
      (o.products || []).forEach((line) => {
        orderedProductIds.add(line.productId);
        const p = products.find((x) => x._id === line.productId);
        if (p) orderedCategories.add(catName(p.categories_id));
      })
    );

  const wishlistEntry = readFileSafely(paths.wishlist).find((w) => w.mobile === mobile);
  const wishlistIds = new Set((wishlistEntry ? wishlistEntry.items : []).map((i) => i.productId));
  const wishlistCategories = new Set(
    [...wishlistIds].map((id) => {
      const p = products.find((x) => x._id === id);
      return p ? catName(p.categories_id) : null;
    }).filter(Boolean)
  );

  return {
    skinType: skinProfile.skinType || null,
    skinConcerns: skinProfile.skinConcerns || [],
    preferredCategories: skinProfile.preferredCategories || [],
    orderedCategories: [...orderedCategories].filter(Boolean),
    orderedProductIds: [...orderedProductIds],
    wishlistIds: [...wishlistIds],
    wishlistCategories: [...wishlistCategories],
  };
};

const scoreProducts = (context, options = {}) => {
  const categories = productService.readCategories();
  const catName = (id) => (categories.find((c) => String(c.id) === String(id)) || {}).name;
  const routineSubcats = (SUBCATEGORY_BOOST_BY_SKIN_TYPE[context.skinType] || []).map(lower);

  return productService
    .readProducts()
    .filter((p) => productService.isActive(p) && productService.isInStock(p))
    .filter((p) => !context.wishlistIds.includes(p._id))
    .filter((p) => !options.categoryId || String(p.categories_id) === String(options.categoryId))
    .map((p) => {
      let score = 0;
      const reasons = [];
      const category = catName(p.categories_id);
      const types = (p.skinTypes || []).map(lower);
      const concerns = (p.skinConcerns || []).map(lower);

      if (context.skinType && types.includes(lower(context.skinType))) {
        score += 3;
        reasons.push(`Suits ${context.skinType} skin`);
      }
      const matchedConcerns = context.skinConcerns.filter((c) => concerns.includes(lower(c)));
      if (matchedConcerns.length) {
        score += 2 * matchedConcerns.length;
        reasons.push(`Targets ${matchedConcerns.join(", ")}`);
      }
      if (context.skinType && routineSubcats.includes(lower(p.subcategory))) {
        score += 2;
        reasons.push(`Part of a ${context.skinType.toLowerCase()}-skin routine`);
      }
      if (context.preferredCategories.includes(category)) {
        score += 1;
        reasons.push(`From your favourite category: ${category}`);
      }
      if (context.orderedCategories.includes(category)) score += 1;
      if (context.wishlistCategories.includes(category)) score += 1;
      score += Number(p.rating || 0) / 5;

      return { product: productService.enrich(p, categories), score: Math.round(score * 100) / 100, reasons };
    })
    .sort((a, b) => b.score - a.score);
};

const recommendFor = (mobile, options = {}) => {
  const limit = Math.min(Math.max(parseInt(options.limit, 10) || 10, 1), 50);
  const context = buildUserContext(mobile);
  const ranked = scoreProducts(context, options).slice(0, limit);
  const personalised = !!(context.skinType || context.skinConcerns.length || context.preferredCategories.length);

  return {
    engine: ENGINE,
    personalised,
    basedOn: {
      skinType: context.skinType,
      skinConcerns: context.skinConcerns,
      preferredCategories: context.preferredCategories,
    },
    suggestedRoutine: context.skinType ? ROUTINE_BY_SKIN_TYPE[context.skinType] || [] : [],
    products: ranked.map((r) => ({ ...r.product, recommendationScore: r.score, reasons: r.reasons })),
  };
};

module.exports = { ENGINE, buildUserContext, scoreProducts, recommendFor };
