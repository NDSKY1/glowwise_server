const fs = require("fs");

// ✅ Read JSON file safely (creates the file with [] if it is missing)
exports.readFileSafely = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, "[]", "utf8");
            return [];
        }

        const data = fs.readFileSync(filePath, "utf8");
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error(`❌ Error reading file ${filePath}:`, error);
        return [];
    }
};

// ✅ Write JSON file safely
exports.writeFileSafely = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    } catch (error) {
        console.error(`❌ Error writing file ${filePath}:`, error);
    }
};
