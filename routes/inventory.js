const express = require("express");
const pool = require("../db");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

// All routes require auth
router.use(authenticateToken);

// Add item
router.post("/", async (req, res) => {
  const { item_name, category, quantity, unit_price } = req.body;
  await pool.query(
    "INSERT INTO inventory (item_name, category, quantity, unit_price) VALUES ($1, $2, $3, $4)",
    [item_name, category, quantity, unit_price]
  );
  res.json({ message: "Item added" });
});

// View items
router.get("/", async (req, res) => {
  const result = await pool.query("SELECT * FROM inventory");
  res.json(result.rows);
});

// Update item
router.put("/:id", async (req, res) => {
  const { item_name, category, quantity, unit_price } = req.body;
  const { id } = req.params;
  await pool.query(
    "UPDATE inventory SET item_name=$1, category=$2, quantity=$3, unit_price=$4 WHERE item_id=$5",
    [item_name, category, quantity, unit_price, id]
  );
  res.json({ message: "Item updated" });
});

// Delete item
router.delete("/:id", async (req, res) => {
  await pool.query("DELETE FROM inventory WHERE item_id=$1", [req.params.id]);
  res.json({ message: "Item deleted" });
});

module.exports = router;
