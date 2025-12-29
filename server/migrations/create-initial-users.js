const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), override: true });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { connectDB, sequelize } = require('../src/database');

async function createInitialUsers() {
  try {
    // Connect to database first (this will also load models)
    await connectDB();
    console.log('✅ Database connection established');
    
    // Import User model after database is connected
    const User = require('../models/User');

    // Ensure User table exists
    await User.sync({ alter: true });
    console.log('✅ User table synchronized');

    // Define initial users
    const initialUsers = [
      {
        username: 'admin',
        password: 'admin123',
        name: 'Administrator',
        role: 'admin',
      },
      {
        username: 'user',
        password: 'user123',
        name: 'Regular User',
        role: 'user',
      },
      {
        username: 'adarsh',
        password: 'Adarsh@22',
        name: 'Adarsh',
        role: 'user',
      },
    ];

    console.log('\n📝 Creating/updating initial users...\n');

    for (const userData of initialUsers) {
      // Check if user exists
      const [user, created] = await User.findOrCreate({
        where: { username: userData.username },
        defaults: {
          ...userData,
          // Password will be hashed automatically by beforeCreate hook
        },
      });

      if (!created) {
        // Update existing user (password will be hashed automatically by beforeUpdate hook)
        // Use set() and save() to trigger hooks, or update with raw password
        user.name = userData.name;
        user.role = userData.role;
        user.password = userData.password; // Will be hashed by beforeUpdate hook
        await user.save();
        console.log(`✅ Updated user: ${userData.username} (${userData.role})`);
      } else {
        console.log(`✅ Created user: ${userData.username} (${userData.role})`);
      }
    }

    console.log('\n✅ All initial users created/updated successfully');
    await sequelize.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  createInitialUsers();
}

module.exports = createInitialUsers;

