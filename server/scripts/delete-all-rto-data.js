const { connectDB, sequelize } = require('../src/database');
const RTOData = require('../models/RTOData');
const ScanResult = require('../models/ScanResult');

async function deleteAllRTOData() {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    
    console.log('🗑️  Deleting all RTO data...');
    
    // Delete all RTO data
    const deletedRTOData = await RTOData.destroy({
      where: {},
      truncate: true,
    });
    
    console.log('🗑️  Deleting all scan results...');
    
    // Delete all scan results
    const deletedScanResults = await ScanResult.destroy({
      where: {},
      truncate: true,
    });
    
    console.log('✅ Successfully deleted all uploaded RTO data');
    console.log(`   - RTO Data records deleted`);
    console.log(`   - Scan Results deleted`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting all RTO data:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  deleteAllRTOData();
}

module.exports = deleteAllRTOData;

