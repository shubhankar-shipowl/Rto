const cron = require('node-cron');
const path = require('path');
const { runBackup } = require('../scripts/backupDatabase');

/**
 * Initialize and start all cron jobs
 */
const startCronJobs = () => {
  console.log('🕐 Initializing cron jobs...');

  // Schedule database backup every day at 3:00 AM IST
  // IST is UTC+5:30, so 3:00 AM IST = 9:30 PM UTC (previous day)
  // Using cron expression: minute hour day month weekday
  // For IST 3:00 AM, we need to run at 21:30 UTC (previous day)
  // But node-cron uses server's local timezone, so we'll use IST timezone
  // Cron format: "0 3 * * *" means 3:00 AM every day
  // We'll use timezone option to ensure it runs at IST time
  
  const backupJob = cron.schedule(
    '0 3 * * *', // 3:00 AM every day
    async () => {
      console.log('⏰ Scheduled backup triggered at 3:00 AM IST');
      try {
        await runBackup();
        console.log('✅ Scheduled backup completed successfully');
      } catch (error) {
        console.error('❌ Scheduled backup failed:', error.message);
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Kolkata', // Use IST timezone
    }
  );

  console.log('✅ Cron jobs initialized:');
  console.log('   📦 Database backup scheduled: Daily at 3:00 AM IST');
  console.log('   🕐 Next backup:', getNextBackupTime());

  return {
    backupJob,
  };
};

/**
 * Get the next scheduled backup time
 */
const getNextBackupTime = () => {
  const now = new Date();
  const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  
  // Set to 3:00 AM IST
  const nextBackup = new Date(istDate);
  nextBackup.setHours(3, 0, 0, 0);
  
  // If it's already past 3 AM today, schedule for tomorrow
  if (istDate.getHours() >= 3) {
    nextBackup.setDate(nextBackup.getDate() + 1);
  }
  
  return nextBackup.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'long',
  });
};

/**
 * Stop all cron jobs
 */
const stopCronJobs = (jobs) => {
  if (jobs && jobs.backupJob) {
    jobs.backupJob.stop();
    console.log('🛑 Cron jobs stopped');
  }
};

module.exports = {
  startCronJobs,
  stopCronJobs,
  getNextBackupTime,
};

