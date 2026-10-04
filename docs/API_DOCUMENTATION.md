# GlowWise API Documentation

Base URL: `http://localhost:5005` (or your deployed URL).
Protected routes need `Authorization: Bearer <token>`.

Response format (unchanged from the original project):

```json
{ "status": 200, "message": "Products fetched successfully", "data": [] }
```

Payment endpoints keep their original `{ "success": true, ... }` format.

Legend: 🔓 public · 🔐 customer token · 🛡️ admin token

> The Flutter API client supports GET, POST and DELETE only, so update actions use **POST**
> (same convention as the original `/cart/updateCart`).

---

## Authentication & profile – `/vendor`

| Method | Endpoint | Auth | Body / notes |
|---|---|---|---|
| POST | `/vendor/registration` | 🔓 | `vendorName, shopName, mobile, password, gstNo, shopNo, address, landmark, city, state, pinCode, salesman` → OTP written to `logs/otp_logs.txt` |
| POST | `/vendor/registrationOtpVerification` | 🔓 | `mobile, otp` |
| POST | `/vendor/login` | 🔓 | `mobile, password` → `data.token` |
| POST | `/vendor/forgotPassword` | 🔓 | `mobile` |
| POST | `/vendor/forgotPasswordOTPVerification` | 🔓 | `mobile, otp, password` |
| GET | `/vendor/getProfile` | 🔐 | profile, address (`shipment`), `skinProfile`, `orderData` counters |
| POST | `/vendor/updateProfile` | 🔐 | `vendorName?, shopName?, gstNo?, email?` **(new)** |
| POST | `/vendor/changePassword` | 🔐 | `oldPassword, newPassword` |
| POST | `/vendor/updateAddress` | 🔐 | `shopNo, address, landmark, city, state, pinCode` |
| GET | `/vendor/skinProfile` | 🔐 | **(new)** returns profile + allowed options |
| POST | `/vendor/updateSkinProfile` | 🔐 | **(new)** `skinType, skinConcerns[], preferredCategories[], beautyPreferences[]` |
| GET | `/vendor/vendorsDetails` | 🔓 | admin listing (passwords/OTPs no longer returned) |

Skin profile example:
```json
{ "skinType": "Oily", "skinConcerns": ["Acne", "Dark Spots"], "preferredCategories": ["Skincare"] }
```
Allowed skin types: Dry, Oily, Combination, Normal, Sensitive.
Unknown concerns/categories are ignored; an unknown skin type returns 400.

## Categories – `/categories`

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/categories/all?keyword=` | 🔓 | `[{ id, name, total_products, img }]` |
| POST | `/categories/addCategory` | 🔓* | multipart `name`, `img` |
| PUT | `/categories/updatecategories/:id` | 🛡️ | multipart `name?`, `img?` |
| DELETE | `/categories/deletecategories/:id` | 🛡️ | |

Seeded: Skincare, Makeup, Haircare, Body Care, Fragrance, Lip Care, Face Care, Sun Care, Wellness.

## Products – `/product`

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/product/all` | 🔓 | search + filters (below); add `page` & `limit` for pagination |
| GET | `/product/category/:categoryId?keyword=` | 🔓 | used by the app; same filters; `200` + `[]` when empty |
| GET | `/product/availableForSell` | 🔓 | active products, same filters |
| GET | `/product/filters` | 🔓 | **(new)** brands, subcategories, skin types, concerns, price range |
| GET | `/product/:id` | 🔓 | single product |
| POST | `/product/addproducts` | 🔓* | multipart (see fields below) |
| PUT | `/product/updateproducts/:id` | 🛡️ | multipart, any field |
| DELETE | `/product/deleteproducts/:id` | 🛡️ | |
| DELETE | `/product/delete/:id` | 🛡️ | now admin-only |

\* unprotected as in the original project – see PROJECT_ANALYSIS.md.

**Search & filter query parameters** (all optional, combine freely):

| Param | Example | Matches |
|---|---|---|
| `keyword` | `vitamin c serum` | name, brand, category, subcategory, skin types, concerns, ingredients (accent-insensitive, every word must match, best matches first) |
| `categoryId` | `1` or `1,8` | category id(s) |
| `category` | `Skincare` | category name(s) |
| `subcategory` | `Serum` | |
| `brand` | `SunVeil` | |
| `skinType` | `Oily` or `Oily,Combination` | any of |
| `skinConcern` | `Acne,Dullness` | any of |
| `minPrice` / `maxPrice` | `500` / `1000` | selling price |
| `minRating` | `4` | |
| `inStock` | `true` | |
| `sort` | `relevance` · `price_asc` · `price_desc` · `rating` · `discount` · `newest` | |

