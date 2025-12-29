const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), override: true });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { connectDB, sequelize } = require('../src/database');
const bcrypt = require('bcryptjs');

async function testLogin() {
  try {
    // Connect to database
    await connectDB();
    console.log('✅ Database connection established\n');

    // Import User model after database is connected
    const User = require('../models/User');

    // Test users
    const testUsers = [
      { username: 'admin', password: 'admin123' },
      { username: 'user', password: 'user123' },
      { username: 'adarsh', password: 'Adarsh@22' },
    ];

    console.log('🧪 Testing login for users...\n');

    for (const testUser of testUsers) {
      console.log(`Testing: ${testUser.username}`);
      
      // Find user
      const user = await User.findOne({
        where: { username: testUser.username },
      });

      if (!user) {
        console.log(`  ❌ User '${testUser.username}' NOT FOUND in database\n`);
        continue;
      }

      console.log(`  ✅ User found: ${user.name} (${user.role})`);

      // Test password
      const isValid = await user.comparePassword(testUser.password);
      
      if (isValid) {
        console.log(`  ✅ Password is VALID\n`);
      } else {
        console.log(`  ❌ Password is INVALID\n`);
      }
    }

    // Count total users
    const totalUsers = await User.count();
    console.log(`\n📊 Total users in database: ${totalUsers}`);

    await sequelize.close();
    console.log('\n✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testLogin();

