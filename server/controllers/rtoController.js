const XLSX = require('xlsx');
const RTOData = require('../models/RTOData');
const ScanResult = require('../models/ScanResult');
const path = require('path');
const { Op } = require('sequelize');
const { sequelize } = require('../src/database');

// Simple in-memory cache for reports data
const reportsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Function to clear cache for a specific date
const clearCacheForDate = (date) => {
  reportsCache.delete(`scans_${date}`);
  reportsCache.delete(`rto_data_${date}`);
  reportsCache.delete(`courier_counts_${date}`);
  console.log(`🗑️ Cleared cache for date: ${date}`);
};

// Clear overall summary cache
const clearOverallSummaryCache = () => {
  dataCache.delete('overall_summary');
  console.log('🗑️ Cleared overall summary cache');
};

// Upload and parse Excel file
const uploadRTOData = async (req, res) => {
  try {
    console.log('📤 Upload request received:', {
      hasFile: !!req.file,
      filePath: req.file?.path,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      body: req.body,
    });

    if (!req.file) {
      console.error('❌ No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { date } = req.body;
    if (!date) {
      console.error('❌ Date is required');
      return res.status(400).json({ error: 'Date is required' });
    }

    // Check database connection before processing
    try {
      await sequelize.authenticate();
      console.log('✅ Database connection verified');
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError.message);
      return res.status(500).json({
        error: 'Database connection failed. Please try again later.',
        details:
          'The system is currently unable to process uploads due to database connectivity issues.',
      });
    }

    // Check if file exists before processing
    const fs = require('fs');
    if (!fs.existsSync(req.file.path)) {
      console.error('❌ File does not exist at path:', req.file.path);
      return res.status(500).json({
        error: 'Uploaded file not found',
        details: `File path: ${req.file.path}`,
      });
    }

    console.log('✅ File exists, proceeding with Excel parsing...');

    // Parse Excel file
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    // Extract barcodes and product data, grouping by RTS Date
    const productsByDate = {};
    const waybillCountsByDate = {}; // Track unique waybills per date

    // Helpers to robustly read values from various possible headers
    const getFirst = (obj, keys) => {
      for (const key of keys) {
        if (
          obj.hasOwnProperty(key) &&
          obj[key] !== undefined &&
          obj[key] !== null &&
          obj[key] !== ''
        ) {
          return obj[key];
        }
      }
      return undefined;
    };

    const toDateOnly = (value) => {
      if (!value) return 'no-date';
      if (value instanceof Date) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      const str = String(value);
      // Handles formats like "2025-10-01 14:15:55" or Excel strings
      return str.includes(' ') ? str.split(' ')[0] : str.substring(0, 10);
    };

    const toInt = (value, fallback = 1) => {
      if (value === undefined || value === null || value === '')
        return fallback;
      const n = parseInt(String(value).replace(/[^0-9-]/g, ''), 10);
      return Number.isFinite(n) ? n : fallback;
    };

    const toPrice = (value, fallback = 0) => {
      if (value === undefined || value === null || value === '')
        return fallback;
      const n = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
      return Number.isFinite(n) ? n : fallback;
    };

    jsonData.forEach((row) => {
      // Waybill / Barcode
      const waybillNumber = (
        getFirst(row, [
          'WayBill Number',
          'Waybill Number',
          'Waybill',
          'AWB',
          'Tracking ID',
          'Tracking Number',
          'Waybill No',
        ]) || ''
      )
        .toString()
        .trim();

      // Product name across possible headers
      const rawProductName = getFirst(row, [
        'Product Name',
        'Product',
        'Item Name',
        'Item',
        'Description',
        'SKU Name',
      ]);
      const productName =
        rawProductName !== undefined && rawProductName !== null
          ? String(rawProductName).toString().trim()
          : '';

      // Quantity across possible headers
      const quantity = toInt(
        getFirst(row, ['Product Qty', 'Qty', 'Quantity', 'QTY']),
        1,
      );

      // Price across possible headers; strip currency symbols and commas
      const price = toPrice(
        getFirst(row, [
          'Product Value',
          'Price',
          'Selling Price',
          'Amount',
          'Item Price',
          'MRP',
        ]),
        0,
      );

      // RTS/Return date
      const rtsDateValue = getFirst(row, [
        'RTS Date',
        'Return Date',
        'RTD',
        'Date',
      ]);
      const rtsDate = rtsDateValue ? String(rtsDateValue) : undefined;

      // Courier / Fulfilled By
      const fulfilledBy = (
        getFirst(row, [
          'Fulfilled By',
          'Courier',
          'Courier Name',
          'CourierName',
          'Shipped By',
        ]) || 'Unknown Courier'
      ).toString();

      // Include all records that have a waybill number, regardless of RTS date
      if (waybillNumber) {
        // Use RTS date if available, otherwise use a default date
        const dateOnly = toDateOnly(rtsDate);

        if (!productsByDate[dateOnly]) {
          productsByDate[dateOnly] = [];
          waybillCountsByDate[dateOnly] = new Set(); // Track unique waybills
        }

        // Add to products list
        productsByDate[dateOnly].push({
          barcode: waybillNumber,
          productName,
          quantity,
          price,
          status: 'pending',
          orderId: row['OrderId'],
          orderDate: row['Order Date'],
          rtsDate: rtsDate || 'No RTS Date',
          consigneeName: row['Consignee Name'],
          city: row['City'],
          state: row['State'],
          pincode: row['Pincode'],
          fulfilledBy: fulfilledBy,
        });

        // Track unique waybills
        waybillCountsByDate[dateOnly].add(waybillNumber);
      }
    });

    console.log(`Total records processed: ${jsonData.length}`);
    console.log(
      `Records with waybill numbers: ${Object.values(productsByDate).reduce(
        (sum, products) => sum + products.length,
        0,
      )}`,
    );
    console.log(
      'Products grouped by RTS Date:',
      Object.keys(productsByDate).map(
        (date) =>
          `${date}: ${productsByDate[date].length} products, ${waybillCountsByDate[date].size} unique waybills`,
      ),
    );

    // Store products for each RTS date separately
    const uploadResults = [];

    try {
      for (const [rtsDate, products] of Object.entries(productsByDate)) {
        // Check if data already exists for this RTS date
        const [existingData, created] = await RTOData.findOrCreate({
          where: { date: rtsDate },
          defaults: {
            barcodes: products,
            uploadInfo: {
              originalFileName: req.file.originalname,
              uploadDate: new Date(),
              totalRecords: waybillCountsByDate[rtsDate].size, // Use unique waybill count
              totalProducts: products.length, // Keep product count for reference
              selectedDate: date, // The date selected during upload
            },
          },
        });

        if (!created) {
          // Update existing data
          await existingData.update({
            barcodes: products,
            uploadInfo: {
              originalFileName: req.file.originalname,
              uploadDate: new Date(),
              totalRecords: waybillCountsByDate[rtsDate].size, // Use unique waybill count
              totalProducts: products.length, // Keep product count for reference
              selectedDate: date, // The date selected during upload
            },
          });
        }

        uploadResults.push({
          date: rtsDate,
          count: products.length,
          created: created,
        });
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    const totalProducts = Object.values(productsByDate).reduce(
      (sum, products) => sum + products.length,
      0,
    );

    const totalWaybills = Object.values(waybillCountsByDate).reduce(
      (sum, waybills) => sum + waybills.size,
      0,
    );

    // Clean up uploaded file after successful processing
    try {
      const fs = require('fs');
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('🗑️ Cleaned up uploaded file:', req.file.path);
      }
    } catch (cleanupError) {
      console.warn(
        '⚠️ Failed to clean up uploaded file:',
        cleanupError.message,
      );
    }

    console.log('✅ Upload completed successfully');

    // Clear overall summary cache since new data was uploaded
    clearOverallSummaryCache();

    res.json({
      message: 'RTO data uploaded successfully',
      uploadDate: date,
      totalRecords: totalWaybills, // Use unique waybill count
      totalProducts: totalProducts, // Keep product count for reference
      uploadResults: uploadResults,
      summary: {
        totalDates: Object.keys(productsByDate).length,
        totalWaybills: totalWaybills,
        totalProducts: totalProducts,
        productsByDate: Object.keys(productsByDate).map((date) => ({
          date: date,
          waybills: waybillCountsByDate[date].size,
          products: productsByDate[date].length,
        })),
      },
    });
  } catch (error) {
    console.error('❌ Upload error:', error);

    // Clean up uploaded file on error
    try {
      const fs = require('fs');
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log('🗑️ Cleaned up uploaded file after error:', req.file.path);
      }
    } catch (cleanupError) {
      console.warn(
        '⚠️ Failed to clean up uploaded file after error:',
        cleanupError.message,
      );
    }

    res.status(500).json({
      error: 'Failed to process Excel file',
      details: error.message,
    });
  }
};

// Scan barcode and check for match
// Cache for frequently accessed data
const dataCache = new Map();

// Clean up expired cache entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of dataCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      dataCache.delete(key);
    }
  }
}, 10 * 60 * 1000);

