# GlowWise Backend – Project Analysis & Transformation Report

Base project: **Valida Foods server** (`valida_server`). This report describes what was
found and what was changed to turn it into the **GlowWise** beauty & personal-care backend.

---

## 1. Project architecture

```text
glowwise_server/
├── server.js                 # loads .env, validates config, starts Express
├── app.js                    # middleware, static folders, route mounting, error handling
├── constants/
│   └── glowwise.js           # NEW – categories, skin types, concerns, order statuses
├── controllers/              # request handlers (business logic lives here)
│   ├── vendorController.js   # auth, profile, address, skin profile (customer = "vendor")
│   ├── productController.js  # products, search, filters
│   ├── categoriesController.js
│   ├── cartController.js
│   ├── orderController.js
│   ├── paymentController.js  # Razorpay
│   ├── adminController.js
│   ├── deliveryBoyController.js
│   ├── salesmanController.js
│   ├── wishlistController.js        # NEW
│   ├── reviewController.js          # NEW
│   ├── recommendationController.js  # NEW
│   └── skinAnalysisController.js    # NEW (future AI – returns 501)
├── services/
│   ├── productService.js            # NEW – search, filters, sorting, pricing helpers
│   ├── recommendationService.js     # NEW – rule-based recommendations
│   └── skinAnalysisService.js       # NEW – AI provider interface (no fake results)
├── middlewares/
│   ├── authMiddleware.js            # customer JWT
│   ├── adminAuthMiddleware.js       # admin JWT (role = admin)
│   ├── deliveryBoyAuthMiddleware.js
│   ├── upload.js                    # multer → /uploads (product images)
│   ├── uploadMiddleware.js          # multer → /categories_img
│   └── errorMiddleware.js           # NEW – 404 + global error handler
├── routes/                          # one router per resource
├── models/*.json                    # JSON-file "database"
├── seed/
│   ├── seedData.js                  # NEW – 9 categories, 23 beauty products
│   └── seed.js                      # NEW – npm run seed / seed:reset
├── uploads/                         # product images (beauty placeholders)
├── categories_img/                  # category images (beauty placeholders)
├── utils/  fileUtils.js · password.js (NEW) · paths.js (NEW) · sendOtp.js
├── logs/                            # OTP log (demo – no SMS gateway)
└── docs/  PROJECT_ANALYSIS.md · API_DOCUMENTATION.md
```

## 2. Technologies

| Area | Technology |
|---|---|
| Runtime | Node.js (tested on v22; works on v18+) |
| Framework | Express 4 |
| Database | **JSON files** in `models/` read/written with `fs` (no MongoDB / Mongoose) – kept as is |
| Auth | JWT (`jsonwebtoken`), 30-day tokens, `Authorization: Bearer <token>` |
| Passwords | `bcryptjs` (was installed but unused – now used) |
| Payments | Razorpay (`razorpay` SDK + HMAC signature verification) |
| Uploads | `multer` (disk storage, JPG/PNG, 5 MB) |
| OTP | Logged to `logs/otp_logs.txt` and console (no SMS provider) |
| Other | `cors`, `dotenv`, `nodemon` |

## 3. Existing API list (before transformation)

| Prefix | Endpoints |
|---|---|
| `/vendor` | `POST registration`, `POST registrationOtpVerification`, `POST login`, `POST forgotPassword`, `POST forgotPasswordOTPVerification`, `GET getProfile`, `POST changePassword`, `POST updateAddress`, `GET vendorsDetails` |
| `/categories` | `GET all`, `POST addCategory`, `PUT updatecategories/:id`, `DELETE deletecategories/:id` |
| `/product` | `GET all`, `GET :id`, `GET category/:categoryId`, `GET availableForSell`, `POST addproducts`, `PUT updateproducts/:id`, `DELETE deleteproducts/:id`, `DELETE delete/:id` |
| `/cart` | `POST addProduct`, `POST updateCart`, `GET showMyCart`, `DELETE decreaseQTY/:id`, `DELETE increaseQTY/:id`, `DELETE removeProduct/:id` |
| `/order` | `POST create`, `GET myOrderList`, `POST updateOrderStatus`, `GET allOrders`, `GET cancelledOrders`, `GET getProductWiseOrderQuantity` |
| `/paymentEntry` | `GET getPayment`, `POST create-order`, `POST verify-signature`, `GET getAllPaymentsForAdmin` |
| `/salesman` | `GET getAllActiveSalesman`, `POST addSalesman`, `DELETE removeSalesman/:id` |
| `/deliveryBoy` | `POST login`, `GET getMyProfile`, `GET dashboard`, `GET getMyOrderlist`, `PATCH markAsDelivered/:id`, `GET getalldeliveryBoys`, `POST updateDeliveryBoyStatus`, `GET getactivedeliveryboys`, `POST assignDeliveryBoy` |
| `/admin` | `POST login` |

