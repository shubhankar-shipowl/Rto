const Complaint = require('../models/Complaint');
const { Op } = require('sequelize');

// Create a new complaint
const createComplaint = async (req, res) => {
  try {
    const { barcode, date, email, description, mailSubject } = req.body;

    if (!barcode || !date || !email || !mailSubject) {
      return res.status(400).json({
        error: 'Barcode, date, email, and mail subject are required',
      });
    }

    // Check if complaint already exists for this barcode and date
    const existingComplaint = await Complaint.findOne({
      where: {
        barcode: barcode,
        date: date,
      },
    });

    if (existingComplaint) {
      // Update the existing complaint instead of creating a new one
      await existingComplaint.update({
        email,
        description: description || existingComplaint.description,
        mailSubject: mailSubject || existingComplaint.mailSubject,
      });

      console.log('Updated existing complaint:', existingComplaint.toJSON());

      return res.status(200).json({
        message: 'Complaint updated successfully',
        complaint: {
          id: existingComplaint.id,
          barcode: existingComplaint.barcode,
          date: existingComplaint.date,
          email: existingComplaint.email,
          description: existingComplaint.description,
          mailSubject: existingComplaint.mailSubject,
          status: existingComplaint.status,
          createdAt: existingComplaint.createdAt,
          updatedAt: existingComplaint.updatedAt,
        },
      });
    }

    const complaint = await Complaint.create({
      barcode,
      date,
      email,
      description: description || '',
      mailSubject: mailSubject || '',
      status: 'pending',
    });

    console.log('Created complaint object:', complaint.toJSON());
    console.log('mailSubject value:', complaint.mailSubject);

    res.status(201).json({
      message: 'Complaint created successfully',
      complaint: {
        id: complaint.id,
        barcode: complaint.barcode,
        date: complaint.date,
        email: complaint.email,
        description: complaint.description,
        mailSubject: complaint.mailSubject,
        status: complaint.status,
        createdAt: complaint.createdAt,
      },
    });
  } catch (error) {
    console.error('Create complaint error:', error);
    res.status(500).json({ error: 'Failed to create complaint' });
  }
};

// Get complaints for a specific date
const getComplaintsByDate = async (req, res) => {
  try {
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const complaints = await Complaint.findAll({
      where: { date: date },
      order: [['createdAt', 'DESC']],
    });

    res.json(complaints);
  } catch (error) {
    console.error('Get complaints error:', error);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
};

// Update complaint status
const updateComplaintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution } = req.body;

    if (!id || !status) {
      return res.status(400).json({
        error: 'Complaint ID and status are required',
      });
    }

    const validStatuses = ['pending', 'mail_done', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be one of: ' + validStatuses.join(', '),
      });
    }

    const updateData = { status };

    // If resolving, add resolution text and timestamp
    if (status === 'resolved') {
      updateData.resolution = resolution || '';
      updateData.resolvedAt = new Date();
    }

    const [updatedRows] = await Complaint.update(updateData, {
      where: { id: id },
    });

    if (updatedRows === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    // Fetch updated complaint
    const updatedComplaint = await Complaint.findByPk(id);

    res.json({
      message: 'Complaint status updated successfully',
      complaint: updatedComplaint,
    });
  } catch (error) {
    console.error('Update complaint error:', error);
    res.status(500).json({ error: 'Failed to update complaint' });
  }
};

// Get all complaints with pagination
const getAllComplaints = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, date } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (status) whereClause.status = status;
    if (date) whereClause.date = date;

    const { count, rows: complaints } = await Complaint.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      complaints,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Get all complaints error:', error);
    res.status(500).json({ error: 'Failed to fetch complaints' });
  }
};

// Get complaint statistics
const getComplaintStats = async (req, res) => {
  try {
    const { date } = req.query;

    const whereClause = date ? { date } : {};

    const stats = await Complaint.findAll({
      where: whereClause,
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    });

    const totalComplaints = await Complaint.count({ where: whereClause });

    res.json({
      total: totalComplaints,
      byStatus: stats.reduce((acc, stat) => {
        acc[stat.status] = parseInt(stat.count);
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error('Get complaint stats error:', error);
    res.status(500).json({ error: 'Failed to fetch complaint statistics' });
  }
};

// Mark mail as done for a complaint
const markMailDone = async (req, res) => {
  try {
    const { id } = req.params;
    const { mailSubject } = req.body;

    if (!id) {
      return res.status(400).json({
        error: 'Complaint ID is required',
      });
    }

    if (!mailSubject || !mailSubject.trim()) {
      return res.status(400).json({
        error: 'Mail subject is required',
      });
    }

    const [updatedRows] = await Complaint.update(
      {
        status: 'mail_done',
        mailSubject: mailSubject.trim(),
      },
      {
        where: { id: id },
      },
    );

    if (updatedRows === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    // Fetch updated complaint
    const updatedComplaint = await Complaint.findByPk(id);

    res.json({
      message: 'Mail marked as done successfully',
      complaint: updatedComplaint,
    });
  } catch (error) {
    console.error('Mark mail done error:', error);
    res.status(500).json({ error: 'Failed to mark mail as done' });
  }
};

// Delete complaint by barcode
const deleteComplaintByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;

    if (!barcode) {
      return res.status(400).json({
        error: 'Barcode is required',
      });
    }

    // Find and delete the complaint
    const deletedComplaint = await Complaint.destroy({
      where: { barcode: barcode },
    });

    if (deletedComplaint === 0) {
      return res.status(404).json({
        error: 'No complaint found for this barcode',
      });
    }

    res.json({
      message: 'Complaint removed successfully',
      barcode: barcode,
    });
  } catch (error) {
    console.error('Delete complaint error:', error);
    res.status(500).json({ error: 'Failed to remove complaint' });
  }
};

// Delete all complaints
const deleteAllComplaints = async (req, res) => {
  try {
    // Get count of complaints before deletion
    const totalComplaints = await Complaint.count();

    if (totalComplaints === 0) {
      return res.json({
        message: 'No complaints found to delete',
        deletedCount: 0,
      });
    }

    // Delete all complaints
    const deletedCount = await Complaint.destroy({
      where: {},
      truncate: true, // This is more efficient for deleting all records
    });

    res.json({
      message: 'All complaints deleted successfully',
      deletedCount: totalComplaints,
    });
  } catch (error) {
    console.error('Delete all complaints error:', error);
    res.status(500).json({ error: 'Failed to delete all complaints' });
  }
};

module.exports = {
  createComplaint,
  getComplaintsByDate,
  updateComplaintStatus,
  getAllComplaints,
  getComplaintStats,
  markMailDone,
  deleteComplaintByBarcode,
  deleteAllComplaints,
};