**Product object**

```json
{
  "_id": "1",
  "categories_id": "1",
  "productName": "Vitamin C 10% Face Serum",
  "brand": "Lumière Lab",
  "subcategory": "Serum",
  "productDescription": "<p>…</p>",
  "productMainImage": "uploads/lumiere-lab-vitamin-c-10-face-serum.jpg",
  "productOtherImages": [{ "_id": "img1", "url": "uploads/…jpg" }],
  "availablePackSizes": [{ "_id": "p1", "size": "30ml", "priceForWholesaler": 599, "priceForRetailer": 699 }],
  "status": "active",
  "rating": 4.6, "reviewCount": 1284, "stock": 120,
  "keyIngredients": ["Vitamin C (Ethyl Ascorbic Acid)", "Hyaluronic Acid"],
  "benefits": ["Brightens dull skin"],
  "howToUse": "Apply 3–4 drops…",
  "skinTypes": ["Normal", "Oily", "Combination"],
  "skinConcerns": ["Dullness", "Pigmentation", "Uneven Skin Tone"],
  "categoryName": "Skincare", "discountPercentage": 14, "inStock": true
}
```
`priceForRetailer` = MRP, `priceForWholesaler` = selling price (what the customer pays).
`categoryName`, `discountPercentage`, `inStock` are computed in responses.

**Add/update product fields (multipart):** `productName`, `productDescription`, `categories_id`,
`status`, `slug`, `productMainImage` (file), `productOtherImages` (files),
`availablePackSizes` (JSON: `[{"size":"30ml","price":699,"discountPrice":599}]` – the old
`wholesalerPrice`/`retailerPrice` keys also work), `brand`, `subcategory`, `stock`,
`keyIngredients`, `benefits`, `skinTypes`, `skinConcerns` (JSON array or comma list), `howToUse`.

## Cart – `/cart` 🔐

| Method | Endpoint | Body / notes |
|---|---|---|
| POST | `/cart/addProduct` | `productId, sizeId` (adds 1; checks stock) |
| POST | `/cart/updateCart` | `productId, sizeId, qty` (sets quantity) |
| GET | `/cart/showMyCart` | `{ total, productlist[], summary }` |
| DELETE | `/cart/increaseQTY/:lineId` | +1 |
| DELETE | `/cart/decreaseQTY/:lineId` | −1 (removes at 0) |
| DELETE | `/cart/removeProduct/:lineId` | remove line |
| DELETE | `/cart/clear` | **(new)** empty cart |

`summary` (new, additive): `{ itemCount, subtotal (MRP), discount, deliveryCharge, total }`.

## Orders – `/order`

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| POST | `/order/create` | 🔐 | `remark?` – creates order from cart, reserves stock, creates payment entry |
| GET | `/order/myOrderList?page=&limit=&keyword=&status=` | 🔐 | newest first, includes `statusLabel` |
| GET | `/order/details/:id` | 🔐 | **(new)** products, address, payment info |
| GET | `/order/statuses` | 🔓 | **(new)** status values + labels |
| POST | `/order/updateOrderStatus` | 🔓* | `orderId, status` (cancel restores stock) |
| GET | `/order/allOrders` | 🔓* | admin listing |
| GET | `/order/cancelledOrders` | 🛡️ | |
| GET | `/order/getProductWiseOrderQuantity?productId=` | 🔓* | units sold & revenue per product |

Order statuses (stored value → label): `Pending` → Order Placed · `PendingPayment` → Awaiting Payment ·
`Paid` → Confirmed · `Packed` · `Shipped` · `out of delivery` → Out for Delivery · `Delivered` · `Cancelled`.

## Payments (Razorpay) – `/paymentEntry`

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/paymentEntry/getPayment?page=&limit=&keyword=&status=` | 🔐 | user's payment entries |
| POST | `/paymentEntry/create-order` | 🔐 | `{ amount, paymentEntryId? }` → `{ success, order, key, amount, orderId }`; amount always taken from the server |
| POST | `/paymentEntry/verify-signature` | 🔐 | `razorpay_order_id, razorpay_payment_id, razorpay_signature` → order becomes `Paid` |
| GET | `/paymentEntry/getAllPaymentsForAdmin` | 🔓* | |

## Wishlist – `/wishlist` 🔐 (new)

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/wishlist/myWishlist` | list of product objects |
| POST | `/wishlist/add` | `productId` |
| DELETE | `/wishlist/remove/:productId` | |
| GET | `/wishlist/status/:productId` | `{ productId, isWishlisted }` |

