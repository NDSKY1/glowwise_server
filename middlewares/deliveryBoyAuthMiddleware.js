const jwt = require("jsonwebtoken");
require("dotenv").config();

const SECRET_KEY = process.env.JWT_SECRET;

const deliveryBoyAuthMiddleware = (req, res, next) => {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).json({ status: 401, message: "Unauthorized: No token provided" });
    }

    try {
        const decoded = jwt.verify(token.replace("Bearer ", ""), SECRET_KEY);
        req.user = decoded; // Attach user data to request object
        next();
    } catch (error) {
        return res.status(401).json({ status: 401, message: "Unauthorized: Invalid token" });
    }
};

module.exports = deliveryBoyAuthMiddleware;
