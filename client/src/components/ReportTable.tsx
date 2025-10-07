import React, { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Badge } from './ui/badge';
import { Download, FileText, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';

interface BarcodeResult {
  barcode: string;
  match: boolean;
  productName?: string;
  quantity?: number;
  price?: number;
  message: string;
  timestamp: Date;
  isFromDifferentDate?: boolean;
  originalDate?: string;
  fulfilledBy?: string;
}

interface ReportTableProps {
  data: BarcodeResult[];
  selectedDate: Date;
  totalAvailable?: number;
  unscannedProducts?: any[];
  courierCounts?: any[];
  rtoData?: any[]; // Add RTO data prop
  onDeleteUnmatched?: (barcode: string) => void; // Add delete callback
}

export const ReportTable: React.FC<ReportTableProps> = React.memo(
  ({
    data,
    selectedDate,
    totalAvailable = 0,
    unscannedProducts = [],
    courierCounts = [],
    rtoData = [], // Add RTO data prop
    onDeleteUnmatched, // Add delete callback
  }) => {
    console.time(
      `ReportTable_render_${
        selectedDate?.toISOString().split('T')[0] || 'no-date'
      }`,
    );

    // Safety checks for data
    const safeData = Array.isArray(data) ? data : [];
    const safeRtoData = Array.isArray(rtoData) ? rtoData : [];

    // Memoize computationally expensive data transformations
    const { rtoDataMap, enrichedData, matchedData, unmatchedData } =
      useMemo(() => {
        console.time(
          `ReportTable_data_processing_${
            selectedDate?.toISOString().split('T')[0] || 'no-date'
          }`,
        );

        // Create a map of RTO data by barcode for quick lookup
        const map = new Map();
        safeRtoData.forEach((item) => {
          if (item.barcode) {
            map.set(item.barcode, item);
          }
        });

        // Merge scan results with RTO data to get complete information
        const enriched = safeData.map((scanResult) => {
          const rtoItem = map.get(scanResult.barcode);
          return {
            ...scanResult,
            productName:
              rtoItem?.productName ||
              scanResult.productName ||
              'Unknown Product',
            quantity: rtoItem?.quantity || scanResult.quantity || 1,
            price: rtoItem?.price || scanResult.price || 0,
            fulfilledBy: rtoItem?.fulfilledBy || 'Unknown Courier',
          };
        });

        const matched = enriched.filter((item) => item && item.match);
        const unmatched = enriched.filter((item) => item && !item.match);

        console.timeEnd(
          `ReportTable_data_processing_${
            selectedDate?.toISOString().split('T')[0] || 'no-date'
          }`,
        );
        return {
          rtoDataMap: map,
          enrichedData: enriched,
          matchedData: matched,
          unmatchedData: unmatched,
        };
      }, [safeData, safeRtoData, selectedDate]);

    const exportToCSV = () => {
      try {
        console.log('📊 CSV Export Debug Info:');
        console.log('📊 Enriched data length:', enrichedData.length);
        console.log('📊 Unscanned products length:', unscannedProducts.length);
        console.log('📊 Sample enriched item:', enrichedData[0]);
        console.log('📊 Sample unscanned item:', unscannedProducts[0]);

        // Debug data structure issues
        if (enrichedData.length > 0) {
          console.log('📊 Enriched data structure check:');
          enrichedData.forEach((item, index) => {
            if (!item.fulfilledBy) {
              console.warn(`⚠️ Item ${index} missing fulfilledBy:`, item);
            }
          });
        }

        if (unscannedProducts.length > 0) {
          console.log('📊 Unscanned products structure check:');
          unscannedProducts.forEach((item, index) => {
            if (!item.fulfilledBy) {
              console.warn(
                `⚠️ Unscanned item ${index} missing fulfilledBy:`,
                item,
              );
            }
          });
        }

        // Prepare scanned data (matched and unmatched) using enriched data
        const scannedData = enrichedData.map((item) => {
          // Ensure all fields are properly formatted and aligned
          const barcode = item.barcode || '';
          const status = item.match ? 'Matched' : 'Unmatched';
          const productName = (item.productName || '').replace(/,/g, ';'); // Replace commas to prevent CSV issues
          const quantity = (item.quantity || 1).toString();
          const price = (item.price || 0).toString();
          const timestamp = item.timestamp
            ? item.timestamp instanceof Date
              ? item.timestamp.toLocaleString()
              : new Date(item.timestamp).toLocaleString()
            : '';
          const courierName = (item.fulfilledBy || 'Unknown Courier').replace(
            /,/g,
            ';',
          ); // Replace commas to prevent CSV issues
          const remarks = item.isFromDifferentDate
            ? `From ${item.originalDate}`
            : '';

          return [
            courierName,
            barcode,
            status,
            productName,
            quantity,
            price,
            remarks,
            timestamp,
          ];
        });

        // Prepare unscanned data
        const unscannedData = unscannedProducts.map((item) => {
          // Ensure all fields are properly formatted and aligned
          const barcode = item.barcode || '';
          const status = 'Unscanned';
          const productName = (item.productName || 'Unknown Product').replace(
            /,/g,
            ';',
          ); // Replace commas to prevent CSV issues
          const quantity = (item.quantity || 1).toString();
          const price = (item.price || 0).toString();
          const timestamp = ''; // No timestamp for unscanned items
          const courierName = (item.fulfilledBy || 'Unknown Courier').replace(
            /,/g,
            ';',
          ); // Replace commas to prevent CSV issues
          const remarks = ''; // No remarks for unscanned items

          return [
            courierName,
            barcode,
            status,
            productName,
            quantity,
            price,
            remarks,
            timestamp,
          ];
        });

        // Validate that all rows have the same number of columns
        const headerRow = [
          'Courier Name',
          'Barcode',
          'Status',
          'Product Name',
          'Quantity',
          'Price',
          'Remarks',
          'Timestamp',
        ];
        const expectedColumns = headerRow.length;

        // Ensure all data rows have the correct number of columns
        const validatedScannedData = scannedData.map((row) => {
          while (row.length < expectedColumns) {
            row.push(''); // Add empty strings for missing columns
          }
          return row.slice(0, expectedColumns); // Trim excess columns
        });

        const validatedUnscannedData = unscannedData.map((row) => {
          while (row.length < expectedColumns) {
            row.push(''); // Add empty strings for missing columns
          }
          return row.slice(0, expectedColumns); // Trim excess columns
        });

        const csvContent = [
          headerRow,
          ...validatedScannedData,
          ...validatedUnscannedData,
        ]
          .map((row) =>
            row
              .map((field) => {
                // Properly escape CSV fields
                const fieldStr = String(field || '');
                // If field contains comma, newline, or quote, wrap in quotes and escape internal quotes
                if (
                  fieldStr.includes(',') ||
                  fieldStr.includes('\n') ||
                  fieldStr.includes('"')
                ) {
                  return `"${fieldStr.replace(/"/g, '""')}"`;
                }
                return fieldStr;
              })
              .join(','),
          )
          .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Safe date formatting
        const dateString =
          selectedDate && !isNaN(selectedDate.getTime())
            ? selectedDate.toISOString().split('T')[0]
            : 'unknown-date';

        a.download = `rto-report-${dateString}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error exporting CSV:', error);
        alert('Error exporting CSV file. Please try again.');
      }
    };

    console.timeEnd(
      `ReportTable_render_${
        selectedDate?.toISOString().split('T')[0] || 'no-date'
      }`,
    );

    return (
      <div className="space-y-6">
        <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl shadow-lg">
          <CardHeader className="pb-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                  <div className="p-3 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-xl">
                    <FileText className="h-6 w-6 text-indigo-600" />
                  </div>
                  Reconciliation Report
                </CardTitle>
                <CardDescription className="text-gray-600 text-base mt-2">
                  Export reconciliation results for{' '}
                  <span className="font-semibold text-gray-800 bg-gray-100 px-2 py-1 rounded">
                    {selectedDate && !isNaN(selectedDate.getTime())
                      ? selectedDate.toLocaleDateString()
                      : 'Selected Date'}
                  </span>{' '}
                  (Includes matched, unmatched, and unscanned items)
                </CardDescription>
              </div>
              <Button
                onClick={exportToCSV}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0 transition-all duration-200 shadow-lg hover:shadow-xl rounded-xl px-6 py-3"
              >
                <Download className="mr-2 h-5 w-5" />
                Export CSV (All Data)
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
              {/* Summary Stats */}
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-xl border border-indigo-200 text-center hover:shadow-md transition-all duration-200">
                <div className="text-3xl font-bold text-indigo-600 mb-2">
                  {totalAvailable}
                </div>
                <div className="text-sm font-semibold text-indigo-700">
                  Total Available
                </div>
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl border border-gray-200 text-center hover:shadow-md transition-all duration-200">
                <div className="text-3xl font-bold text-gray-700 mb-2">
                  {safeData.length}
                </div>
                <div className="text-sm font-semibold text-gray-600">
                  Total Scanned
                </div>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-xl border border-amber-200 text-center hover:shadow-md transition-all duration-200">
                <div className="text-3xl font-bold text-amber-600 mb-2">
                  {unscannedProducts.length}
                </div>
                <div className="text-sm font-semibold text-amber-700">
                  Unscanned
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200 text-center hover:shadow-md transition-all duration-200">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {matchedData.length}
                </div>
                <div className="text-sm font-semibold text-green-700">
                  Matched
                </div>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border border-red-200 text-center hover:shadow-md transition-all duration-200">
                <div className="text-3xl font-bold text-red-600 mb-2">
                  {unmatchedData.length}
                </div>
                <div className="text-sm font-semibold text-red-700">
                  Unmatched
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200 text-center hover:shadow-md transition-all duration-200">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {safeData.length > 0
                    ? Math.round((matchedData.length / safeData.length) * 100)
                    : 0}
                  %
                </div>
                <div className="text-sm font-semibold text-blue-700">
                  Match Rate
                </div>
              </div>
            </div>

            {/* Courier Counts Section */}
            {courierCounts.length > 0 && (
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200 mb-6">
                <h3 className="text-lg font-semibold text-purple-800 mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  Courier Distribution
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {courierCounts.map((courier, index) => (
                    <div
                      key={index}
                      className="bg-white border border-purple-200 rounded-xl p-4 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-purple-700 mb-1">
                            {courier.courier}
                          </div>
                          <div className="text-2xl font-bold text-purple-600">
                            {courier.count}
                          </div>
                        </div>
                        <div className="text-xs text-purple-500">
                          {totalAvailable > 0
                            ? Math.round((courier.count / totalAvailable) * 100)
                            : 0}
                          %
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div className="bg-slate-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-slate-700 mb-4">
                Recent Activity
              </h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {safeData.slice(0, 10).map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex-1">
                      <code className="text-sm font-mono bg-slate-100 px-3 py-1 rounded-lg font-semibold">
                        {item.barcode}
                      </code>
                      <div className="text-xs text-slate-500 mt-1">
                        {item.timestamp
                          ? item.timestamp instanceof Date
                            ? item.timestamp.toLocaleTimeString()
                            : new Date(item.timestamp).toLocaleTimeString()
                          : 'Unknown time'}
                      </div>
                    </div>
                    <Badge
                      variant={item.match ? 'default' : 'destructive'}
                      className={
                        item.match
                          ? 'px-3 py-1 rounded-lg font-semibold bg-green-100 text-green-800 border-green-200'
                          : 'px-3 py-1 rounded-lg font-semibold bg-red-100 text-red-800 border-red-200'
                      }
                    >
                      {item.match ? 'Matched' : 'Unmatched'}
                    </Badge>
                  </div>
                ))}
                {safeData.length === 0 && (
                  <div className="text-center text-slate-500 py-8">
                    <div className="p-4 bg-slate-200 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <FileText className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-lg font-medium">
                      No scan data available
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Matched Items */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">
                  Matched Items ({matchedData.length})
                </CardTitle>
              </CardHeader>
            </div>
            <CardContent className="p-6">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Courier Name</TableHead>
                      <TableHead>Barcode</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchedData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {item.fulfilledBy || 'Unknown Courier'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {item.barcode}
                        </TableCell>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>₹{item.price}</TableCell>
                        <TableCell className="text-sm">
                          {item.isFromDifferentDate ? (
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-orange-600 border-orange-300 bg-orange-50"
                              >
                                From {item.originalDate}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {matchedData.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-gray-500"
                        >
                          No matched items
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Unscanned Items - Centered */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-6 text-white">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">
                  Unscanned Items ({unscannedProducts.length})
                </CardTitle>
              </CardHeader>
            </div>
            <CardContent className="p-6">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">
                        Courier Name
                      </TableHead>
                      <TableHead className="text-center">Barcode</TableHead>
                      <TableHead className="text-center">Product</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-center">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unscannedProducts.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-center">
                          {item.fulfilledBy || 'Unknown Courier'}
                        </TableCell>
                        <TableCell className="font-mono text-sm text-center">
                          {item.barcode}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.productName || 'Unknown Product'}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.quantity || 1}
                        </TableCell>
                        <TableCell className="text-center">
                          ₹{item.price || 0}
                        </TableCell>
                      </TableRow>
                    ))}
                    {unscannedProducts.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-gray-500"
                        >
                          No unscanned items
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Unmatched Items */}
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-pink-600 p-6 text-white">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">
                  Unmatched Items ({unmatchedData.length})
                </CardTitle>
              </CardHeader>
            </div>
            <CardContent className="p-6">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Courier Name</TableHead>
                      <TableHead>Barcode</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmatchedData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {item.fulfilledBy || 'Unknown Courier'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {item.barcode}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive">Not Found</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.isFromDifferentDate ? (
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-orange-600 border-orange-300 bg-orange-50"
                              >
                                From {item.originalDate}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.timestamp.toLocaleTimeString()}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete Unmatched Item
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this unmatched
                                  scan result?
                                  <br />
                                  <strong>Barcode:</strong> {item.barcode}
                                  <br />
                                  <strong>Time:</strong>{' '}
                                  {item.timestamp.toLocaleTimeString()}
                                  <br />
                                  <br />
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    onDeleteUnmatched?.(item.barcode)
                                  }
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                    {unmatchedData.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-gray-500"
                        >
                          No unmatched items
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  },
);

// Add display name for debugging
ReportTable.displayName = 'ReportTable';
