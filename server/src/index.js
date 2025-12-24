const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Load environment variables - load server/.env first, then root .env to override
// This ensures root .env (new credentials) takes precedence
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // Load server/.env first
require('dotenv').config({ path: path.join(__dirname, '../../.env'), override: true }); // Root .env overrides

// Import database connection
const { connectDB, closeDB } = require('./database');

// Import cron jobs
const { startCronJobs, stopCronJobs } = require('./cronJobs');

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

// Store server instance and cron jobs for graceful shutdown
let server = null;
let cronJobs = null;

// Start server only after database connection
async function startServer() {
  const maxRetries = 5;
  let retryCount = 0;
  
  async function attemptConnection() {
    try {
      await connectDB();
      dbConnected = true;
      console.log("✅ Database connection established");
      
      // Start cron jobs after database connection
      cronJobs = startCronJobs();
      
      server = app.listen(PORT, () => {
        console.log(`✅ Server is running on port ${PORT}`);
        console.log(`✅ Backend API: http://localhost:${PORT}`);
        console.log(`✅ Database connection pool is active and ready`);
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
        server = app.listen(PORT, () => {
          console.log(`⚠️  Server started on port ${PORT} but database connection failed`);
          console.log(`⚠️  API endpoints may not work until database is connected`);
          console.log(`⚠️  Check PM2 logs for details: pm2 logs rto-application`);
        });
      }
    }
  }
  
  attemptConnection();
}

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  
  // Stop cron jobs first
  if (cronJobs) {
    stopCronJobs(cronJobs);
  }
  
  if (server) {
    server.close(async () => {
      console.log('✅ HTTP server closed');
      try {
        await closeDB();
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error.message);
        process.exit(1);
      }
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      console.error('⚠️  Forcing shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    await closeDB();
    process.exit(0);
  }
};

// Handle process termination signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('❌ Uncaught Exception:', error);
  await gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  await gracefulShutdown('unhandledRejection');
});

startServer();

module.exports = app;