const scanBarcode = async (req, res) => {
  try {
    const { barcode, date } = req.body;

    if (!barcode || !date) {
      return res.status(400).json({ error: 'Barcode and date are required' });
    }

    // Check cache first for better performance
    const cacheKey = `rto_data_${date}`;
    let rtoData = dataCache.get(cacheKey);

    if (!rtoData || Date.now() - rtoData.timestamp > CACHE_TTL) {
      // Find RTO data for the specified date with optimized query
      rtoData = await RTOData.findOne({
        where: { date: date },
        attributes: ['id', 'date', 'barcodes', 'reconciliationSummary'],
      });

      if (!rtoData) {
        return res
          .status(404)
          .json({ error: 'No RTO data found for this date' });
      }

      // Cache the data
      dataCache.set(cacheKey, {
        ...rtoData.toJSON(),
        timestamp: Date.now(),
      });
    } else {
      // Use cached data - extract the data part but keep id
      const cachedData = rtoData;
      rtoData = {
        id: cachedData.id,
        date: cachedData.date,
        barcodes: cachedData.barcodes,
        reconciliationSummary: cachedData.reconciliationSummary,
      };
      console.log('Using cached data, rtoData.id:', rtoData.id);
    }

    // Ensure we have a valid id
    if (!rtoData.id) {
      console.error('Missing rtoData.id, fetching fresh data from database');
      rtoData = await RTOData.findOne({
        where: { date: date },
        attributes: ['id', 'date', 'barcodes', 'reconciliationSummary'],
      });

      if (!rtoData) {
        return res
          .status(404)
          .json({ error: 'No RTO data found for this date' });
      }
    }

    // Check if barcode exists in the data
    // Parse barcodes if it's a JSON string
    let barcodes = rtoData.barcodes || [];
    if (typeof barcodes === 'string') {
      try {
        barcodes = JSON.parse(barcodes);
      } catch (error) {
        console.error('Error parsing barcodes:', error);
        barcodes = [];
      }
    }

    // Ensure barcodes is an array
    if (!Array.isArray(barcodes)) {
      console.error('Barcodes is not an array:', typeof barcodes, barcodes);
      barcodes = [];
    }

    // Check if this barcode has already been scanned today (case-insensitive comparison)
    const existingScan = await ScanResult.findOne({
      where: {
        date: date,
        barcode: {
          [Op.eq]: barcode, // Exact match for duplicate check
        },
      },
      attributes: [
        'match',
        'productName',
        'quantity',
        'price',
        'message',
        'timestamp',
      ],
    });

    // Only prevent re-scanning if the previous scan was successful (matched)
    if (existingScan && existingScan.match) {
      return res.status(400).json({
        error: 'This barcode has already been scanned for this date',
        alreadyScanned: true,
        previousScan: {
          match: existingScan.match,
          productName: existingScan.productName,
          quantity: existingScan.quantity,
          price: existingScan.price,
          message: existingScan.message,
          timestamp: existingScan.timestamp,
        },
      });
    }

    // If there's an existing unmatched scan, delete it to allow re-scanning
    if (existingScan && !existingScan.match) {
      await ScanResult.destroy({
        where: {
          date: date,
          barcode: barcode,
        },
      });
    }

    // Optimized barcode matching using Map for O(1) lookup with case-insensitive comparison
    const barcodeMap = new Map();
    barcodes.forEach((item, index) => {
      // Store both original and lowercase versions for case-insensitive lookup
      const barcodeKey = item.barcode.toString().toLowerCase();
      barcodeMap.set(barcodeKey, { ...item, index });
    });

    const matchedBarcode = barcodeMap.get(barcode.toString().toLowerCase());
    const matchedBarcodeIndex = matchedBarcode ? matchedBarcode.index : -1;

    if (matchedBarcodeIndex !== -1) {
      // Check if this item is from a different date
      const itemDate = barcodes[matchedBarcodeIndex].date;
      const isFromDifferentDate = itemDate && itemDate !== date;

      // Update status to matched
      barcodes[matchedBarcodeIndex].status = 'matched';
      barcodes[matchedBarcodeIndex].scannedAt = new Date();
      barcodes[matchedBarcodeIndex].isFromDifferentDate = isFromDifferentDate;
      barcodes[matchedBarcodeIndex].originalDate = itemDate;

      // Update reconciliation summary
      let summary = rtoData.reconciliationSummary || {
        totalScanned: 0,
        matched: 0,
        unmatched: 0,
      };

      // Parse summary if it's a JSON string
      if (typeof summary === 'string') {
        try {
          summary = JSON.parse(summary);
        } catch (error) {
          console.error('Error parsing reconciliationSummary:', error);
          summary = { totalScanned: 0, matched: 0, unmatched: 0 };
        }
      }
      summary.totalScanned += 1;
      summary.matched += 1;

      // Use transaction for atomic updates
      const transaction = await sequelize.transaction();

      try {
        // Update RTO data and create scan result in parallel
        const [updatedRTOData, scanResult] = await Promise.all([
          RTOData.update(
            {
              barcodes: barcodes,
              reconciliationSummary: summary,
            },
            {
              where: { id: rtoData.id },
              transaction,
            },
          ),
          ScanResult.create(
            {
              barcode: barcode,
              date: date,
              match: true,
              productName: barcodes[matchedBarcodeIndex].productName,
              quantity: barcodes[matchedBarcodeIndex].quantity,
              price: barcodes[matchedBarcodeIndex].price,
              message: isFromDifferentDate
                ? `Barcode matched in RTO data (from ${itemDate})`
                : 'Barcode matched in RTO data',
              timestamp: new Date(),
              isFromDifferentDate: isFromDifferentDate,
              originalDate: itemDate,
            },
            { transaction },
          ),
        ]);

        await transaction.commit();

        // Update cache
        dataCache.set(cacheKey, {
          ...rtoData,
          barcodes: barcodes,
          reconciliationSummary: summary,
          timestamp: Date.now(),
        });

        // Clear reports cache for this date
        clearCacheForDate(date);
        // Also clear overall summary cache since scan counts changed
        clearOverallSummaryCache();

        res.json({
          match: true,
          barcode: barcode,
          productName: barcodes[matchedBarcodeIndex].productName,
          quantity: barcodes[matchedBarcodeIndex].quantity,
          price: barcodes[matchedBarcodeIndex].price,
          message: isFromDifferentDate
            ? `Barcode matched in RTO data (from ${itemDate})`
            : 'Barcode matched in RTO data',
          timestamp: new Date(),
          isFromDifferentDate: isFromDifferentDate,
          originalDate: itemDate,
        });
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } else {
      // Handle unmatched barcode - don't add to barcodes array, just create scan result
      let summary = rtoData.reconciliationSummary || {
        totalScanned: 0,
        matched: 0,
        unmatched: 0,
      };

      // Parse summary if it's a JSON string
      if (typeof summary === 'string') {
        try {
          summary = JSON.parse(summary);
        } catch (error) {
          console.error('Error parsing reconciliationSummary:', error);
          summary = { totalScanned: 0, matched: 0, unmatched: 0 };
        }
      }
      summary.totalScanned += 1;
      summary.unmatched += 1;

      // Use transaction for atomic updates
      const transaction = await sequelize.transaction();

      try {
        // Update only the summary, don't modify barcodes array
        await Promise.all([
          RTOData.update(
            {
              reconciliationSummary: summary,
            },
            {
              where: { id: rtoData.id },
              transaction,
            },
          ),
          ScanResult.create(
            {
              barcode: barcode,
              date: date,
              match: false,
              productName: 'Unknown Product',
              quantity: 1,
              price: 0,
              message: 'Barcode not found in RTO data',
              timestamp: new Date(),
            },
            { transaction },
          ),
        ]);

        await transaction.commit();

        // Update cache
        dataCache.set(cacheKey, {
          ...rtoData,
          reconciliationSummary: summary,
          timestamp: Date.now(),
        });

        // Clear reports cache for this date
        clearCacheForDate(date);
        // Also clear overall summary cache since scan counts changed
        clearOverallSummaryCache();

        res.json({
          match: false,
          barcode: barcode,
          productName: 'Unknown Product',
          quantity: 1,
          price: 0,
          message: 'Barcode not found in RTO data',
          timestamp: new Date(),
        });
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    }
  } catch (error) {
    console.error('Scan error details:', {
      message: error.message,
      stack: error.stack,
      barcode: req.body?.barcode,
      date: req.body?.date,
    });
    res.status(500).json({
      error: 'Failed to process barcode scan',
      details: error.message,
    });
  }
};

// Get RTO report for a specific date
const getRTOReport = async (req, res) => {
  try {
    const { date } = req.params;

    const rtoData = await RTOData.findOne({ where: { date: date } });

    if (!rtoData) {
      return res.status(404).json({ error: 'No RTO data found for this date' });
    }

    const barcodes = rtoData.barcodes || [];
    res.json({
      date: rtoData.date,
      uploadInfo: rtoData.uploadInfo,
      reconciliationSummary: rtoData.reconciliationSummary,
      barcodes: barcodes,
      matchedBarcodes: barcodes.filter((b) => b.status === 'matched'),
      unmatchedBarcodes: barcodes.filter((b) => b.status === 'unmatched'),
    });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'Failed to fetch RTO report' });
  }
};

