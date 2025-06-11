const express = require("express");
const pool = require("../db");
const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");

// ✅ Add item (linked to logged-in user)
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { item_name, category, quantity, unit_price } = req.body;
    const user_id = req.user.id;

    await pool.query(
      "INSERT INTO inventory (item_name, category, quantity, unit_price, user_id) VALUES ($1, $2, $3, $4, $5)",
      [item_name, category, quantity, unit_price, user_id]
    );

    res.status(201).json({ message: "Item added" });
  } catch (err) {
    console.error("Add item error:", err);
    res.status(500).json({ error: "Failed to add item" });
  }
});

// ✅ View items (only those belonging to logged-in user)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const result = await pool.query("SELECT * FROM inventory WHERE user_id = $1", [user_id]);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch items error:", err);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

// ✅ View items by username (public view)
router.get("/:username", async (req, res) => {
  try {
    const { username } = req.params;

    // Assuming you have a way to map username to user_id
    const userResult = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
    
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user_id = userResult.rows[0].id;
    const result = await pool.query("SELECT * FROM inventory WHERE user_id = $1", [user_id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "No items found for this user." });
    }

    res.json(result.rows);
  } catch (err) {
    console.error("Fetch items by username error:", err);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

// ✅ Update item (only if owned by user)
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { item_name, category, quantity, unit_price } = req.body;
    const { id } = req.params;
    const user_id = req.user.id;

    const result = await pool.query(
      "UPDATE inventory SET item_name = $1, category = $2, quantity = $3, unit_price = $4 WHERE item_id = $5 AND user_id = $6",
      [item_name, category, quantity, unit_price, id, user_id]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ error: "Not allowed or item not found" });
    }

    res.json({ message: "Item updated" });
  } catch (err) {
    console.error("Update item error:", err);
    res.status(500).json({ error: "Failed to update item" });
  }
});

// ✅ Delete item (only if owned by user)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const result = await pool.query(
      "DELETE FROM inventory WHERE item_id = $1 AND user_id = $2",
      [id, user_id]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ error: "Not allowed or item not found" });
    }

    res.json({ message: "Item deleted" });
  } catch (err) {
    console.error("Delete item error:", err);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

module.exports = router;
