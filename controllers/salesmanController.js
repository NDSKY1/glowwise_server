const fs = require("fs");
const path = require("path");

const salesmanFilePath = path.join(__dirname, "../models/salesman.json"); 

// Helper function to read salesman.json
const readSalesmen = () => {
    try {
        if (!fs.existsSync(salesmanFilePath)) {
            console.log("jgsdss");
            
            // Create the file with empty array if it doesn't exist
            fs.writeFileSync(salesmanFilePath, "[]", "utf8");
        }
        
        // Read the file content
        const fileContent = fs.readFileSync(salesmanFilePath, "utf8");
        
        // Log the file content to check if it is being read correctly
        console.log("Salesmen file content:", fileContent);

        // Parse and return the salesmen data
        return JSON.parse(fileContent || "[]");
    } catch (error) {
        console.error("Error reading salesmen file:", error);
        return [];
    }
};

// Fetch all active salesmen
const getAllActiveSalesmen = (req, res) => {
    try {
        let salesmen = readSalesmen().filter(salesman => salesman.status === true);

        res.status(200).json({
            status: 200,
            message: "Active salesmen fetched successfully 1",
            data: salesmen
        });
    } catch (error) {
        console.error("Error fetching salesmen:", error);
        res.status(500).json({ status: 500, message: "Internal server error" });
    }
};

// Add a new salesman
const addSalesman = (req, res) => {
    try {
        let salesmen = readSalesmen();
        let newSalesman = {
            id: Date.now().toString(),
            name: req.body.name,
            mobile: req.body.mobile,
            email: req.body.email || "",
            status: true, // Active by default
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        salesmen.push(newSalesman);
        fs.writeFileSync(salesmanFilePath, JSON.stringify(salesmen, null, 2));

        res.status(201).json({
            status: 201,
            message: "Salesman added successfully",
            data: newSalesman
        });
    } catch (error) {
        console.error("Error adding salesman:", error);
        res.status(500).json({ status: 500, message: "Internal server error" });
    }
};

// Remove a salesman
const removeSalesman = (req, res) => {
    try {
        let salesmen = readSalesmen();
        let updatedSalesmen = salesmen.filter(salesman => salesman.id !== req.params.id);

        if (salesmen.length === updatedSalesmen.length) {
            return res.status(404).json({ status: 404, message: "Salesman not found" });
        }

        fs.writeFileSync(salesmanFilePath, JSON.stringify(updatedSalesmen, null, 2));

        res.status(200).json({ status: 200, message: "Salesman removed successfully" });
    } catch (error) {
        console.error("Error removing salesman:", error);
        res.status(500).json({ status: 500, message: "Internal server error" });
    }
};

module.exports = { getAllActiveSalesmen, addSalesman, removeSalesman };
