const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import database connection
const { connectDB } = require('./database');

// Import routes
const rtoRoutes = require('../routes/rtoRoutes');
const authRoutes = require('../routes/authRoutes');
const complaintRoutes = require('../routes/complaintRoutes');

const app = express();
const PORT = process.env.PORT || 5003;

// Connect to database before starting server
let dbConnected = false;

// Create uploads directory if it doesn't exist
const fs = require('fs');
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`📁 Created uploads directory: ${uploadsDir}`);
} else {
  console.log(`📁 Uploads directory exists: ${uploadsDir}`);
}

// Ensure proper permissions on uploads directory
try {
  fs.chmodSync(uploadsDir, 0o755);
  console.log(`🔐 Set permissions on uploads directory: ${uploadsDir}`);
} catch (permError) {
  console.warn(
    `⚠️ Could not set permissions on uploads directory: ${permError.message}`,
  );
}

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'RTO Server is running!' });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    const { sequelize } = require('./database');
    await sequelize.authenticate();
    res.json({ 
      status: 'OK', 
      database: 'connected',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'ERROR', 
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString() 
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/rto', rtoRoutes);
app.use('/api/complaints', complaintRoutes);

// Start server only after database connection
async function startServer() {
  const maxRetries = 5;
  let retryCount = 0;
  
  async function attemptConnection() {
    try {
      await connectDB();
      dbConnected = true;
      console.log("✅ Database connection established");
      
      app.listen(PORT, () => {
        console.log(`✅ Server is running on port ${PORT}`);
        console.log(`✅ Backend API: http://localhost:${PORT}`);
      });
    } catch (error) {
      retryCount++;
      console.error(`❌ Database connection attempt ${retryCount}/${maxRetries} failed:`, error.message);
      
      if (retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Exponential backoff, max 30s
        console.log(`⏳ Retrying database connection in ${delay/1000}s...`);
        setTimeout(attemptConnection, delay);
      } else {
        console.error("❌ Max retries reached. Starting server without database connection.");
        console.error("⚠️  Server will retry connection on next request...");
        // Don't exit - let PM2 handle restarts
        // Start server anyway so health check can respond
        app.listen(PORT, () => {
          console.log(`⚠️  Server started on port ${PORT} but database connection failed`);
          console.log(`⚠️  API endpoints may not work until database is connected`);
          console.log(`⚠️  Check PM2 logs for details: pm2 logs rto-application`);
        });
      }
    }
  }
  
  attemptConnection();
}

startServer();

module.exports = app;
