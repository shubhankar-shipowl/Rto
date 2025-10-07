const express = require("express");
const router = express.Router();

// Mock user database - replace with real database
const users = [
  {
    id: "1",
    username: "admin",
    password: "admin123", // In real app, this would be hashed
    name: "Administrator",
    role: "admin",
  },
  {
    id: "2",
    username: "user",
    password: "user123", // In real app, this would be hashed
    name: "Regular User",
    role: "user",
  },
];

// Login endpoint
router.post("/login", (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // Find user
    const user = users.find(
      (u) => u.username === username && u.password === password
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: "Login successful",
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Logout endpoint (for future use with sessions)
router.post("/logout", (req, res) => {
  res.json({
    success: true,
    message: "Logout successful",
  });
});

// Verify token endpoint (for future use with JWT)
router.get("/verify", (req, res) => {
  res.json({
    success: true,
    message: "Token is valid",
  });
});

module.exports = router;
