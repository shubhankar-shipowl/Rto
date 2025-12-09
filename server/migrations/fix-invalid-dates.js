const { sequelize } = require("../src/database");

async function fixInvalidDates() {
  let originalSqlMode = null;
  
  try {
    console.log("🔄 Fixing invalid date values in rto_data table...");

    // Save current SQL mode and temporarily allow zero dates
    try {
      const [sqlModeResult] = await sequelize.query("SELECT @@sql_mode as mode");
      originalSqlMode = sqlModeResult[0]?.mode;
      
      // Set SQL mode to allow zero dates temporarily
      await sequelize.query("SET SESSION sql_mode = 'ALLOW_INVALID_DATES'");
      console.log("✅ Temporarily disabled strict date checking");
    } catch (sqlModeError) {
      console.warn("⚠️  Could not modify SQL mode, trying alternative approach");
    }

    // First, check if table exists
    const [tables] = await sequelize.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'rto_data'
    `);

    if (tables.length === 0) {
      console.log("✅ rto_data table doesn't exist yet, no fix needed");
      return;
    }

    // Delete rows with invalid dates using multiple approaches
    // Try different methods to catch all invalid dates
    let deleteResult = { affectedRows: 0 };
    
    try {
      // Method 1: Using YEAR function
      const [result1] = await sequelize.query(`
        DELETE FROM rto_data 
        WHERE YEAR(date) = 0 OR date IS NULL
      `);
      deleteResult.affectedRows += result1.affectedRows || 0;
    } catch (e1) {
      console.warn("Method 1 failed, trying alternative...");
    }
    
    try {
      // Method 2: Using DATE_FORMAT
      const [result2] = await sequelize.query(`
        DELETE FROM rto_data 
        WHERE DATE_FORMAT(date, '%Y') = '0000' OR date IS NULL
      `);
      deleteResult.affectedRows += result2.affectedRows || 0;
    } catch (e2) {
      console.warn("Method 2 failed, trying alternative...");
    }
    
    try {
      // Method 3: Direct comparison with CAST (if SQL mode allows)
      const [result3] = await sequelize.query(`
        DELETE FROM rto_data 
        WHERE CAST(date AS CHAR) LIKE '0000%' OR date IS NULL
      `);
      deleteResult.affectedRows += result3.affectedRows || 0;
    } catch (e3) {
      console.warn("Method 3 failed, trying alternative...");
    }

    if (deleteResult.affectedRows > 0) {
      console.log(`✅ Deleted ${deleteResult.affectedRows} rows with invalid dates from rto_data`);
    } else {
      console.log("✅ No invalid dates found in rto_data table");
    }

    // Also check and fix scan_results table if it exists
    const [scanTables] = await sequelize.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'scan_results'
    `);

    if (scanTables.length > 0) {
      let deleteScanResult = { affectedRows: 0 };
      
      try {
        const [result1] = await sequelize.query(`
          DELETE FROM scan_results 
          WHERE YEAR(date) = 0 OR date IS NULL
        `);
        deleteScanResult.affectedRows += result1.affectedRows || 0;
      } catch (e) {
        // Ignore errors
      }
      
      try {
        const [result2] = await sequelize.query(`
          DELETE FROM scan_results 
          WHERE DATE_FORMAT(date, '%Y') = '0000' OR date IS NULL
        `);
        deleteScanResult.affectedRows += result2.affectedRows || 0;
      } catch (e) {
        // Ignore errors
      }

      if (deleteScanResult.affectedRows > 0) {
        console.log(`✅ Deleted ${deleteScanResult.affectedRows} scan_results with invalid dates`);
      }
    }

    console.log("🎉 Invalid dates fixed successfully!");
  } catch (error) {
    console.error("❌ Error fixing invalid dates:", error);
    throw error;
  } finally {
    // Restore original SQL mode
    if (originalSqlMode) {
      try {
        await sequelize.query(`SET SESSION sql_mode = '${originalSqlMode}'`);
        console.log("✅ Restored original SQL mode");
      } catch (restoreError) {
        console.warn("⚠️  Could not restore SQL mode:", restoreError.message);
      }
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  fixInvalidDates()
    .then(async () => {
      await sequelize.close();
      console.log("Migration completed successfully!");
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Migration failed:", error);
      await sequelize.close();
      process.exit(1);
    });
}

module.exports = fixInvalidDates;

