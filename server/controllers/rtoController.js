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

// Helper function to normalize Courier name (Delhivery and XB)
const normalizeCourier = (courier) => {
  if (!courier) return 'Unknown Courier';
  const courierStr = String(courier).trim();
  
  // Check if it contains "Delhivery" (case-insensitive)
  if (courierStr.toLowerCase().includes('delhivery')) {
    return 'Delhivery';
  }
  
  // Check if it's XB (case-insensitive)
  if (courierStr.toLowerCase() === 'xb' || courierStr.toLowerCase().includes('xb ')) {
    return 'XB';
  }
  
  return courierStr; // Return original if no match
};

// Helper function to process Nimbu sheet (new format)
const processNimbuSheet = (filePath, date) => {
  console.log('📊 Processing Nimbu sheet:', filePath);
  
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet);
  
  const productsByDate = {};
  const waybillCountsByDate = {};
  
  const normalizeDate = (rawValue, fallbackValue) => {
    const format = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const tryDate = (val) => {
      if (!val) return null;
      if (val instanceof Date && !isNaN(val)) return format(val);
      if (typeof val === 'number') {
        // Excel serial date number
        if (XLSX?.SSF?.parse_date_code) {
          const parsed = XLSX.SSF.parse_date_code(val);
          if (parsed) {
            return format(new Date(parsed.y, parsed.m - 1, parsed.d || 1));
          }
        }
      }
      const str = String(val).trim();
      if (!str) return null;
      const base = str.includes(' ') ? str.split(' ')[0] : str;
      const ddmmyy = base.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (ddmmyy) {
        const [, d, m, y] = ddmmyy;
        const year = y.length === 2 ? `20${y}` : y;
        return format(new Date(Number(year), Number(m) - 1, Number(d)));
      }
      const parsed = new Date(base);
      if (!isNaN(parsed)) return format(parsed);
      return null;
    };

    let normalized = tryDate(rawValue);
    if (!normalized && fallbackValue) {
      normalized = tryDate(fallbackValue);
    }
    return normalized;
  };

  jsonData.forEach((row) => {
    // Extract AWB Number
    const awbNumber = row['AWB Number'] 
      ? String(row['AWB Number']).trim() 
      : null;
    
    // Extract RTO Delivered Date
    const rtoDeliveredDate = row['RTO Delivered Date'];
    
    // Extract Courier
    const courier = normalizeCourier(row['Courier']);
    
    if (awbNumber) {
      // Normalize RTO Delivered Date; fall back to selected upload date if invalid/missing
      const dateOnly = normalizeDate(rtoDeliveredDate, date);
      
      if (!dateOnly) {
        return; // skip this row due to invalid date
      }

      if (!productsByDate[dateOnly]) {
        productsByDate[dateOnly] = [];
        waybillCountsByDate[dateOnly] = new Set();
      }

      // Extract product information if available
      const totalProducts = row['Total Products Count'] || 1;
      let productName = '';
      let quantity = 1;
      let price = 0;
      
      // Try to get first product details
      if (row['Product(1)']) {
        productName = String(row['Product(1)']).trim();
        quantity = parseInt(row['Quantity(1)']) || 1;
        price = parseFloat(String(row['Price(1)']).replace(/[^0-9.-]/g, '')) || 0;
      }

      // Add to products list
      productsByDate[dateOnly].push({
        barcode: awbNumber,
        productName: productName || 'Product from Nimbu sheet',
        quantity: quantity,
        price: price,
        status: 'pending',
        orderId: row['Order Id'],
        orderDate: row['Order Date'],
        rtsDate: rtoDeliveredDate ? String(rtoDeliveredDate) : 'No RTO Delivered Date',
        consigneeName: row['Customer Name'],
        city: row['City'],
        state: row['State'],
        pincode: row['Zip Code'],
        fulfilledBy: courier, // Normalized courier (Delhivery or XB)
        source: 'NimbusPost', // Mark as from NimbusPost sheet
      });

      waybillCountsByDate[dateOnly].add(awbNumber);
    }
  });

  console.log(`📊 Nimbu sheet processed: ${jsonData.length} rows`);
  console.log(
    `📊 Nimbu records with AWB: ${Object.values(productsByDate).reduce(
      (sum, products) => sum + products.length,
      0,
    )}`,
  );

  return { productsByDate, waybillCountsByDate };
};

