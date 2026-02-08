const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { requireAdmin } = require('../middleware/auth');
const {
  uploadRTOData,
  scanBarcode,
  bulkScanBarcodes,
  getRTOReport,
  getCalendarData,
  getRTODataByDate,
  getScanResultsByDate,
  getOverallUploadSummary,
  getAllUploadedData,
  deleteUploadedData,
  deleteAllUploadedData,
  getCourierCounts,
  deleteUnmatchedScan,
  reconcileUnmatchedScan,
  getReconcilableScans,
} = require('../controllers/rtoController');
const {
  triggerBackup,
  getBackups,
  cleanupBackups,
} = require('../controllers/backupController');


// Upload RTO Excel file (supports single or multiple files)
router.post(
  '/upload',
  (req, res, next) => {
    console.log('📤 Multer upload middleware called');
    // Try multiple files first, fallback to single file
    upload.fields([
      { name: 'file', maxCount: 1 },
      { name: 'nimbuFile', maxCount: 1 }
    ])(req, res, (err) => {
      if (err) {
        console.error('❌ Multer error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'File too large. Maximum size is 10MB per file.',
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            error:
              'Unexpected field name. Please use "file" for old sheet and "nimbuFile" for Nimbu sheet.',
          });
        }
        return res.status(400).json({
          error: err.message || 'File upload failed',
        });
      }
      
      // Normalize files: combine req.files into a single array
      if (req.files) {
        req.files = [
          ...(req.files.file || []),
          ...(req.files.nimbuFile || [])
        ];
      } else if (req.file) {
        // Fallback: if only single file upload, convert to array
        req.files = [req.file];
      }
      
      console.log('✅ Multer upload middleware completed successfully');
      next();
    });
  },
  uploadRTOData,
);

// Scan barcode
router.post('/scan', scanBarcode);

// Bulk scan barcodes from Excel file
router.post('/scan/bulk', upload.single('file'), bulkScanBarcodes);

// Get RTO report for specific date
router.get('/report/:date', getRTOReport);

// Get calendar data
router.get('/calendar', getCalendarData);

// Get RTO data for specific date
router.get('/data/:date', getRTODataByDate);

// Get scan results for specific date
router.get('/scans/:date', getScanResultsByDate);

// Get overall upload summary across all dates
router.get('/summary', getOverallUploadSummary);

// Get all uploaded data
router.get('/uploads', getAllUploadedData);

// Delete uploaded data by date (Admin only)
router.delete('/uploads/:date', requireAdmin, deleteUploadedData);

// Delete all uploaded data (Admin only)
router.delete('/uploads', requireAdmin, deleteAllUploadedData);

// Get courier counts for specific date
router.get('/courier-counts/:date', getCourierCounts);

// Delete unmatched scan result (Admin only)
router.delete('/scan/unmatched', requireAdmin, deleteUnmatchedScan);

// Reconcile unmatched scan to matched (move to correct date)
router.post('/scan/reconcile', reconcileUnmatchedScan);

// Get reconcilable unmatched scans for a date
router.get('/reconcilable/:date', getReconcilableScans);

// Backup routes (Admin only)
router.post('/backup/trigger', requireAdmin, triggerBackup);
router.get('/backup/list', requireAdmin, getBackups);
router.post('/backup/cleanup', requireAdmin, cleanupBackups);

module.exports = router;
