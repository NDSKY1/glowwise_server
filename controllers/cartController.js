const paths = require("../utils/paths");
const { readFileSafely, writeFileSafely } = require("../utils/fileUtils");
const productService = require("../services/productService");

const readCart = () => readFileSafely(paths.cart);
const writeCartFile = (data) => writeFileSafely(paths.cart, data);

/**
 * Returns the cart object of the logged-in user (identified by mobile).
 * FIX: the old code used `cartData[0]` in update / increase / decrease /
 * remove, which modified the FIRST user's cart instead of the caller's.
 */
const findUserCart = (cartData, mobile) => cartData.find((c) => c.mobile === mobile);

const round = (n) => Math.round(Number(n) || 0);

/** Recalculates totals and adds GlowWise summary fields (additive only). */
const withSummary = (userCart) => {
  const productlist = (userCart && userCart.productlist) || [];
  productlist.forEach((item) => {
    item.qty = parseInt(item.qty, 10) || 0;
    item.price = round(item.price);
    item.subtotal = item.qty * item.price;
  });
  const total = productlist.reduce((sum, item) => sum + item.subtotal, 0);
  const mrpTotal = productlist.reduce(
    (sum, item) => sum + item.qty * Math.max(round(item.mrp || item.price), item.price),
    0
  );
  const itemCount = productlist.reduce((sum, item) => sum + item.qty, 0);
  if (userCart) userCart.total = total;
  return {
    ...(userCart || {}),
    total,
    productlist,
    summary: {
      itemCount,
      subtotal: mrpTotal, // at MRP
      discount: mrpTotal - total,
      deliveryCharge: 0,
      total,
    },
  };
};

const emptyCartResponse = (res, message = "Cart is empty") =>
  res.status(200).json({ status: 200, message, data: withSummary({ total: 0, productlist: [] }) });

// ✅ Add product to cart
exports.addProductToCart = (req, res) => {
  try {
    const { productId, sizeId } = req.body;
    const mobile = req.user.mobile;

    if (!productId || !sizeId) {
      return res.status(400).json({ status: 400, message: "Product ID and Size ID are required" });
    }

    const users = readFileSafely(paths.users);
    if (!users.find((u) => u.mobile === mobile)) {
      return res.status(404).json({ status: 404, message: "User not found" });
    }

    const product = productService.readProducts().find((p) => p._id === productId);
    if (!product || !productService.isActive(product)) {
      return res.status(404).json({ status: 404, message: "Product not found" });
    }
    if (!productService.isInStock(product)) {
      return res.status(400).json({ status: 400, message: "This product is currently out of stock" });
    }

    const sizeDetails = (product.availablePackSizes || []).find((s) => s._id === sizeId);
    if (!sizeDetails) return res.status(404).json({ status: 404, message: "Size not found" });

    // GlowWise: every customer pays the selling price (priceForWholesaler);
    // priceForRetailer is the MRP shown with a strike-through.
    const price = productService.sellingPriceOf(sizeDetails);
    const mrp = productService.mrpOf(sizeDetails) || price;

    const cart = readCart();
    let userCart = findUserCart(cart, mobile);
    if (!userCart) {
      userCart = { mobile, total: 0, productlist: [] };
      cart.push(userCart);
    }

    const existing = userCart.productlist.find((i) => i.productId === productId && i.sizeId === sizeId);
    if (existing) {
      if (product.stock !== undefined && existing.qty + 1 > Number(product.stock)) {
        return res.status(400).json({ status: 400, message: `Only ${product.stock} unit(s) available` });
      }
      existing.qty += 1;
      existing.price = price;
      existing.mrp = mrp;
      existing.subtotal = existing.qty * price;
      existing.updatedAt = new Date().toISOString();
    } else {
      userCart.productlist.push({
        _id: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
        productId: product._id,
        productName: product.productName,
        brand: product.brand || null,
        productMainImage: product.productMainImage,
        sizeId: sizeDetails._id,
        size: sizeDetails.size,
        qty: 1,
        price,
        mrp,
        subtotal: price,
        isAvailableForSell: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    const data = withSummary(userCart);
    writeCartFile(cart);
    return res.status(200).json({ status: 200, message: "Product added to cart", data });
  } catch (error) {
    return res.status(500).json({ status: 500, message: "Internal Server Error", error: error.message });
  }
};

// ✅ Show cart contents
exports.showMyCart = (req, res) => {
  try {
    const userCart = findUserCart(readCart(), req.user.mobile);
    if (!userCart || userCart.productlist.length === 0) return emptyCartResponse(res);

    // Flag items that became unavailable after being added
    const products = productService.readProducts();
    userCart.productlist.forEach((item) => {
      const p = products.find((x) => x._id === item.productId);
      item.isAvailableForSell = !!p && productService.isActive(p) && productService.isInStock(p);
    });

    return res.status(200).json({
      status: 200,
      message: "Cart retrieved successfully",
      data: withSummary(userCart),
    });
  } catch (error) {
    console.error("Error fetching cart:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error", error: error.message });
  }
};

// ✅ Set quantity of a product in the cart
exports.updateCartProduct = (req, res) => {
  try {
    const { productId, sizeId, qty } = req.body;
    const newQty = parseInt(qty, 10);

    if (!productId || !sizeId || Number.isNaN(newQty) || newQty <= 0) {
      return res.status(400).json({
        status: 400,
        message: "Invalid input. Product ID, Size ID, and Quantity must be provided, and Quantity must be greater than 0.",
      });
    }

    const cartData = readCart();
    const userCart = findUserCart(cartData, req.user.mobile);
    if (!userCart) return res.status(404).json({ status: 404, message: "Cart not found" });

    const item = userCart.productlist.find((i) => i.productId === productId && i.sizeId === sizeId);
    if (!item) return res.status(404).json({ status: 404, message: "Product not found in cart" });

    const product = productService.readProducts().find((p) => p._id === productId);
    if (product && product.stock !== undefined && newQty > Number(product.stock)) {
      return res.status(400).json({ status: 400, message: `Only ${product.stock} unit(s) available` });
    }

    item.qty = newQty;
    item.updatedAt = new Date().toISOString();

    const data = withSummary(userCart);
    writeCartFile(cartData);
    return res.status(200).json({ status: 200, message: "Cart updated successfully", data });
  } catch (error) {
    console.error("Error updating cart:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error", error: error.message });
  }
};

// ✅ Decrease quantity by one (removes the line at 0)
exports.removeCartProduct = (req, res) => {
  try {
    const cartData = readCart();
    const userCart = findUserCart(cartData, req.user.mobile);
    if (!userCart || userCart.productlist.length === 0) return emptyCartResponse(res);

    const index = userCart.productlist.findIndex((i) => i._id === req.params.id);
    if (index === -1) return res.status(404).json({ status: 404, message: "Product not found in cart" });

    if (userCart.productlist[index].qty > 1) userCart.productlist[index].qty -= 1;
    else userCart.productlist.splice(index, 1);

    const data = withSummary(userCart);
    writeCartFile(cartData);
    return res.status(200).json({ status: 200, message: "Product quantity decreased", data });
  } catch (error) {
    console.error("Error decreasing product quantity:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error", error: error.message });
  }
};