All of these still exist after the transformation (see API_DOCUMENTATION.md).

## 4. Data models (JSON files) and relationships

| File | Purpose | Key fields |
|---|---|---|
| `users.json` | Customers (named "vendor" in code) | `id`, `mobile` (unique, used in JWT), `password` (now bcrypt), address fields, order counters, **`skinProfile` (new)** |
| `categories.json` | Categories | `id` (number), `name`, `total_products`, `img` |
| `products.json` | Products | `_id` (string), `categories_id` → categories.id, `availablePackSizes[]`, images, **beauty fields (new)** |
| `cart.json` | One cart per user | `mobile` → users.mobile, `productlist[]` (snapshot of product/size/price) |
| `orders.json` | Orders | `id`/`challanNo`, `mobile`, `products[]` (cart snapshot), `status`, `vendorsData` (address snapshot), `paymentOrderId`, `deliveryBoy` |
| `payment.json` | One payment entry per order | `orderId` → orders.id, `mobile`, `status`, `amount`, `paymentOrderId` (Razorpay) |
| `cancelled_orders.json` | Copy of cancelled orders | as orders |
| `admin.json`, `deliveryBoy.json`, `salesman.json` | Staff accounts | |
| `wishlist.json` **(new)** | `{ mobile, items: [{ productId, addedAt }] }` | |
| `reviews.json` **(new)** | `{ id, productId, mobile, userName, rating, comment }` | |

```text
users (mobile) ──< cart (mobile)
users (mobile) ──< orders (mobile) ──1 payment (orderId)
categories (id) ──< products (categories_id)
products (_id) ──< cart lines / order lines / wishlist items / reviews (productId)
```

## 5. Authentication flow

```text
POST /vendor/registration   → user saved (verified:false), OTP written to logs/otp_logs.txt
POST /vendor/registrationOtpVerification { mobile, otp } → verified:true
POST /vendor/login { mobile, password } → JWT { mobile, id } (30 days)
Protected API → header "Authorization: Bearer <token>" → authMiddleware → req.user
```
Admin tokens carry `role: "admin"` and are checked by `adminAuthMiddleware`.

## 6. Product flow

```text
GET /categories/all → GET /product/category/:id?keyword=  (also GET /product/all?filters)
→ GET /product/:id → POST /cart/addProduct {productId,sizeId} → GET /cart/showMyCart
→ POST /order/create {remark} → admin sets "PendingPayment"
→ POST /paymentEntry/create-order → Razorpay checkout → POST /paymentEntry/verify-signature → "Paid"
→ admin assigns delivery boy ("out of delivery") → delivery boy marks "Delivered"
```

## 7. GlowWise changes

