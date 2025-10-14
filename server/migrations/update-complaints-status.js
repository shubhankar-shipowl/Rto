const { DataTypes } = require('sequelize');
const { sequelize } = require('../src/database');

async function updateComplaintsStatus() {
  try {
    console.log(
      'Updating complaints table status enum and adding mailSubject field...',
    );

    // Add mailSubject column
    await sequelize.getQueryInterface().addColumn('complaints', 'mailSubject', {
      type: DataTypes.STRING,
      allowNull: true,
    });

    // Update status enum to include 'mail_done'
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
  updateComplaintsStatus()
    .then(() => {
      console.log('Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = updateComplaintsStatus;
