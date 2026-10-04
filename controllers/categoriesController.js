const fs = require("fs");
const path = require("path");
const { readFileSafely, writeFileSafely } = require("../utils/fileUtils");

const categoriesFilePath = path.join(__dirname, "../models/categories.json");
const productsFilePath = path.join(__dirname, "../models/products.json");
const { countProductsPerCategory } = require("../services/productService");

// Category images are stored in /categories_img (FIX: old code looked in /public)
const categoryImagePath = (img) => path.join(__dirname, "..", String(img || "").replace(/^\//, ""));

// GET /categories/all?keyword=something
const getAllCategories = (req, res) => {
    try {
        const { keyword } = req.query;
        // Live product counts so total_products is always accurate
        let categories = countProductsPerCategory(
            readFileSafely(productsFilePath),
            readFileSafely(categoriesFilePath)
        );

        if (keyword && keyword.trim() !== "") {
            const lowerKeyword = keyword.toLowerCase();
            categories = categories.filter(cat =>
                cat.name.toLowerCase().includes(lowerKeyword)
            );
        }

        res.status(200).json({
            status: 200,
            message: "Categories fetched successfully",
            data: categories
        });
    } catch (error) {
        console.error("Error in getAllCategories:", error);
        res.status(500).json({ status: 500, message: "Internal server error" });
    }
};


const addCategory = (req, res) => {
  try {
    const { name } = req.body;
    const file = req.file;

    if (!name || !file) {
      return res.status(400).json({ status: 400, message: "Name and image file are required" });
    }

    const categories = readFileSafely(categoriesFilePath);

    // Check for duplicate category
    const alreadyExists = categories.find(
      (cat) => cat.name.toLowerCase() === name.toLowerCase()
    );
    if (alreadyExists) {
      return res.status(409).json({ status: 409, message: "Category already exists" });
    }

    const newCategory = {
      id: categories.reduce((max, c) => Math.max(max, Number(c.id) || 0), 0) + 1,
      name: name,
      total_products: 0,
      img: `/categories_img/${file.filename}`
    };

    categories.push(newCategory);
    writeFileSafely(categoriesFilePath, categories);

    return res.status(201).json({
      status: 201,
      message: "Category added successfully",
      data: newCategory
    });
  } catch (error) {
    console.error("Error adding category:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};


// DELETE /categories/:id
const deleteCategory = (req, res) => {
  try {
    const { id } = req.params;

    let categories = readFileSafely(categoriesFilePath);

    const index = categories.findIndex(cat => cat.id == id);
    if (index === -1) {
      return res.status(404).json({ status: 404, message: "Category not found" });
    }

    // Optional: delete associated image file from disk
    const imagePath = categoryImagePath(categories[index].img);
    if (categories[index].img && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath); // delete image file
    }

    categories.splice(index, 1); // remove category from array
    writeFileSafely(categoriesFilePath, categories);

    res.status(200).json({
      status: 200,
      message: "Category deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ status: 500, message: "Internal server error" });
  }
};


const editCategory = (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const file = req.file;

    if (!id) {
      return res.status(400).json({ status: 400, message: "Category ID is required" });
    }

    let categories = readFileSafely(categoriesFilePath);

    const index = categories.findIndex(cat => cat.id == id);
    if (index === -1) {
      return res.status(404).json({ status: 404, message: "Category not found" });
    }

    // Check for duplicate name (excluding current item)
    const nameExists = categories.some(
      (cat, i) =>
        i !== index &&
        cat.name.toLowerCase() === name?.toLowerCase()
    );
    if (nameExists) {
      return res.status(409).json({ status: 409, message: "Category name already exists" });
    }

    // Update name if provided
    if (name) {
      categories[index].name = name;
    }

    // Update image if a new one is uploaded
    if (file) {
      const oldImagePath = categoryImagePath(categories[index].img);
      if (categories[index].img && fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath); // delete old image
      }

      categories[index].img = `/categories_img/${file.filename}`;
    }

    writeFileSafely(categoriesFilePath, categories);

    return res.status(200).json({
      status: 200,
      message: "Category updated successfully",
      data: categories[index],
    });
  } catch (error) {
    console.error("Error editing category:", error);
    return res.status(500).json({ status: 500, message: "Internal Server Error" });
  }
};






module.exports = {
    getAllCategories,
    addCategory,
    deleteCategory,
    editCategory 
};
