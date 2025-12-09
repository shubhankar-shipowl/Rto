const { sequelize } = require("../src/database");

async function forceFixDates() {
  let originalSqlMode = null;
  
  try {
    console.log("🔄 Force fixing invalid date values...");

    // Save and modify SQL mode
    try {
      const [sqlModeResult] = await sequelize.query("SELECT @@sql_mode as mode");
      originalSqlMode = sqlModeResult[0]?.mode;
      await sequelize.query("SET SESSION sql_mode = 'ALLOW_INVALID_DATES,NO_ZERO_DATE'");
      console.log("✅ Modified SQL mode to allow invalid dates");
    } catch (sqlModeError) {
      console.warn("⚠️  Could not modify SQL mode");
    }

    // Check if rto_data table exists
    const [tables] = await sequelize.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'rto_data'
    `);

    if (tables.length === 0) {
      console.log("✅ rto_data table doesn't exist yet");
      return;
    }

    // Get all rows and check dates manually
    const [allRows] = await sequelize.query(`
      SELECT id, date 
      FROM rto_data 
      LIMIT 1000
    `);

    console.log(`📊 Found ${allRows.length} rows in rto_data`);

    // Find rows with invalid dates by checking the date string
    const invalidIds = [];
    for (const row of allRows) {
      const dateStr = row.date ? String(row.date) : '';
      if (!dateStr || dateStr.startsWith('0000') || dateStr === 'Invalid Date' || dateStr === 'null') {
        invalidIds.push(row.id);
      }
    }

    if (invalidIds.length > 0) {
      console.log(`⚠️  Found ${invalidIds.length} rows with invalid dates`);
      
      // Update invalid dates to today's date instead of deleting
      const today = new Date().toISOString().split('T')[0];
      const idsStr = invalidIds.join(',');
      const [updateResult] = await sequelize.query(`
        UPDATE rto_data 
        SET date = '${today}'
        WHERE id IN (${idsStr})
      `);
      
      console.log(`✅ Updated ${updateResult.affectedRows} rows with invalid dates to ${today}`);
    } else {
      // Also try to update any rows that MySQL considers invalid
      // Use a subquery approach to find problematic rows
      try {
        const today = new Date().toISOString().split('T')[0];
        const [updateResult] = await sequelize.query(`
          UPDATE rto_data 
          SET date = '${today}'
          WHERE YEAR(date) = 0 OR date IS NULL
        `);
        if (updateResult.affectedRows > 0) {
          console.log(`✅ Updated ${updateResult.affectedRows} rows with invalid dates using YEAR check`);
        }
      } catch (updateError) {
        // If update fails, try deleting
        try {
          const [deleteResult] = await sequelize.query(`
            DELETE FROM rto_data 
            WHERE YEAR(date) = 0 OR date IS NULL
          `);
          if (deleteResult.affectedRows > 0) {
            console.log(`✅ Deleted ${deleteResult.affectedRows} rows with invalid dates`);
          }
        } catch (deleteError) {
          console.warn("⚠️  Could not fix invalid dates:", deleteError.message);
        }
      }
      console.log("✅ No invalid dates found in manual check");
    }

    // Also check scan_results
    const [scanTables] = await sequelize.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'scan_results'
    `);

    if (scanTables.length > 0) {
      const [scanRows] = await sequelize.query(`
        SELECT id, date 
        FROM scan_results 
        LIMIT 1000
      `);

      const invalidScanIds = [];
      for (const row of scanRows) {
        const dateStr = row.date ? String(row.date) : '';
        if (!dateStr || dateStr.startsWith('0000') || dateStr === 'Invalid Date' || dateStr === 'null') {
          invalidScanIds.push(row.id);
        }
      }

      if (invalidScanIds.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const idsStr = invalidScanIds.join(',');
        const [updateScanResult] = await sequelize.query(`
          UPDATE scan_results 
          SET date = '${today}'
          WHERE id IN (${idsStr})
        `);
        console.log(`✅ Updated ${updateScanResult.affectedRows} scan_results with invalid dates`);
      }
      
      // Also try YEAR check for scan_results
      try {
        const today = new Date().toISOString().split('T')[0];
        const [updateResult] = await sequelize.query(`
          UPDATE scan_results 
          SET date = '${today}'
          WHERE YEAR(date) = 0 OR date IS NULL
        `);
        if (updateResult.affectedRows > 0) {
          console.log(`✅ Updated ${updateResult.affectedRows} scan_results using YEAR check`);
        }
      } catch (e) {
        // Ignore
      }
    }

    console.log("🎉 Force fix completed!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    throw error;
  } finally {
    if (originalSqlMode) {
      try {
        await sequelize.query(`SET SESSION sql_mode = '${originalSqlMode}'`);
      } catch (e) {
        // Ignore
      }
    }
  }
}

if (require.main === module) {
  forceFixDates()
    .then(async () => {
      await sequelize.close();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Migration failed:", error);
      await sequelize.close();
      process.exit(1);
    });
}

module.exports = forceFixDates;

