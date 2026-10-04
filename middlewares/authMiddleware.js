const jwt = require("jsonwebtoken");

/** Verifies the customer JWT sent as "Authorization: Bearer <token>". */
const verifyToken = (req, res, next) => {
    const header = req.headers["authorization"];

    if (!header) {
        return res.status(401).json({ status: 401, message: "Access denied. No token provided." });
    }

    const token = header.startsWith("Bearer ") ? header.slice(7) : header;

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({ status: 401, message: "Invalid or expired token." });
    }
};

module.exports = verifyToken;
