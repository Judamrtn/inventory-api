const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// ====== DB CONNECTION ======
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.connect((err, client, release) => {
  if (err) return console.error("❌ DB connection error", err.stack);
  client.query("SELECT NOW()", (err, result) => {
    release();
    if (err) return console.error("❌ Test query error", err.stack);
    console.log("✅ Connected to DB at", result.rows[0].now);
  });
});

// ====== AUTH MIDDLEWARE ======
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// ====== AUTH ROUTES ======
app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userExists = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: "User may already exist" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query("INSERT INTO users (username, password) VALUES ($1, $2)", [username, hashedPassword]);

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Registration failed", details: String(err) });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: "Invalid username or password" });

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(400).json({ error: "Invalid username or password" });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({ message: "Login successful", token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed", details: String(err) });
  }
});

// ====== INVENTORY ROUTES ======
app.post("/api/inventory", authenticateToken, async (req, res) => {
  try {
    const { item_name, category, quantity, unit_price } = req.body;
    const user_id = req.user.id;

    await pool.query(
      "INSERT INTO inventory (item_name, category, quantity, unit_price, user_id) VALUES ($1, $2, $3, $4, $5)",
      [item_name, category, quantity, unit_price, user_id]
    );

    res.status(201).json({ message: "Item added successfully" });
  } catch (err) {
    console.error("Add item error:", err);
    res.status(500).json({ error: "Failed to add item" });
  }
});

app.get("/api/inventory", authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;
    const result = await pool.query("SELECT * FROM inventory WHERE user_id = $1 ORDER BY item_id DESC", [user_id]);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch items error:", err);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

app.get("/api/inventory/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const userResult = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user_id = userResult.rows[0].id;
    const result = await pool.query(`
      SELECT i.*, u.username
      FROM inventory i
      JOIN users u ON i.user_id = u.id
      WHERE i.user_id = $1
      ORDER BY i.item_id DESC
    `, [user_id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "No items found for this user." });
    }

    res.json(result.rows);
  } catch (err) {
    console.error("Fetch items by username error:", err);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

app.put("/api/inventory/:id", authenticateToken, async (req, res) => {
  try {
    const { item_name, category, quantity, unit_price } = req.body;
    const { id } = req.params;
    const user_id = req.user.id;

    const result = await pool.query(
      "UPDATE inventory SET item_name = $1, category = $2, quantity = $3, unit_price = $4 WHERE item_id = $5 AND user_id = $6",
      [item_name, category, quantity, unit_price, id, user_id]
    );

    if (result.rowCount === 0) {
      return res.status(403).json({ error: "Item not found or not authorized" });
    }

    res.json({ message: "Item updated successfully" });
  } catch (err) {
    console.error("Update item error:", err);
    res.status(500).json({ error: "Failed to update item" });
  }
});

app.delete("/api/inventory/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const result = await pool.query("DELETE FROM inventory WHERE item_id = $1 AND user_id = $2", [id, user_id]);

    if (result.rowCount === 0) {
      return res.status(403).json({ error: "Item not found or not authorized" });
    }

    res.json({ message: "Item deleted successfully" });
  } catch (err) {
    console.error("Delete item error:", err);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// ====== SERVER ======
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
