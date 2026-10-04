/**
 * GlowWise domain constants – single source of truth for beauty
 * categories, skin types, concerns and order statuses.
 */

const APP_NAME = "GlowWise";

const SKIN_TYPES = ["Dry", "Oily", "Combination", "Normal", "Sensitive"];

const SKIN_CONCERNS = [
  "Acne",
  "Dryness",
  "Pigmentation",
  "Dark Spots",
  "Dullness",
  "Fine Lines",
  "Uneven Skin Tone",
  "Aging",
  "Oiliness",
  "Sensitivity",
  "Hair Fall",
  "Frizz",
  "Dandruff",
];

const CATEGORY_NAMES = [
  "Skincare",
  "Makeup",
  "Haircare",
  "Body Care",
  "Fragrance",
  "Lip Care",
  "Face Care",
  "Sun Care",
  "Wellness",
];

/**
 * Order statuses. `value` is what is stored in orders.json and sent by the
 * admin panel / Flutter app (unchanged legacy values are kept so existing
 * clients keep working). `label` is the customer-facing GlowWise name.
 */
const ORDER_STATUSES = [
  { value: "Pending", label: "Order Placed" },
  { value: "PendingPayment", label: "Awaiting Payment" },
  { value: "Paid", label: "Confirmed" },
  { value: "Packed", label: "Packed" },
  { value: "Shipped", label: "Shipped" },
  { value: "out of delivery", label: "Out for Delivery" },
  { value: "Delivered", label: "Delivered" },
  { value: "Cancelled", label: "Cancelled" },
];

/** Rule-based skincare routine hints used by the recommendation service. */
const ROUTINE_BY_SKIN_TYPE = {
  Oily: ["Gel Cleanser", "Niacinamide Serum", "Lightweight Moisturizer", "Oil-Control Sunscreen"],
  Dry: ["Cream Cleanser", "Hyaluronic Serum", "Rich Moisturizer", "Hydrating Sunscreen"],
  Combination: ["Gentle Cleanser", "Niacinamide Serum", "Lightweight Moisturizer", "Sunscreen"],
  Normal: ["Gentle Cleanser", "Vitamin C Serum", "Moisturizer", "Sunscreen"],
  Sensitive: ["Gentle Cleanser", "Soothing Serum", "Barrier Moisturizer", "Mineral Sunscreen"],
};

/** Subcategories that best match each skin type (used for scoring). */
const SUBCATEGORY_BOOST_BY_SKIN_TYPE = {
  Oily: ["Face Wash", "Cleanser", "Serum", "Moisturizer", "Sunscreen", "Toner"],
  Dry: ["Cleanser", "Moisturizer", "Serum", "Face Mask", "Body Lotion", "Lip Balm"],
  Combination: ["Cleanser", "Serum", "Moisturizer", "Sunscreen", "Toner"],
  Normal: ["Cleanser", "Serum", "Moisturizer", "Sunscreen"],
  Sensitive: ["Cleanser", "Moisturizer", "Sunscreen", "Lip Balm"],
};

module.exports = {
  APP_NAME,
  SKIN_TYPES,
  SKIN_CONCERNS,
  CATEGORY_NAMES,
  ORDER_STATUSES,
  ROUTINE_BY_SKIN_TYPE,
  SUBCATEGORY_BOOST_BY_SKIN_TYPE,
};
