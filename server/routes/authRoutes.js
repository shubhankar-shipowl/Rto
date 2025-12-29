const express = require('express');
const router = express.Router();

// Lazy load User model to ensure database is connected
const getUserModel = () => {
  return require('../models/User');
};

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    // Get User model (lazy load)
    const User = getUserModel();

    // Find user in database
    const user = await User.findOne({
      where: { username: username },
    });

    if (!user) {
      console.log(`❌ Login failed: User '${username}' not found in database`);
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    // Compare password using bcrypt
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      console.log(`❌ Login failed: Invalid password for user '${username}'`);
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    console.log(`✅ Login successful for user: ${username} (${user.role})`);

    // Return user data (password is automatically excluded by toJSON method)
    res.json({
      success: true,
      message: 'Login successful',
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Logout endpoint (for future use with sessions)
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful',
  });
});

// Verify token endpoint (for future use with JWT)
router.get('/verify', (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
  });
});

module.exports = router;