// Upload and parse Excel file
const uploadRTOData = async (req, res) => {
  try {
    // Support both single file (req.file) and multiple files (req.files)
    const files = req.files || (req.file ? [req.file] : []);
    
    console.log('📤 Upload request received:', {
      hasFiles: files.length > 0,
      fileCount: files.length,
      files: files.map(f => ({ name: f.originalname, size: f.size })),
      body: req.body,
    });

    if (files.length === 0) {
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

    // Check if files exist before processing
    const fs = require('fs');
    for (const file of files) {
      if (!fs.existsSync(file.path)) {
        console.error('❌ File does not exist at path:', file.path);
        return res.status(500).json({
          error: 'Uploaded file not found',
          details: `File path: ${file.path}`,
        });
      }
    }

    console.log('✅ Files exist, proceeding with Excel parsing...');

    // Merge products from all files
    const allProductsByDate = {};
    const allWaybillCountsByDate = {};
    const fileSources = [];
    let invalidDateCount = 0;

    // Helper function to detect Nimbu sheet format by checking column structure
    const detectNimbuSheet = (filePath) => {
      try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Check if first row (headers) contains Nimbu-specific columns
        if (jsonData.length > 0) {
          const headers = jsonData[0];
          const headerString = headers.join(' ').toLowerCase();
          
          // Check for key Nimbu sheet columns
          const hasAWBNumber = headerString.includes('awb number');
          const hasRTODeliveredDate = headerString.includes('rto delivered date');
          const hasCourier = headerString.includes('courier');
          
          // If all three key columns are present, it's a Nimbu sheet
          if (hasAWBNumber && hasRTODeliveredDate && hasCourier) {
            return true;
          }
        }
        return false;
      } catch (error) {
        console.warn('Error detecting sheet format:', error);
        return false;
      }
    };

    // Process each file
    for (const file of files) {
      // Detect sheet format by structure, not filename
      const isNimbuSheet = detectNimbuSheet(file.path);
      
      if (isNimbuSheet) {
        // Process Nimbu sheet (new format)
        console.log('📊 Processing Nimbu sheet:', file.originalname);
        const { productsByDate: nimbuProducts, waybillCountsByDate: nimbuWaybills } = 
          processNimbuSheet(file.path, date);
        
        // Merge Nimbu data
        for (const [rtsDate, products] of Object.entries(nimbuProducts)) {
          if (!allProductsByDate[rtsDate]) {
            allProductsByDate[rtsDate] = [];
            allWaybillCountsByDate[rtsDate] = new Set();
          }
          
          // Add products, avoiding duplicates by AWB
          const existingAwbs = new Set(
            allProductsByDate[rtsDate].map(p => p.barcode.toString().toLowerCase())
          );
          
          products.forEach(product => {
            const awbLower = product.barcode.toString().toLowerCase();
            if (!existingAwbs.has(awbLower)) {
              allProductsByDate[rtsDate].push(product);
              existingAwbs.add(awbLower);
            }
          });
          
          // Merge waybill counts
          nimbuWaybills[rtsDate]?.forEach(awb => 
            allWaybillCountsByDate[rtsDate].add(awb)
          );
        }
        
        fileSources.push({ name: file.originalname, type: 'NimbusPost' });
      } else {
        // Process old sheet format
        console.log('📊 Processing old sheet format:', file.originalname);
        const workbook = XLSX.readFile(file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Extract barcodes and product data, grouping by RTS Date

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

        const normalizeDate = (rawValue, fallbackValue) => {
      const format = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const tryDate = (val) => {
        if (!val) return null;
        if (val instanceof Date && !isNaN(val)) return format(val);
        if (typeof val === 'number') {
          // Excel serial date number
          if (XLSX?.SSF?.parse_date_code) {
            const parsed = XLSX.SSF.parse_date_code(val);
            if (parsed) {
              return format(
                new Date(parsed.y, parsed.m - 1, parsed.d || 1),
              );
            }
          }
        }
        const str = String(val).trim();
        if (!str) return null;

        // Try ISO-like first part before space
        const base = str.includes(' ') ? str.split(' ')[0] : str;

        // Handle dd/mm/yyyy or dd-mm-yyyy
        const ddmmyy = base.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (ddmmyy) {
          const [, d, m, y] = ddmmyy;
          const year = y.length === 2 ? `20${y}` : y;
          return format(new Date(Number(year), Number(m) - 1, Number(d)));
        }

        // Fallback to Date parse
        const parsed = new Date(base);
        if (!isNaN(parsed)) return format(parsed);

        return null;
      };

      // Try raw value first
      let normalized = tryDate(rawValue);

      // If invalid, try fallback (selected date from body)
      if (!normalized && fallbackValue) {
        normalized = tryDate(fallbackValue);
      }

          return normalized;
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

      // Courier / Fulfilled By - normalize it
      const fulfilledBy = normalizeCourier(
        getFirst(row, [
          'Fulfilled By',
          'Courier',
          'Courier Name',
          'CourierName',
          'Shipped By',
        ]) || 'Unknown Courier'
      );

      // Include all records that have a waybill number
      // For Parcel X sheet: Only include rows that have a valid RTS Date (skip rows without RTS Date)
      if (waybillNumber) {
        // Normalize RTS date - DO NOT use fallback date for Parcel X sheet
        // If RTS Date is missing or invalid, skip this row entirely
        const dateOnly = normalizeDate(rtsDate, null); // Pass null instead of date to prevent fallback

        if (!dateOnly) {
          invalidDateCount += 1;
          console.log(`⚠️ Skipping row with waybill ${waybillNumber} - no valid RTS Date found`);
          return; // skip this row due to missing/invalid RTS date
        }

        if (!allProductsByDate[dateOnly]) {
          allProductsByDate[dateOnly] = [];
          allWaybillCountsByDate[dateOnly] = new Set(); // Track unique waybills
        }

        // Check if this AWB already exists (from Nimbu sheet)
        const existingAwbs = new Set(
          allProductsByDate[dateOnly].map(p => p.barcode.toString().toLowerCase())
        );
        const awbLower = waybillNumber.toString().toLowerCase();
        
        // Only add if not already present (Nimbu sheet takes precedence for duplicates)
        if (!existingAwbs.has(awbLower)) {
          // Add to products list
          allProductsByDate[dateOnly].push({
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
            fulfilledBy: fulfilledBy, // Normalized courier
            source: 'Parcel X', // Mark as from Parcel X sheet
          });

          // Track unique waybills
          allWaybillCountsByDate[dateOnly].add(waybillNumber);
          }
        }
      });
      
      fileSources.push({ name: file.originalname, type: 'Parcel X' });
    }
  }

    // Use merged data
    const productsByDate = allProductsByDate;
    const waybillCountsByDate = allWaybillCountsByDate;

    console.log(`📊 Total files processed: ${files.length}`);
    console.log(`📊 File sources:`, fileSources);
    console.log(
      `📊 Total records with waybill numbers: ${Object.values(productsByDate).reduce(
        (sum, products) => sum + products.length,
        0,
      )}`,
    );
    if (invalidDateCount > 0) {
      console.warn(`⚠️ Skipped ${invalidDateCount} rows from Parcel X sheet due to missing/invalid RTS Date (rows without RTS Date are not included)`);
    }
    console.log(
      '📊 Products grouped by RTS Date:',
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
              originalFileNames: files.map(f => f.originalname),
              fileSources: fileSources,
              uploadDate: new Date(),
              totalRecords: waybillCountsByDate[rtsDate].size, // Use unique waybill count
              totalProducts: products.length, // Keep product count for reference
              selectedDate: date, // The date selected during upload
            },
          },
        });

        if (!created) {
          // Source-specific replace: only replace barcodes from uploaded sources, keep others
          const uploadedSources = new Set(fileSources.map(f => f.type));
          console.log(`🔄 Replacing data for ${rtsDate} - sources: ${[...uploadedSources].join(', ')}`);

          let existingBarcodes = existingData.barcodes || [];
          if (typeof existingBarcodes === 'string') {
            try { existingBarcodes = JSON.parse(existingBarcodes); } catch (e) { existingBarcodes = []; }
          }
          if (!Array.isArray(existingBarcodes)) existingBarcodes = [];

          // Keep barcodes from sources NOT in this upload
          const keptBarcodes = existingBarcodes.filter(b => !uploadedSources.has(b.source));
          // Combine: kept old + new upload
          const mergedBarcodes = [...keptBarcodes, ...products];

          const mergedWaybillSet = new Set(
            mergedBarcodes.map(b => b.barcode?.toString().toLowerCase()).filter(Boolean)
          );

          // Update fileSources: keep old sources not in this upload, add new ones
          const existingFileSources = existingData.uploadInfo?.fileSources || [];
          const keptFileSources = existingFileSources.filter(f => !uploadedSources.has(f.type));
          const mergedFileSources = [...keptFileSources, ...fileSources];

          const existingFileNames = existingData.uploadInfo?.originalFileNames || [];
          // Keep file names from kept sources (approximate - remove old names for replaced sources)
          const keptFileNames = keptFileSources.map(f => f.name);
          const mergedFileNames = [...keptFileNames, ...files.map(f => f.originalname)];

          await existingData.update({
            barcodes: mergedBarcodes,
            uploadInfo: {
              originalFileNames: mergedFileNames,
              fileSources: mergedFileSources,
              uploadDate: new Date(),
              totalRecords: mergedWaybillSet.size,
              totalProducts: mergedBarcodes.length,
              selectedDate: new Date().toISOString().split('T')[0],
            },
            reconciliationSummary: { totalScanned: 0, matched: 0, unmatched: 0 },
          });

          // Update products array for downstream processing
          products.length = 0;
          products.push(...mergedBarcodes);
          waybillCountsByDate[rtsDate] = mergedWaybillSet;
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

    // Clean up uploaded files after successful processing
    try {
      const fs = require('fs');
      for (const file of files) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
          console.log('🗑️ Cleaned up uploaded file:', file.path);
        }
      }
    } catch (cleanupError) {
      console.warn(
        '⚠️ Failed to clean up uploaded files:',
        cleanupError.message,
      );
    }

    console.log('✅ Upload completed successfully');

    // Automatically reconcile unmatched scans that match the newly uploaded data
    // Optimized: fetch unmatched scans ONCE and use in-memory matching
    const autoReconciledScans = [];
    try {
      // Build a combined barcode→{date, product} map from ALL uploaded dates
      const uploadedBarcodeMap = new Map();
      for (const [rtsDate, products] of Object.entries(productsByDate)) {
        products.forEach((p) => {
          const rtsDateValue = p.rtsDate;
          const hasValidRTSDate = rtsDateValue &&
                                  rtsDateValue !== 'No RTS Date' &&
                                  rtsDateValue !== 'No RTO Delivered Date' &&
                                  rtsDateValue !== 'null' &&
                                  rtsDateValue !== 'undefined' &&
                                  rtsDateValue !== '' &&
                                  (typeof rtsDateValue === 'string' ? rtsDateValue.trim() !== '' : true);

          if (hasValidRTSDate && p.barcode) {
            uploadedBarcodeMap.set(p.barcode.toString().toLowerCase(), { date: rtsDate, product: p });
          }
        });
      }

      // Fetch ALL unmatched scans ONCE
      const allUnmatchedScans = await ScanResult.findAll({
        where: { match: false },
        attributes: ['id', 'barcode', 'date', 'timestamp'],
      });

      // Find matches in memory
      const scansToReconcile = [];
      for (const scan of allUnmatchedScans) {
        const scanKey = scan.barcode?.toString().toLowerCase();
        if (scanKey && uploadedBarcodeMap.has(scanKey)) {
          const { date: targetDate, product } = uploadedBarcodeMap.get(scanKey);
          scansToReconcile.push({ scan, targetDate, product });
        }
      }

      if (scansToReconcile.length > 0) {
        // Batch reconciliation in a single transaction
        const transaction = await sequelize.transaction();
        try {
          // Collect IDs to delete
          const scanIdsToDelete = scansToReconcile.map(s => s.scan.id);

          // Bulk delete old unmatched scans
          await ScanResult.destroy({
            where: { id: { [Op.in]: scanIdsToDelete } },
            transaction,
          });

          // Bulk create new matched scans
          const newScans = scansToReconcile.map(({ scan, targetDate, product }) => ({
            barcode: scan.barcode,
            date: targetDate,
            match: true,
            productName: product.productName,
            quantity: product.quantity,
            price: product.price,
            message: scan.date !== targetDate
              ? `Auto-reconciled from ${scan.date}`
              : 'Auto-reconciled (data uploaded after scan)',
            timestamp: scan.timestamp,
            isFromDifferentDate: scan.date !== targetDate,
            originalDate: scan.date !== targetDate ? scan.date : null,
          }));

          await ScanResult.bulkCreate(newScans, { transaction });

          await transaction.commit();

          // Track for logging
          scansToReconcile.forEach(({ scan, targetDate, product }) => {
            autoReconciledScans.push({
              scanId: scan.id,
              barcode: scan.barcode,
              scannedDate: scan.date,
              targetDate,
              productName: product.productName,
            });
          });

          console.log(`✅ Auto-reconciled ${autoReconciledScans.length} unmatched scan(s) in batch`);
        } catch (error) {
          await transaction.rollback();
          console.error('❌ Error during batch auto-reconciliation:', error);
        }
      }

      if (autoReconciledScans.length > 0) {
        const affectedDates = new Set([
          ...autoReconciledScans.map(s => s.scannedDate),
          ...autoReconciledScans.map(s => s.targetDate),
        ]);
        affectedDates.forEach(date => clearCacheForDate(date));
        clearOverallSummaryCache();
      }
    } catch (reconcileError) {
      console.error('Error during auto-reconciliation:', reconcileError);
    }

    // Invalidate orphaned matched scans: matched scans whose barcodes no longer exist in the upload
    // Optimized: batch all dates into fewer queries
    let invalidatedScans = 0;
    try {
      const uploadedDates = Object.keys(productsByDate);

      // Fetch all matched scans for uploaded dates in ONE query
      const allMatchedScans = await ScanResult.findAll({
        where: {
          date: { [Op.in]: uploadedDates },
          match: true,
        },
        attributes: ['id', 'barcode', 'date'],
      });

      // Build valid barcode sets per date
      const validBarcodesPerDate = {};
      for (const [rtsDate, products] of Object.entries(productsByDate)) {
        validBarcodesPerDate[rtsDate] = new Set();
        products.forEach((p) => {
          const rtsDateValue = p.rtsDate;
          const hasValidRTSDate = rtsDateValue &&
                                  rtsDateValue !== 'No RTS Date' &&
                                  rtsDateValue !== 'No RTO Delivered Date' &&
                                  rtsDateValue !== 'null' &&
                                  rtsDateValue !== 'undefined' &&
                                  rtsDateValue !== '' &&
                                  (typeof rtsDateValue === 'string' ? rtsDateValue.trim() !== '' : true);

          if (hasValidRTSDate && p.barcode) {
            validBarcodesPerDate[rtsDate].add(p.barcode.toString().toLowerCase());
          }
        });
      }

      // Find all orphaned scan IDs in memory
      const orphanedIds = [];
      for (const scan of allMatchedScans) {
        const scanBarcode = scan.barcode?.toString().toLowerCase();
        const validSet = validBarcodesPerDate[scan.date];
        if (scanBarcode && validSet && !validSet.has(scanBarcode)) {
          orphanedIds.push(scan.id);
        }
      }

      if (orphanedIds.length > 0) {
        // Single bulk update for all orphaned scans
        await ScanResult.update(
          { match: false, message: 'Barcode not found in current upload data' },
          { where: { id: { [Op.in]: orphanedIds } } }
        );
        invalidatedScans = orphanedIds.length;
        console.log(`🔄 Invalidated ${invalidatedScans} orphaned matched scan(s) in batch`);
        uploadedDates.forEach(date => clearCacheForDate(date));
        clearOverallSummaryCache();
      }
    } catch (invalidateError) {
      console.error('Error during orphan scan invalidation:', invalidateError);
    }

    // Clear overall summary cache since new data was uploaded
    clearOverallSummaryCache();

    res.json({
      message: 'RTO data uploaded successfully',
      uploadDate: date,
      totalRecords: totalWaybills, // Use unique waybill count
      totalProducts: totalProducts, // Keep product count for reference
      uploadResults: uploadResults,
      autoReconciledScans: autoReconciledScans,
      invalidatedScans: invalidatedScans,
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

    // FIRST: Check if this barcode has already been scanned on ANY past date
    const pastScan = await ScanResult.findOne({
      where: {
        date: { [Op.ne]: date }, // Different from current date
        barcode: {
          [Op.eq]: barcode, // Exact match for duplicate check
        },
      },
      attributes: [
        'date',
        'match',
        'productName',
        'quantity',
        'price',
        'message',
        'timestamp',
      ],
      order: [['timestamp', 'DESC']], // Get the most recent scan
    });

    // If found in past date, return error with the date it was scanned
    if (pastScan) {
      const scannedDate = pastScan.date;
      const scannedDateFormatted = new Date(scannedDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      
      return res.status(400).json({
        error: `This AWB number has already been scanned on ${scannedDateFormatted} (${scannedDate})`,
        alreadyScannedInPast: true,
        scannedDate: scannedDate,
        scannedDateFormatted: scannedDateFormatted,
        previousScan: {
          date: pastScan.date,
          match: pastScan.match,
          productName: pastScan.productName,
          quantity: pastScan.quantity,
          price: pastScan.price,
          message: pastScan.message,
          timestamp: pastScan.timestamp,
        },
      });
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
    // Only include items that have valid RTS dates
    const barcodeMap = new Map();
    barcodes.forEach((item, index) => {
      // Check if item has a valid RTS date
      const rtsDate = item.rtsDate;
      const hasValidRTSDate = rtsDate && 
                              rtsDate !== 'No RTS Date' && 
                              rtsDate !== 'No RTO Delivered Date' && 
                              rtsDate !== 'null' &&
                              rtsDate !== 'undefined' &&
                              rtsDate !== '' &&
                              rtsDate.trim() !== '';

      // Skip items without valid RTS dates - they cannot be scanned
      if (!hasValidRTSDate) {
        return;
      }

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
      // Barcode not found in current date - check other dates
      let foundInOtherDate = null;
      let correctDate = null;
      let productInfo = null;

      // Search in all other dates' RTO data
      const allRTOData = await RTOData.findAll({
        where: {
          date: { [Op.ne]: date }, // Exclude current date
        },
        attributes: ['date', 'barcodes'],
      });

      for (const otherRtoData of allRTOData) {
        let otherBarcodes = otherRtoData.barcodes || [];
        if (typeof otherBarcodes === 'string') {
          try {
            otherBarcodes = JSON.parse(otherBarcodes);
          } catch (error) {
            continue;
          }
        }

        if (!Array.isArray(otherBarcodes)) {
          continue;
        }

        const matchedProduct = otherBarcodes.find(
          (item) =>
            item.barcode.toString().toLowerCase() ===
            barcode.toString().toLowerCase(),
        );

        if (matchedProduct) {
          foundInOtherDate = true;
          correctDate = otherRtoData.date;
          productInfo = {
            productName: matchedProduct.productName,
            quantity: matchedProduct.quantity,
            price: matchedProduct.price,
          };
          break; // Found it, no need to check other dates
        }
      }

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

      // Prepare message based on whether barcode was found in another date
      let message = 'Barcode not found in RTO data';
      if (foundInOtherDate && correctDate) {
        message = `Barcode belongs to date ${correctDate}. Please scan on the correct date.`;
      }

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
              productName: productInfo?.productName || 'Unknown Product',
              quantity: productInfo?.quantity || 1,
              price: productInfo?.price || 0,
              message: message,
              timestamp: new Date(),
              isFromDifferentDate: foundInOtherDate || false,
              originalDate: correctDate || null,
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
          productName: productInfo?.productName || 'Unknown Product',
          quantity: productInfo?.quantity || 1,
          price: productInfo?.price || 0,
          message: message,
          timestamp: new Date(),
          isFromDifferentDate: foundInOtherDate || false,
          originalDate: correctDate || null,
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

    // Count unique waybills per courier (not all products)
    // Use a Map to track unique barcodes per courier
    // Only include items that have valid RTS dates
    const courierWaybills = {};

    barcodes.forEach((item) => {
      // Check if item has a valid RTS date
      const rtsDate = item.rtsDate;
      const hasValidRTSDate = rtsDate && 
                              rtsDate !== 'No RTS Date' && 
                              rtsDate !== 'No RTO Delivered Date' && 
                              rtsDate !== 'null' &&
                              rtsDate !== 'undefined' &&
                              rtsDate !== '' &&
                              rtsDate.trim() !== '';

      // Skip items without valid RTS dates
      if (!hasValidRTSDate) {
        return;
      }

      const courier = item.fulfilledBy || 'Unknown';
      const barcode = item.barcode;

      // Initialize courier entry if it doesn't exist
      if (!courierWaybills[courier]) {
        courierWaybills[courier] = new Set();
      }

      // Add unique barcode to the courier's set
      if (barcode) {
        courierWaybills[courier].add(barcode);
      }
    });

    // Convert sets to counts
    Object.keys(courierWaybills).forEach((courier) => {
      courierCounts[courier] = courierWaybills[courier].size;
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

// Get reconcilable unmatched scans (scans that exist in other dates' RTO data)
const getReconcilableScans = async (req, res) => {
  try {
    const { date } = req.params;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Get all unmatched scans for this date
    const unmatchedScans = await ScanResult.findAll({
      where: {
        date: date,
        match: false,
      },
      attributes: ['id', 'barcode', 'date', 'timestamp'],
    });

    // Get all RTO data (excluding current date)
    const allRTOData = await RTOData.findAll({
      where: {
        date: { [Op.ne]: date },
      },
      attributes: ['date', 'barcodes'],
    });

    const reconcilableScans = [];

    for (const scan of unmatchedScans) {
      for (const rtoData of allRTOData) {
        let barcodes = rtoData.barcodes || [];
        if (typeof barcodes === 'string') {
          try {
            barcodes = JSON.parse(barcodes);
          } catch (error) {
            continue;
          }
        }

        if (!Array.isArray(barcodes)) {
          continue;
        }

        const matchedProduct = barcodes.find(
          (item) =>
            item.barcode.toString().toLowerCase() ===
            scan.barcode.toString().toLowerCase(),
        );

        if (matchedProduct) {
          reconcilableScans.push({
            scanId: scan.id,
            barcode: scan.barcode,
            scannedDate: scan.date,
            targetDate: rtoData.date,
            productName: matchedProduct.productName,
            quantity: matchedProduct.quantity,
            price: matchedProduct.price,
            scannedTimestamp: scan.timestamp,
          });
          break; // Found a match, no need to check other dates
        }
      }
    }

    res.json(reconcilableScans);
  } catch (error) {
    console.error('Error getting reconcilable scans:', error);
    res.status(500).json({
      error: 'Failed to get reconcilable scans',
      details: error.message,
    });
  }
};

// Reconcile unmatched scan to matched when its date's data is uploaded
const reconcileUnmatchedScan = async (req, res) => {
  try {
    const { scanId, targetDate } = req.body;

    if (!scanId || !targetDate) {
      return res.status(400).json({
        error: 'Scan ID and target date are required',
      });
    }

    // Find the unmatched scan
    const unmatchedScan = await ScanResult.findOne({
      where: {
        id: scanId,
        match: false,
      },
    });

    if (!unmatchedScan) {
      return res.status(404).json({
        error: 'Unmatched scan not found',
      });
    }

    // Get RTO data for target date
    const rtoData = await RTOData.findOne({
      where: { date: targetDate },
    });

    if (!rtoData) {
      return res.status(404).json({
        error: `No RTO data found for date ${targetDate}`,
      });
    }

    // Parse barcodes
    let barcodes = rtoData.barcodes || [];
    if (typeof barcodes === 'string') {
      try {
        barcodes = JSON.parse(barcodes);
      } catch (error) {
        console.error('Error parsing barcodes:', error);
        barcodes = [];
      }
    }

    if (!Array.isArray(barcodes)) {
      barcodes = [];
    }

    // Find matching product
    const matchedProduct = barcodes.find(
      (item) =>
        item.barcode.toString().toLowerCase() ===
        unmatchedScan.barcode.toString().toLowerCase(),
    );

    if (!matchedProduct) {
      return res.status(404).json({
        error: 'Barcode not found in target date data',
      });
    }

    // Use transaction for atomic operations
    const transaction = await sequelize.transaction();

    try {
      // Update product status in RTO data
      const productIndex = barcodes.findIndex(
        (item) =>
          item.barcode.toString().toLowerCase() ===
          unmatchedScan.barcode.toString().toLowerCase(),
      );

      if (productIndex !== -1) {
        barcodes[productIndex].status = 'matched';
        barcodes[productIndex].scannedAt = new Date();
      }

      // Update reconciliation summary for target date
      let targetSummary = rtoData.reconciliationSummary || {
        totalScanned: 0,
        matched: 0,
        unmatched: 0,
      };

      if (typeof targetSummary === 'string') {
        try {
          targetSummary = JSON.parse(targetSummary);
        } catch (error) {
          targetSummary = { totalScanned: 0, matched: 0, unmatched: 0 };
        }
      }

      targetSummary.totalScanned += 1;
      targetSummary.matched += 1;

      // Update reconciliation summary for original date
      const originalRtoData = await RTOData.findOne({
        where: { date: unmatchedScan.date },
        transaction,
      });

      let originalSummary = {
        totalScanned: 0,
        matched: 0,
        unmatched: 0,
      };

      if (originalRtoData) {
        originalSummary = originalRtoData.reconciliationSummary || {
          totalScanned: 0,
          matched: 0,
          unmatched: 0,
        };

        if (typeof originalSummary === 'string') {
          try {
            originalSummary = JSON.parse(originalSummary);
          } catch (error) {
            originalSummary = { totalScanned: 0, matched: 0, unmatched: 0 };
          }
        }

        originalSummary.totalScanned = Math.max(0, originalSummary.totalScanned - 1);
        originalSummary.unmatched = Math.max(0, originalSummary.unmatched - 1);
      }

      // Delete the unmatched scan
      await ScanResult.destroy({
        where: { id: scanId },
        transaction,
      });

      // Create new matched scan for target date
      await ScanResult.create(
        {
          barcode: unmatchedScan.barcode,
          date: targetDate,
          match: true,
          productName: matchedProduct.productName,
          quantity: matchedProduct.quantity,
          price: matchedProduct.price,
          message: `Reconciled from ${unmatchedScan.date}`,
          timestamp: unmatchedScan.timestamp, // Keep original scan timestamp
          isFromDifferentDate: true,
          originalDate: unmatchedScan.date,
        },
        { transaction },
      );

      // Update RTO data for target date
      await RTOData.update(
        {
          barcodes: barcodes,
          reconciliationSummary: targetSummary,
        },
        {
          where: { id: rtoData.id },
          transaction,
        },
      );

      // Update RTO data for original date if it exists
      if (originalRtoData) {
        await RTOData.update(
          {
            reconciliationSummary: originalSummary,
          },
          {
            where: { id: originalRtoData.id },
            transaction,
          },
        );
      }

      await transaction.commit();

      // Clear cache
      clearCacheForDate(targetDate);
      clearCacheForDate(unmatchedScan.date);
      clearOverallSummaryCache();

      res.json({
        message: 'Unmatched scan reconciled successfully',
        scan: {
          barcode: unmatchedScan.barcode,
          originalDate: unmatchedScan.date,
          targetDate: targetDate,
          productName: matchedProduct.productName,
        },
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error reconciling unmatched scan:', error);
    res.status(500).json({
      error: 'Failed to reconcile unmatched scan',
      details: error.message,
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
  reconcileUnmatchedScan,
  getReconcilableScans,
};