// ✅ Increase quantity by one
exports.increaseCartProduct = (req, res) => {
  try {
    const cartData = readCart();
    const userCart = findUserCart(cartData, req.user.mobile);
    if (!userCart || userCart.productlist.length === 0) return emptyCartResponse(res);

    const item = userCart.productlist.find((i) => i._id === req.params.id);
    if (!item) return res.status(404).json({ status: 404, message: "Product not found in cart" });

    const product = productService.readProducts().find((p) => p._id === item.productId);
    if (product && product.stock !== undefined && item.qty + 1 > Number(product.stock)) {
      return res.status(400).json({ status: 400, message: `Only ${product.stock} unit(s) available` });
    }

    item.qty += 1;
    const data = withSummary(userCart);
    writeCartFile(cartData);
    return res.status(200).json({ status: 200, message: "Product quantity increased", data });
  } catch (error) {
    console.error("Error increasing product quantity:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error", error: error.message });
  }
};

// ✅ Remove a cart line completely
exports.removeParticularCartProduct = (req, res) => {
  try {
    const cartData = readCart();
    const userCart = findUserCart(cartData, req.user.mobile);
    if (!userCart || userCart.productlist.length === 0) return emptyCartResponse(res);

    const before = userCart.productlist.length;
    userCart.productlist = userCart.productlist.filter((i) => i._id !== req.params.id);
    if (userCart.productlist.length === before) {
      return res.status(404).json({ status: 404, message: "Product not found in cart" });
    }

    const data = withSummary(userCart);
    writeCartFile(cartData);
    return res.status(200).json({ status: 200, message: "Product removed from cart", data });
  } catch (error) {
    console.error("Error removing product from cart:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error", error: error.message });
  }
};

// 🆕 Clear the whole cart
exports.clearCart = (req, res) => {
  try {
    const cartData = readCart().filter((c) => c.mobile !== req.user.mobile);
    writeCartFile(cartData);
    return emptyCartResponse(res, "Cart cleared");
  } catch (error) {
    console.error("Error clearing cart:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error", error: error.message });
  }
};
