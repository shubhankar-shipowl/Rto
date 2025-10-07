const { Sequelize } = require("sequelize");

// Create Sequelize instance
const sequelize = new Sequelize(
  process.env.DB_NAME || "rto_db",
  process.env.DB_USER || "rto",
  process.env.DB_PASSWORD || "Kalbazaar@177",
  {
    host: process.env.DB_HOST || "31.97.61.5",
    port: process.env.DB_PORT || 3306,
    dialect: "mysql",
    pool: {
      max: parseInt(process.env.DB_MAX_CONNECTIONS) || 10,
      min: parseInt(process.env.DB_MIN_CONNECTIONS) || 2,
      idle: parseInt(process.env.DB_IDLE_TIMEOUT) || 10000,
      acquire: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 30000,
      evict: parseInt(process.env.DB_DESTROY_TIMEOUT) || 5000,
    },
    dialectOptions: {
      connectTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 10000,
    },
    retry: {
      match: [
        /ETIMEDOUT/,
        /EHOSTUNREACH/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /ESOCKETTIMEDOUT/,
        /EHOSTUNREACH/,
        /EPIPE/,
        /EAI_AGAIN/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
      ],
      max: 3,
    },
    logging: process.env.NODE_ENV === "development" ? console.log : false,
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("MySQL database connected successfully");

    // Sync database (create tables if they don't exist)
    await sequelize.sync({ alter: true });
    console.log("Database synchronized");

    return sequelize;
  } catch (error) {
    console.error("Database connection error:", error);
    process.exit(1);
  }
};

module.exports = { connectDB, sequelize };