// Get calendar data for dashboard
const getCalendarData = async (req, res) => {
  try {
    const { year, month } = req.query;

    const startDate = new Date(
      year || new Date().getFullYear(),
      month ? month - 1 : new Date().getMonth(),
      1,
    );
    const endDate = new Date(
      year || new Date().getFullYear(),
      month ? month : new Date().getMonth() + 1,
      0,
    );

    // Add error handling for database connection
    const calendarData = await RTOData.findAll({
      where: {
        date: {
          [Op.gte]: startDate,
          [Op.lte]: endDate,
        },
      },
      attributes: ['id', 'date', 'reconciliationSummary', 'uploadInfo'],
      order: [['date', 'ASC']],
    }).catch((dbError) => {
      console.error('Database query error:', dbError);
      return []; // Return empty array if database query fails
    });

    // Parse JSON fields for each calendar item
    const parsedCalendarData = (calendarData || []).map((item) => ({
      ...item.toJSON(),
      uploadInfo:
        typeof item.uploadInfo === 'string'
          ? JSON.parse(item.uploadInfo)
          : item.uploadInfo,
      reconciliationSummary:
        typeof item.reconciliationSummary === 'string'
          ? JSON.parse(item.reconciliationSummary)
          : item.reconciliationSummary,
    }));

    res.json(parsedCalendarData);
  } catch (error) {
    console.error('Calendar error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar data' });
  }
};

