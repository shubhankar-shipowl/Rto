const { DataTypes } = require('sequelize');
const { sequelize } = require('../src/database');

async function createComplaintsTable() {
  try {
    console.log('Creating complaints table...');

    await sequelize.getQueryInterface().createTable('complaints', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      barcode: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'in_progress', 'resolved', 'closed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      resolution: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      resolvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      createdBy: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });

    // Add indexes
    await sequelize.getQueryInterface().addIndex('complaints', ['barcode']);
    await sequelize.getQueryInterface().addIndex('complaints', ['date']);
    await sequelize.getQueryInterface().addIndex('complaints', ['status']);
    await sequelize.getQueryInterface().addIndex('complaints', ['email']);

    console.log('✅ Complaints table created successfully!');
  } catch (error) {
    console.error('❌ Error creating complaints table:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  createComplaintsTable()
    .then(() => {
      console.log('Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = createComplaintsTable;