### Bugs fixed (found during analysis)
1. **Cart affected the wrong user** – update / increase / decrease / remove used `cartData[0]`
   (the first user's cart). Now the logged-in user's cart is used.
2. `GET /product/:id` compared `p.id` (doesn't exist) → always 404. Now uses `_id`.
3. `GET /product/availableForSell` was unreachable (declared after `/:id`).
4. Order keyword search crashed (`order.orderId` undefined) in user, admin and cancelled lists.
5. Order product lines returned the cart-line id as `productId`.
6. Category delete/edit looked for images in a non-existent `/public` folder.
7. New product / category / user ids could collide after deletions (`length + 1`).

### Security fixes
- Passwords hashed with bcrypt; old plain-text passwords keep working and are **upgraded
  automatically** at the next login (users, admins, delivery boys).
- **Hardcoded Razorpay secret removed** from `paymentController.js`; the secret is read only
  from `RAZORPAY_KEY_SECRET` (the old code also read a wrongly named variable).
- Razorpay amount now comes from the stored payment entry, not from the client.
- Signature check uses a timing-safe comparison and verifies the payment belongs to the caller.
- `/vendor/vendorsDetails` and delivery-boy listings no longer return passwords / OTPs.
- `server.js` no longer prints `JWT_SECRET`; startup fails clearly if it is missing.
- `.env` removed from the package; `.env.example` + `.gitignore` added.
- `DELETE /product/delete/:id` now requires the admin token (it allowed anyone to delete).

### Files modified
`app.js`, `server.js`, `package.json`, all controllers except `salesmanController.js`,
`routes/productRoutes.js`, `cartRoutes.js`, `orderRoutes.js`, `vendorRoutes.js`,
`middlewares/authMiddleware.js`, `adminAuthMiddleware.js`, `errorMiddleware.js`, `utils/fileUtils.js`.

### Files created
`constants/glowwise.js`, `services/*`, `controllers/wishlist|review|recommendation|skinAnalysisController.js`,
matching routes, `utils/password.js`, `utils/paths.js`, `seed/*`, `docs/*`, `.env.example`, `.gitignore`,
`models/wishlist.json`, `models/reviews.json`.

### Files removed
Empty stubs (`config/*.js`, `services/*Service.js` placeholders, `utils/generateToken.js`,
`utils/validateRequest.js`), all food images, `.env`.

### Unchanged
`salesmanController.js`, `salesmanRoutes.js`, `deliveryBoyRoutes.js`, `adminRoutes.js`,
`paymentRoutes.js`, `categoriesRoutes.js`, upload middlewares, `utils/sendOtp.js`.

### Database (JSON) changes – all additive
- Products gain: `brand`, `subcategory`, `rating`, `reviewCount`, `stock`, `keyIngredients`,
  `benefits`, `howToUse`, `skinTypes`, `skinConcerns`, `createdAt`, `updatedAt`
  (plus `baseRating`/`baseReviewCount` for demo ratings). Existing fields are untouched.
- Pricing re-uses the existing pack structure:
  `priceForRetailer` = **MRP**, `priceForWholesaler` = **GlowWise selling price**.
  Every customer now pays the selling price (the food app charged wholesalers and retailers
  differently based on the `salesman` field).
- Users gain `skinProfile` and optional `email`.

### API changes
- **No breaking changes** for the Flutter app – every endpoint, method and response shape it
  uses is preserved.
- Non-breaking behaviour changes: `/product/category/:id` returns `200` with `[]` when nothing
  matches (was `404`); `/product/all` returns `200` (was `201`); responses contain extra fields.
- New endpoints: wishlist, reviews, skin profile, profile update, recommendations,
  skin-analysis status, order details, order statuses, product filters, cart clear.

### Seed data
All food categories/products/images replaced by 9 beauty categories and 23 beauty products
with placeholder images. Orders, carts and payments containing food items were cleared.
User/admin/staff accounts were kept.

### Admin routes – now protected
The GlowWise Admin app sends the admin token on every call, so the previously open admin
routes now require `verifyAdminToken` (see API_DOCUMENTATION.md → "Admin routes are now protected").

### (Historical note) Before the admin app was updated
`/order/updateOrderStatus`, `/order/allOrders`, `/product/addproducts`, `/categories/addCategory`,
`/salesman/*` and `/paymentEntry/getAllPaymentsForAdmin` were **unprotected** in the original
project and remain so, because the existing admin panel may call them without a token.
Add `verifyAdminToken` to these routes once the admin panel sends its token – until then any
logged-out user could, for example, change an order's status.
