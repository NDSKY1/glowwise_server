const path = require("path");

/** Central paths of the JSON "database" files. */
const model = (name) => path.join(__dirname, "../models", `${name}.json`);

module.exports = {
  products: model("products"),
  categories: model("categories"),
  users: model("users"),
  cart: model("cart"),
  orders: model("orders"),
  cancelledOrders: model("cancelled_orders"),
  payments: model("payment"),
  wishlist: model("wishlist"),
  reviews: model("reviews"),
  admin: model("admin"),
  deliveryBoys: model("deliveryBoy"),
};