## Reviews – `/review` (new)

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/review/product/:productId?page=&limit=` | 🔓 | `{ rating, reviewCount, distribution, docs[] }` |
| POST | `/review/add` | 🔐 | `productId, rating (1–5), comment?` – one review per user per product |
| POST | `/review/update/:id` | 🔐 | own review only |
| DELETE | `/review/delete/:id` | 🔐 | own review (or admin) |

## Recommendations – `/recommendation` 🔐 (new)

`GET /recommendation/forMe?limit=10&categoryId=` – **rule-based (not AI)**. Uses the skin
profile, preferred categories, past orders and wishlist. `meta` explains the result:

```json
{
  "status": 200,
  "data": [ { "...product", "recommendationScore": 10.9, "reasons": ["Suits Oily skin", "Targets Acne"] } ],
  "meta": {
    "engine": "rule-based-v1",
    "personalised": true,
    "basedOn": { "skinType": "Oily", "skinConcerns": ["Acne"], "preferredCategories": ["Skincare"] },
    "suggestedRoutine": ["Gel Cleanser", "Niacinamide Serum", "Lightweight Moisturizer", "Oil-Control Sunscreen"]
  }
}
```

## AI skin analysis – `/skinAnalysis` (future scope)

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | `/skinAnalysis/status` | 🔓 | `{ available: false, detectableSkinTypes, detectableConcerns }` |
| POST | `/skinAnalysis/analyze` | 🔐 | returns **501 Not Implemented** until a real AI provider is registered |

No analysis is performed and no results are simulated. See `services/skinAnalysisService.js`
for the integration contract (expected output: `{ skinType, concerns[], confidence }`).

## Staff routes (unchanged)

- `/admin/login` – `mobile, password`
- `/salesman/getAllActiveSalesman`, `/salesman/addSalesman`, `/salesman/removeSalesman/:id`
- `/deliveryBoy/login`, `getMyProfile`, `dashboard`, `getMyOrderlist`, `PATCH markAsDelivered/:id`,
  `getalldeliveryBoys` 🛡️, `updateDeliveryBoyStatus` 🛡️, `getactivedeliveryboys`, `assignDeliveryBoy` 🛡️

## Static files

- `GET /uploads/<file>` – product images (stored as `uploads/<file>` in product data)
- `GET /categories_img/<file>` – category images (stored as `/categories_img/<file>`)

## Error responses

| Code | When |
|---|---|
| 400 | invalid input, upload error, invalid JSON, out of stock, invalid signature |
| 401 | missing / invalid token |
| 403 | admin-only route, not your review/payment |
| 404 | resource or route not found (`{ status: 404, message }`) |
| 409 | duplicate registration / duplicate review / duplicate category |
| 501 | AI skin analysis not available yet |
| 500 | unexpected server error |

---

## GlowWise Admin app endpoints (added for the admin app) 🛡️

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/admin/dashboard` | totals (customers, products, active products, orders, pending, revenue, AOV), orders by status, daily/weekly/monthly sales, top products, low stock, recent orders |
| GET | `/admin/skinInsights` | customer-declared skin type & concern distribution; `aiAvailable: false`, `totalAiAnalyses: 0` until AI is connected |
| GET | `/review/all?keyword=&rating=&page=&limit=` | all reviews with product name/brand/image |
| DELETE | `/review/admin/:id` | remove an inappropriate review (rating recalculated) |

`/order/allOrders` now also returns `customer { name, mobile, email }`, `deliveryAddress`,
`payment { status, type, amount, paymentId }` and `deliveryBoy` for each order.
`/vendor/vendorsDetails` now also returns `email`, `skinProfile`, `createdAt`, `totalOrders`, `totalSpent`.

### Admin routes are now protected
Because the GlowWise Admin app sends its token on every request (including image uploads),
these routes now require the **admin token**: `/order/updateOrderStatus`, `/order/allOrders`,
`/order/getProductWiseOrderQuantity`, `/product/addproducts`, `/categories/addCategory`,
`/paymentEntry/getAllPaymentsForAdmin`, `/vendor/vendorsDetails`.

### Fixes for the admin app
- `POST /deliveryBoy/assignDeliveryBoy` responses now include `status` (the app checks it; before, a
  successful assignment was shown as failed).
- `POST /admin/login` with wrong credentials returns `400 { status, message }` (was `401` without
  `status`, which the app displayed as "Invalid response format").
- Category add errors now include `status`.