// Get RTO data for a specific date
const getRTODataByDate = async (req, res) => {
  const startTime = Date.now();
  try {
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    console.log(`📊 getRTODataByDate called for date: ${date}`);

    // Check cache first
    const cacheKey = `rto_data_${date}`;
    const cachedData = reportsCache.get(cacheKey);

    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      console.log(`📊 Using cached RTO data for date: ${date}`);
      const endTime = Date.now();
      console.log(
        `⏱️ getRTODataByDate (cached) completed in ${
          endTime - startTime
        }ms for ${cachedData.data.barcodes?.length || 0} barcodes`,
      );
      return res.json(cachedData.data);
    }

    const rtoData = await RTOData.findOne({
      where: { date: date },
      attributes: [
        'id',
        'date',
        'barcodes',
        'uploadInfo',
        'reconciliationSummary',
      ],
    });

    if (!rtoData) {
      return res.status(404).json({ error: 'No data found for this date' });
    }

    // Parse JSON fields before sending
    const parsedData = {
      ...rtoData.toJSON(),
      uploadInfo:
        typeof rtoData.uploadInfo === 'string'
          ? JSON.parse(rtoData.uploadInfo)
          : rtoData.uploadInfo,
      reconciliationSummary:
        typeof rtoData.reconciliationSummary === 'string'
          ? JSON.parse(rtoData.reconciliationSummary)
          : rtoData.reconciliationSummary,
      barcodes:
        typeof rtoData.barcodes === 'string'
          ? JSON.parse(rtoData.barcodes)
          : rtoData.barcodes,
    };

    // Cache the parsed data
    reportsCache.set(cacheKey, {
      data: parsedData,
      timestamp: Date.now(),
    });

    const endTime = Date.now();
    console.log(
      `⏱️ getRTODataByDate completed in ${endTime - startTime}ms for ${
        parsedData.barcodes?.length || 0
      } barcodes`,
    );
    res.json(parsedData);
  } catch (error) {
    console.error('Get RTO data error:', error);
    res.status(500).json({ error: 'Failed to retrieve RTO data' });
  }
};

