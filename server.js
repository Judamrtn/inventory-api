const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const inventoryRoutes = require("./routes/inventory");

const app = express();

app.use(cors());
app.use(express.json());

// ✅ Pass the router directly
app.use("/api/auth", authRoutes);
app.use("/api/inventory", inventoryRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
