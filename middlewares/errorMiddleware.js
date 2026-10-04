const multer = require("multer");

/** 404 for unknown routes (same JSON shape as the rest of the API). */
const notFound = (req, res) => {
  res.status(404).json({ status: 404, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

/** Global error handler. */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Upload errors (file too large, wrong type, …) are client errors
  if (err instanceof multer.MulterError || /files are allowed|Invalid file type/i.test(err.message || "")) {
    return res.status(400).json({ status: 400, message: err.message });
  }
  // Malformed JSON body
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ status: 400, message: "Invalid JSON body" });
  }

  console.error("Error:", err.stack || err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: statusCode,
    message: statusCode === 500 ? "Internal Server Error" : err.message,
    ...(process.env.NODE_ENV !== "production" && statusCode === 500 ? { error: err.message } : {}),
  });
};

module.exports = { notFound, errorHandler };
