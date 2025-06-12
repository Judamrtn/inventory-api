const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// --- DB Connection ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// --- Middleware: Authenticate JWT ---
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

// --- Auth Routes ---
app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userExists = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query("INSERT INTO users (username, password) VALUES ($1, $2)", [username, hashedPassword]);
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: "1d" });
    res.json({ message: "Login successful", token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// --- Inventory Routes ---
app.post("/api/inventory", authenticateToken, async (req, res) => {
  const { item_name, category, quantity, unit_price } = req.body;
  try {
    await pool.query(
      "INSERT INTO inventory (item_name, category, quantity, unit_price, user_id) VALUES ($1, $2, $3, $4, $5)",
      [item_name, category, quantity, unit_price, req.user.id]
    );
    res.status(201).json({ message: "Item added" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add item" });
  }
});

app.get("/api/inventory", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM inventory WHERE user_id = $1 ORDER BY item_id DESC", [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

app.put("/api/inventory/:id", authenticateToken, async (req, res) => {
  const { item_name, category, quantity, unit_price } = req.body;
  const { id } = req.params;
  try {
    const result = await pool.query(
      "UPDATE inventory SET item_name=$1, category=$2, quantity=$3, unit_price=$4 WHERE item_id=$5 AND user_id=$6",
      [item_name, category, quantity, unit_price, id, req.user.id]
    );
    if (result.rowCount === 0) return res.status(403).json({ error: "Not authorized or item not found" });
    res.json({ message: "Item updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Update failed" });
  }
});

app.delete("/api/inventory/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM inventory WHERE item_id = $1 AND user_id = $2",
      [id, req.user.id]
    );
    if (result.rowCount === 0) return res.status(403).json({ error: "Not authorized or item not found" });
    res.json({ message: "Item deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// --- Start Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