// Get scan results for a specific date
const getScanResultsByDate = async (req, res) => {
  const startTime = Date.now();
  try {
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    console.log(`📊 getScanResultsByDate called for date: ${date}`);

    // Check cache first
    const cacheKey = `scans_${date}`;
    const cachedData = reportsCache.get(cacheKey);

    if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
      console.log(`📊 Using cached scan results for date: ${date}`);
      const endTime = Date.now();
      console.log(
        `⏱️ getScanResultsByDate (cached) completed in ${
          endTime - startTime
        }ms for ${cachedData.data.length} results`,
      );
      return res.json(cachedData.data);
    }

    const scanResults = await ScanResult.findAll({
      where: { date: date },
      order: [['timestamp', 'DESC']],
      attributes: [
        'id',
        'barcode',
        'date',
        'match',
        'productName',
        'quantity',
        'price',
        'timestamp',
        'message',
      ],
      limit: 1000, // Limit to prevent huge responses
    });

    // Cache the results
    reportsCache.set(cacheKey, {
      data: scanResults,
      timestamp: Date.now(),
    });

    const endTime = Date.now();
    console.log(
      `⏱️ getScanResultsByDate completed in ${endTime - startTime}ms for ${
        scanResults.length
      } results`,
    );
    res.json(scanResults);
  } catch (error) {
    console.error('Get scan results error:', error);
    res.status(500).json({ error: 'Failed to retrieve scan results' });
  }
};

