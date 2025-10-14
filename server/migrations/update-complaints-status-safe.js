const { DataTypes } = require('sequelize');
const { sequelize } = require('../src/database');

async function updateComplaintsStatusSafe() {
  try {
    console.log(
      'Updating complaints table status enum and adding mailSubject field...',
    );

    // Check if mailSubject column exists
    const tableDescription = await sequelize
      .getQueryInterface()
      .describeTable('complaints');

    if (!tableDescription.mailSubject) {
      console.log('Adding mailSubject column...');
      await sequelize
        .getQueryInterface()
        .addColumn('complaints', 'mailSubject', {
          type: DataTypes.STRING,
          allowNull: true,
        });
    } else {
      console.log('mailSubject column already exists, skipping...');
    }

    // Update status enum to include 'mail_done'
    console.log('Updating status enum...');
    await sequelize.getQueryInterface().changeColumn('complaints', 'status', {
      type: DataTypes.ENUM('pending', 'mail_done', 'resolved', 'closed'),
      allowNull: false,
      defaultValue: 'pending',
    });

    console.log('✅ Complaints table updated successfully!');
  } catch (error) {
    console.error('❌ Error updating complaints table:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  updateComplaintsStatusSafe()
    .then(() => {
      console.log('Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = updateComplaintsStatusSafe;
