const express = require("express");
const { getAllActiveSalesmen, addSalesman, removeSalesman } = require("../controllers/salesmanController");

const router = express.Router();

// Fetch all active salesmen
router.get("/getAllActiveSalesman", getAllActiveSalesmen);

// Add a new salesman
router.post("/addSalesman", addSalesman);

// Remove a salesman
router.delete("/removeSalesman/:id", removeSalesman);

module.exports = router;