// Get overall upload summary across all dates
const getOverallUploadSummary = async (req, res) => {
  try {
    console.log('📊 getOverallUploadSummary called');

    // Check if we should bypass cache
    const bypassCache = req.query.force === 'true';
    const cacheKey = 'overall_summary';

    // In PM2 or production environments, be more aggressive about cache invalidation
    const isPM2 = process.env.PM2_HOME || process.env.PM2_USAGE;
    const isProduction = process.env.NODE_ENV === 'production';
    const shouldBypassCache = bypassCache || isPM2 || isProduction;

    // Clear cache entry if force=true is explicitly requested
    if (bypassCache) {
      dataCache.delete(cacheKey);
      console.log('📊 Cleared cache due to force=true parameter');
    }

    if (!shouldBypassCache) {
      const cachedSummary = dataCache.get(cacheKey);
      if (cachedSummary && Date.now() - cachedSummary.timestamp < CACHE_TTL) {
        console.log('📊 Using cached overall summary');
        return res.status(200).json(cachedSummary.data);
      }
    } else {
      console.log(
        '📊 Bypassing cache due to:',
        bypassCache
          ? 'force=true'
          : isPM2
          ? 'PM2 environment'
          : 'production environment',
      );
    }

    // Get all RTO data to sum up total records
    const allRTOData = await RTOData.findAll({
      attributes: ['id', 'date', 'uploadInfo', 'reconciliationSummary'],
      order: [['date', 'DESC']],
    });

    console.log(`📊 Found ${allRTOData.length} RTO data records`);

    // Sum up totalRecords from each date's uploadInfo
    let totalRecords = 0;
    let totalScanned = 0;
    let totalMatched = 0;
    let totalUnmatched = 0;

    allRTOData.forEach((data) => {
      try {
        const uploadInfo =
          typeof data.uploadInfo === 'string'
            ? JSON.parse(data.uploadInfo)
            : data.uploadInfo;
        totalRecords += uploadInfo.totalRecords || 0;

        // Also get summary from reconciliationSummary if available
        const reconciliationSummary =
          typeof data.reconciliationSummary === 'string'
            ? JSON.parse(data.reconciliationSummary)
            : data.reconciliationSummary;

        if (reconciliationSummary) {
          totalScanned += reconciliationSummary.totalScanned || 0;
          totalMatched += reconciliationSummary.matched || 0;
          totalUnmatched += reconciliationSummary.unmatched || 0;
        }
      } catch (parseError) {
        console.warn(
          `⚠️ Error parsing data for date ${data.date}:`,
          parseError.message,
        );
      }
    });

    // Fallback: Get counts from ScanResult table if reconciliationSummary is not available
    let scannedFromDB = 0;
    let matchedFromDB = 0;
    let unmatchedFromDB = 0;

    try {
      scannedFromDB = await ScanResult.count();
      matchedFromDB = await ScanResult.count({
        where: { match: true },
      });
      unmatchedFromDB = await ScanResult.count({
        where: { match: false },
      });
      console.log(
        `📊 Database counts - Scanned: ${scannedFromDB}, Matched: ${matchedFromDB}, Unmatched: ${unmatchedFromDB}`,
      );
    } catch (dbError) {
      console.error('❌ Error fetching counts from ScanResult table:', dbError);
    }

    // Always use database counts as the source of truth for accuracy
    // The reconciliationSummary might be outdated or inconsistent
    const finalScanned = scannedFromDB;
    const finalMatched = matchedFromDB;
    const finalUnmatched = unmatchedFromDB;

    const summary = {
      totalRecords,
      scanned: finalScanned,
      matched: finalMatched,
      unmatched: finalUnmatched,
    };

    console.log('📊 Final summary:', summary);

    // Cache the summary
    dataCache.set(cacheKey, {
      data: summary,
      timestamp: Date.now(),
    });

    res.status(200).json(summary);
  } catch (error) {
    console.error('❌ Error fetching overall upload summary:', error);

    // Return fallback data instead of error
    res.status(200).json({
      totalRecords: 0,
      scanned: 0,
      matched: 0,
      unmatched: 0,
      error: 'Failed to fetch summary data',
    });
  }
};

