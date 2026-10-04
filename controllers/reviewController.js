const paths = require("../utils/paths");
const { readFileSafely, writeFileSafely } = require("../utils/fileUtils");

/**
 * Reviews stored in models/reviews.json:
 * { id, productId, mobile, userName, rating (1-5), comment, createdAt, updatedAt }
 *
 * The product keeps `rating` and `reviewCount`. Seeded products start with
 * demo values (`baseRating` / `baseReviewCount`); real reviews are blended in.
 */
const readReviews = () => readFileSafely(paths.reviews);
const writeReviews = (data) => writeFileSafely(paths.reviews, data);

const recalcProductRating = (productId) => {
  const products = readFileSafely(paths.products);
  const product = products.find((p) => p._id === productId);
  if (!product) return;

  const reviews = readReviews().filter((r) => r.productId === productId);
  const baseCount = Number(product.baseReviewCount || 0);
  const baseRating = Number(product.baseRating || 0);
  const sum = reviews.reduce((s, r) => s + Number(r.rating), 0) + baseRating * baseCount;
  const count = reviews.length + baseCount;

  product.rating = count ? Math.round((sum / count) * 10) / 10 : 0;
  product.reviewCount = count;
  writeFileSafely(paths.products, products);
};

const validRating = (rating) => {
  const r = Number(rating);
  return Number.isInteger(r) && r >= 1 && r <= 5 ? r : null;
};

const publicReview = (r) => ({
  id: r.id,
  productId: r.productId,
  userName: r.userName,
  rating: r.rating,
  comment: r.comment,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

// GET /review/product/:productId?page=&limit=
exports.getProductReviews = (req, res) => {
  try {
    const { productId } = req.params;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);

    const all = readReviews()
      .filter((r) => r.productId === productId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const product = readFileSafely(paths.products).find((p) => p._id === productId);
    if (!product) return res.status(404).json({ status: 404, message: "Product not found" });

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    all.forEach((r) => (distribution[r.rating] += 1));
    const start = (page - 1) * limit;

    return res.status(200).json({
      status: 200,
      message: "Reviews fetched successfully",
      data: {
        rating: product.rating || 0,
        reviewCount: product.reviewCount || 0,
        distribution,
        docs: all.slice(start, start + limit).map(publicReview),
        totalDocs: all.length,
        page,
        limit,
        totalPages: Math.ceil(all.length / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

// POST /review/add  { productId, rating, comment }
exports.addReview = (req, res) => {
  try {
    const { productId, comment } = req.body;
    const rating = validRating(req.body.rating);
    if (!productId || !rating) {
      return res.status(400).json({ status: 400, message: "Product ID and a rating between 1 and 5 are required" });
    }
    if (comment && String(comment).length > 1000) {
      return res.status(400).json({ status: 400, message: "Comment must be under 1000 characters" });
    }

    const product = readFileSafely(paths.products).find((p) => p._id === String(productId));
    if (!product) return res.status(404).json({ status: 404, message: "Product not found" });

    const reviews = readReviews();
    if (reviews.some((r) => r.productId === product._id && r.mobile === req.user.mobile)) {
      return res.status(409).json({ status: 409, message: "You have already reviewed this product. Update it instead." });
    }

    const user = readFileSafely(paths.users).find((u) => u.mobile === req.user.mobile);
    const now = new Date().toISOString();
    const review = {
      id: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
      productId: product._id,
      mobile: req.user.mobile,
      userName: user ? user.vendorName : "GlowWise user",
      rating,
      comment: String(comment || "").trim(),
      createdAt: now,
      updatedAt: now,
    };
    reviews.push(review);
    writeReviews(reviews);
    recalcProductRating(product._id);

    return res.status(201).json({ status: 201, message: "Review added successfully", data: publicReview(review) });
  } catch (error) {
    console.error("Error adding review:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

// POST /review/update/:id  { rating?, comment? }
exports.updateReview = (req, res) => {
  try {
    const reviews = readReviews();
    const review = reviews.find((r) => r.id === req.params.id);
    if (!review) return res.status(404).json({ status: 404, message: "Review not found" });
    if (review.mobile !== req.user.mobile) {
      return res.status(403).json({ status: 403, message: "You can only edit your own review" });
    }

    if (req.body.rating !== undefined) {
      const rating = validRating(req.body.rating);
      if (!rating) return res.status(400).json({ status: 400, message: "Rating must be between 1 and 5" });
      review.rating = rating;
    }
    if (req.body.comment !== undefined) review.comment = String(req.body.comment).trim().slice(0, 1000);
    review.updatedAt = new Date().toISOString();

    writeReviews(reviews);
    recalcProductRating(review.productId);
    return res.status(200).json({ status: 200, message: "Review updated successfully", data: publicReview(review) });
  } catch (error) {
    console.error("Error updating review:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

// DELETE /review/delete/:id
exports.deleteReview = (req, res) => {
  try {
    const reviews = readReviews();
    const review = reviews.find((r) => r.id === req.params.id);
    if (!review) return res.status(404).json({ status: 404, message: "Review not found" });
    if (review.mobile !== req.user.mobile && req.user.role !== "admin") {
      return res.status(403).json({ status: 403, message: "You can only delete your own review" });
    }

    writeReviews(reviews.filter((r) => r.id !== review.id));
    recalcProductRating(review.productId);
    return res.status(200).json({ status: 200, message: "Review deleted successfully" });
  } catch (error) {
    console.error("Error deleting review:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

// GET /review/all?keyword=&rating=&page=&limit=   (admin)
exports.getAllReviews = (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const keyword = String(req.query.keyword || "").toLowerCase();
    const rating = parseInt(req.query.rating, 10);
    const products = readFileSafely(paths.products);

    let list = readReviews()
      .map((r) => {
        const p = products.find((x) => x._id === r.productId);
        return { ...publicReview(r), mobile: r.mobile, productName: p ? p.productName : "Deleted product",
          brand: p ? p.brand || "" : "", productMainImage: p ? p.productMainImage : null };
      })
      .filter((r) => !keyword || [r.userName, r.productName, r.brand, r.comment, r.mobile]
        .some((v) => String(v || "").toLowerCase().includes(keyword)))
      .filter((r) => Number.isNaN(rating) || r.rating === rating)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const start = (page - 1) * limit;
    return res.status(200).json({
      status: 200,
      message: "Reviews fetched successfully",
      data: { docs: list.slice(start, start + limit), totalDocs: list.length, page, limit,
        totalPages: Math.max(Math.ceil(list.length / limit), 1) },
    });
  } catch (error) {
    console.error("Error fetching all reviews:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};

// DELETE /review/admin/:id   (admin – remove inappropriate review)
exports.adminDeleteReview = (req, res) => {
  try {
    const reviews = readReviews();
    const review = reviews.find((r) => r.id === req.params.id);
    if (!review) return res.status(404).json({ status: 404, message: "Review not found" });
    writeReviews(reviews.filter((r) => r.id !== review.id));
    recalcProductRating(review.productId);
    return res.status(200).json({ status: 200, message: "Review removed" });
  } catch (error) {
    console.error("Error removing review:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};
