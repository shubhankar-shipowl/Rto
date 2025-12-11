const { runBackup, cleanupOldBackups } = require('../scripts/backupDatabase');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../backups');

/**
 * Manually trigger a database backup
 */
const triggerBackup = async (req, res) => {
  try {
    console.log('📦 Manual backup triggered by user');
    const result = await runBackup();
    
    res.json({
      success: true,
      message: 'Backup completed successfully',
      backup: {
        filename: result.filename,
        size: result.size,
        sizeMB: (result.size / (1024 * 1024)).toFixed(2),
      },
    });
  } catch (error) {
    console.error('❌ Manual backup failed:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create backup',
      details: error.message,
    });
  }
};

/**
 * Get list of available backups
 */
const getBackups = async (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return res.json({
        success: true,
        backups: [],
        count: 0,
      });
    }

    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('rto_db_backup_') && file.endsWith('.sql'))
      .map(file => {
        const filepath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filepath);
        return {
          filename: file,
          size: stats.size,
          sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt); // Sort by creation time, newest first

    res.json({
      success: true,
      backups: files,
      count: files.length,
      totalSizeMB: files.reduce((sum, file) => sum + parseFloat(file.sizeMB), 0).toFixed(2),
    });
  } catch (error) {
    console.error('❌ Error listing backups:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to list backups',
      details: error.message,
    });
  }
};

/**
 * Clean up old backups manually
 */
const cleanupBackups = async (req, res) => {
  try {
    cleanupOldBackups();
    res.json({
      success: true,
      message: 'Backup cleanup completed',
    });
  } catch (error) {
    console.error('❌ Error cleaning up backups:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup backups',
      details: error.message,
    });
  }
};

module.exports = {
  triggerBackup,
  getBackups,
  cleanupBackups,
};

