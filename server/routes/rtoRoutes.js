const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
  uploadRTOData,
  scanBarcode,
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
} = require('../controllers/rtoController');

// Upload RTO Excel file
router.post(
  '/upload',
  (req, res, next) => {
    console.log('📤 Multer upload middleware called');
    upload.single('file')(req, res, (err) => {
      if (err) {
        console.error('❌ Multer error:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'File too large. Maximum size is 10MB.',
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            error:
              'Unexpected field name. Please use "file" as the field name.',
          });
        }
        return res.status(400).json({
          error: err.message || 'File upload failed',
        });
      }
      console.log('✅ Multer upload middleware completed successfully');
      next();
    });
  },
  uploadRTOData,
);

// Scan barcode
router.post('/scan', scanBarcode);

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

// Delete uploaded data by date
router.delete('/uploads/:date', deleteUploadedData);

// Delete all uploaded data
router.delete('/uploads', deleteAllUploadedData);

// Get courier counts for specific date
router.get('/courier-counts/:date', getCourierCounts);

// Delete unmatched scan result
router.delete('/scan/unmatched', deleteUnmatchedScan);

module.exports = router;
