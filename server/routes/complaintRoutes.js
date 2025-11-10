const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const {
  createComplaint,
  getComplaintsByDate,
  updateComplaintStatus,
  getAllComplaints,
  getComplaintStats,
  markMailDone,
  deleteComplaintByBarcode,
  deleteAllComplaints,
} = require('../controllers/complaintController');

// Create a new complaint
router.post('/', createComplaint);

// Get complaints for a specific date
router.get('/date/:date', getComplaintsByDate);

// Update complaint status
router.put('/:id/status', updateComplaintStatus);

// Mark mail as done
router.put('/:id/mail-done', markMailDone);

// Get all complaints with pagination and filters
router.get('/', getAllComplaints);

// Get complaint statistics
router.get('/stats', getComplaintStats);

// Delete complaint by barcode (Admin only)
router.delete('/barcode/:barcode', requireAdmin, deleteComplaintByBarcode);

// Delete all complaints (Admin only)
router.delete('/all', requireAdmin, deleteAllComplaints);

module.exports = router;
