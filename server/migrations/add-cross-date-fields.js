const { sequelize } = require("../src/database");

async function addCrossDateFields() {
  try {
    console.log("🔄 Adding cross-date fields to scan_results table...");

    // Add isFromDifferentDate column
    await sequelize.query(`
      ALTER TABLE scan_results 
      ADD COLUMN isFromDifferentDate BOOLEAN DEFAULT FALSE
    `);
    console.log("✅ Added isFromDifferentDate column");

    // Add originalDate column
    await sequelize.query(`
      ALTER TABLE scan_results 
      ADD COLUMN originalDate DATE
    `);
    console.log("✅ Added originalDate column");

    console.log("🎉 Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await sequelize.close();
  }
}

addCrossDateFields();
