const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Get absolute path to uploads directory
const uploadsDir = path.join(__dirname, '../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`📁 Created uploads directory: ${uploadsDir}`);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log(`📁 Upload destination: ${uploadsDir}`);
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename =
      file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
    console.log(`📄 Generated filename: ${filename}`);
    cb(null, filename);
  },
});

// File filter to only allow Excel files
const fileFilter = (req, file, cb) => {
  console.log('File upload attempt:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    fieldname: file.fieldname,
  });

  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
  ];

  // Also allow by file extension as fallback
  const allowedExtensions = ['.xlsx', '.xls'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (
    allowedTypes.includes(file.mimetype) ||
    allowedExtensions.includes(fileExtension)
  ) {
    console.log('File accepted:', file.originalname);
    cb(null, true);
  } else {
    console.log(
      'File rejected:',
      file.originalname,
      'MIME type:',
      file.mimetype,
    );
    cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Upload multiple files (for old sheet + new Nimbu sheet)
const uploadMultiple = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 2, // Allow up to 2 files
  },
});

module.exports = upload;
module.exports.uploadMultiple = uploadMultiple;