// Get all uploaded data with dates
const getAllUploadedData = async (req, res) => {
  try {
    const uploadedData = await RTOData.findAll({
      attributes: ['id', 'date', 'uploadInfo', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json(uploadedData);
  } catch (error) {
    console.error('Error fetching all uploaded data:', error);
    res.status(500).json({ message: 'Failed to fetch uploaded data' });
  }
};

// Delete uploaded data by date
const deleteUploadedData = async (req, res) => {
  try {
    const { date } = req.params;

    // Delete RTO data for the specific date
    const deletedRTOData = await RTOData.destroy({
      where: { date: date },
    });

    // Delete scan results for the specific date
    const deletedScanResults = await ScanResult.destroy({
      where: { date: date },
    });

    res.status(200).json({
      message: `Successfully deleted data for ${date}`,
      deletedRTOData,
      deletedScanResults,
    });
  } catch (error) {
    console.error('Error deleting uploaded data:', error);
    res.status(500).json({ message: 'Failed to delete uploaded data' });
  }
};

// Delete all uploaded data
const deleteAllUploadedData = async (req, res) => {
  try {
    // Delete all RTO data
    const deletedRTOData = await RTOData.destroy({
      where: {},
      truncate: true,
    });

    // Delete all scan results
    const deletedScanResults = await ScanResult.destroy({
      where: {},
      truncate: true,
    });

    res.status(200).json({
      message: 'Successfully deleted all uploaded data',
      deletedRTOData,
      deletedScanResults,
    });
  } catch (error) {
    console.error('Error deleting all uploaded data:', error);
    res.status(500).json({ message: 'Failed to delete all uploaded data' });
  }
};

// Get courier-wise counts for a specific date
const getCourierCounts = async (req, res) => {
  try {
    console.log('getCourierCounts called with date:', req.params.date);
    const { date } = req.params;

    // Get RTO data for the specific date
    const rtoData = await RTOData.findOne({
      where: { date: date },
    });

    console.log('RTO data found:', !!rtoData);

    if (!rtoData) {
      return res.status(404).json({ message: 'No data found for this date' });
    }

    // Count items by courier
    const courierCounts = {};
    let barcodes = [];

    // Handle both array and JSON string formats
    if (Array.isArray(rtoData.barcodes)) {
      barcodes = rtoData.barcodes;
    } else if (typeof rtoData.barcodes === 'string') {
      try {
        barcodes = JSON.parse(rtoData.barcodes);
      } catch (error) {
        console.error('Error parsing barcodes JSON:', error);
        barcodes = [];
      }
    }

    console.log('Barcodes length:', barcodes.length);
    console.log('Barcodes type:', typeof rtoData.barcodes);
    console.log(
      'Parsed barcodes type:',
      Array.isArray(barcodes) ? 'array' : typeof barcodes,
    );

    // Check if any items have fulfilledBy field
    const hasFulfilledByData = barcodes.some((item) => item.fulfilledBy);

    console.log('Has fulfilledBy data:', hasFulfilledByData);

    if (!hasFulfilledByData) {
      return res.status(200).json({
        date,
        totalItems: barcodes.length,
        courierCounts: [],
        message:
          "No courier data available. Please upload a new Excel file with 'Fulfilled By' column.",
      });
    }

    barcodes.forEach((item) => {
      const courier = item.fulfilledBy || 'Unknown';
      courierCounts[courier] = (courierCounts[courier] || 0) + 1;
    });

    // Convert to array format for easier frontend handling
    const courierData = Object.entries(courierCounts)
      .map(([courier, count]) => ({
        courier,
        count,
      }))
      .sort((a, b) => b.count - a.count); // Sort by count descending

    res.status(200).json({
      date,
      totalItems: barcodes.length,
      courierCounts: courierData,
    });
  } catch (error) {
    console.error('Error fetching courier counts:', error);
    res.status(500).json({
      message: 'Failed to fetch courier counts',
      error: error.message,
    });
  }
};

// Delete a specific unmatched scan result
const deleteUnmatchedScan = async (req, res) => {
  try {
    const { barcode, date } = req.body;

    if (!barcode || !date) {
      return res.status(400).json({ error: 'Barcode and date are required' });
    }

    // Delete the scan result
    const deletedCount = await ScanResult.destroy({
      where: {
        barcode: barcode,
        date: date,
        match: false, // Only delete unmatched items
      },
    });

    if (deletedCount === 0) {
      return res.status(404).json({
        message: 'No unmatched scan result found with this barcode',
      });
    }

    // Update the reconciliation summary for the date
    const rtoData = await RTOData.findOne({
      where: { date: date },
    });

    if (rtoData) {
      let summary = rtoData.reconciliationSummary || {
        totalScanned: 0,
        matched: 0,
        unmatched: 0,
      };

      // Parse summary if it's a JSON string
      if (typeof summary === 'string') {
        try {
          summary = JSON.parse(summary);
        } catch (error) {
          console.error('Error parsing reconciliationSummary:', error);
          summary = { totalScanned: 0, matched: 0, unmatched: 0 };
        }
      }

      // Decrease counts
      summary.totalScanned = Math.max(0, summary.totalScanned - 1);
      summary.unmatched = Math.max(0, summary.unmatched - 1);

      // Update the summary
      await RTOData.update(
        {
          reconciliationSummary: summary,
        },
        {
          where: { id: rtoData.id },
        },
      );
    }

    // Clear reports cache for this date
    clearCacheForDate(date);

    res.status(200).json({
      message: 'Unmatched scan result deleted successfully',
      deletedCount,
    });
  } catch (error) {
    console.error('Error deleting unmatched scan:', error);
    res.status(500).json({
      message: 'Failed to delete unmatched scan result',
      error: error.message,
    });
  }
};

module.exports = {
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
};
