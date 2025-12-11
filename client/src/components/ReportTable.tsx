import React, { useMemo, useCallback, useState, useEffect } from 'react';
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
import {
  Download,
  FileText,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Search,
  ArrowRight,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
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
import ComplaintDialog from './ComplaintDialog';
import { API_ENDPOINTS, getAuthHeaders } from '../config/api';
import { toast } from 'sonner';

// Utility function to format date in IST as YYYY-MM-DD without timezone conversion issues
const formatDateInIST = (date: Date): string => {
  if (!date || isNaN(date.getTime())) return '';
  
  // Format date directly in IST timezone to avoid UTC conversion issues
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  return formatter.format(date);
};

// Types
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
  rtoData?: any[];
  onDeleteUnmatched?: (barcode: string) => void;
  isAdmin?: boolean;
}

interface ComplaintDialogState {
  isOpen: boolean;
  barcode: string;
  date: string;
}

// Constants
const CSV_HEADERS = [
  'Courier Name',
  'Barcode',
  'Status',
  'Product Name',
  'Quantity',
  'Price',
  'Timestamp',
] as const;

const TABLE_CONFIGS = {
  matched: {
    columns: 6,
    headers: ['Courier Name', 'Barcode', 'Product', 'Qty', 'Price', 'Action'],
  },
  unscanned: {
    columns: 6,
    headers: ['Courier Name', 'Barcode', 'Product', 'Qty', 'Price', 'Action'],
  },
  unmatched: {
    columns: 6,
    headers: [
      'Courier Name',
      'Barcode',
      'Status',
      'Remarks',
      'Time',
      'Actions',
    ],
  },
} as const;

// Utility functions
const formatPrice = (price: number | undefined): string => {
  return `₹${price || 0}`;
};

const formatTimestamp = (timestamp: Date | string | undefined): string => {
  if (!timestamp) return 'Unknown time';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const escapeCSVField = (field: any): string => {
  const fieldStr = String(field || '');
  if (
    fieldStr.includes(',') ||
    fieldStr.includes('\n') ||
    fieldStr.includes('"')
  ) {
    return `"${fieldStr.replace(/"/g, '""')}"`;
  }
  return fieldStr;
};

const createCSVRow = (fields: any[]): string => {
  return fields.map(escapeCSVField).join(',');
};

// Main component
export const ReportTable: React.FC<ReportTableProps> = ({
  data,
  selectedDate,
  totalAvailable = 0,
  unscannedProducts = [],
  courierCounts = [],
  rtoData = [],
  onDeleteUnmatched,
  isAdmin = false,
}) => {
  // State
  const [complaintDialog, setComplaintDialog] = useState<ComplaintDialogState>({
    isOpen: false,
    barcode: '',
    date: '',
  });
  const [itemsWithComplaints, setItemsWithComplaints] = useState<Set<string>>(
    new Set(),
  );
  const [complaintsLoaded, setComplaintsLoaded] = useState(false);
  const [reconcilableScans, setReconcilableScans] = useState<any[]>([]);
  const [reconcilingScanId, setReconcilingScanId] = useState<number | null>(
    null,
  );

  // Search state
  const [matchedSearchTerm, setMatchedSearchTerm] = useState('');
  const [unscannedSearchTerm, setUnscannedSearchTerm] = useState('');
  const [unmatchedSearchTerm, setUnmatchedSearchTerm] = useState('');

  // Memoized data processing
  const processedData = useMemo(() => {
    const safeData = Array.isArray(data) ? data : [];
    const safeRtoData = Array.isArray(rtoData) ? rtoData : [];

    // Create RTO data map for quick lookup
    const rtoDataMap = new Map();
    safeRtoData.forEach((item) => {
      if (item.barcode) {
        rtoDataMap.set(item.barcode, item);
      }
    });

    // Enrich scan results with RTO data
    const enrichedData = safeData.map((scanResult) => {
      const rtoItem = rtoDataMap.get(scanResult.barcode);
      return {
        ...scanResult,
        productName:
          rtoItem?.productName || scanResult.productName || 'Unknown Product',
        quantity: rtoItem?.quantity || scanResult.quantity || 1,
        price: rtoItem?.price || scanResult.price || 0,
        fulfilledBy: rtoItem?.fulfilledBy || 'Unknown Courier',
      };
    });

    // Separate matched and unmatched items
    const matchedData = enrichedData.filter((item) => item && item.match);
    const unmatchedData = enrichedData.filter((item) => item && !item.match);

    return {
      rtoDataMap,
      enrichedData,
      matchedData,
      unmatchedData,
    };
  }, [data, rtoData]);

  // Filtered data based on search terms
  const filteredData = useMemo(() => {
    const filterItems = (items: any[], searchTerm: string) => {
      if (!searchTerm.trim()) return items;

      const term = searchTerm.toLowerCase();
      return items.filter(
        (item) =>
          item.barcode?.toLowerCase().includes(term) ||
          item.productName?.toLowerCase().includes(term) ||
          item.fulfilledBy?.toLowerCase().includes(term) ||
          item.orderId?.toString().includes(term),
      );
    };

    return {
      matchedData: filterItems(processedData.matchedData, matchedSearchTerm),
      unscannedData: filterItems(unscannedProducts, unscannedSearchTerm),
      unmatchedData: filterItems(
        processedData.unmatchedData,
        unmatchedSearchTerm,
      ),
    };
  }, [
    processedData.matchedData,
    processedData.unmatchedData,
    unscannedProducts,
    matchedSearchTerm,
    unscannedSearchTerm,
    unmatchedSearchTerm,
  ]);

  // Complaint handlers
  const handleOpenComplaint = useCallback(
    (barcode: string) => {
      // Use IST formatting to avoid timezone conversion issues
      const dateString = selectedDate ? formatDateInIST(selectedDate) : '';
      setComplaintDialog({
        isOpen: true,
        barcode,
        date: dateString,
      });
    },
    [selectedDate],
  );

  const handleCloseComplaint = useCallback(() => {
    setComplaintDialog({
      isOpen: false,
      barcode: '',
      date: '',
    });
  }, []);

  const handleComplaintCreated = useCallback(
    async (complaint: any) => {
      if (complaint.barcode) {
        // Immediately add to the set for instant UI update
        setItemsWithComplaints((prev) => new Set(prev).add(complaint.barcode));

        // Reload all complaints from server for consistency
        // This ensures the status persists across page refreshes
        try {
          const response = await fetch(
            `${API_ENDPOINTS.COMPLAINTS.ALL}?limit=10000`,
          );
          if (response.ok) {
            const data = await response.json();
            const complaints = Array.isArray(data) ? data : data.complaints || [];
            const complaintBarcodes = new Set(
              complaints.map((c: any) => c.barcode),
            );
            setItemsWithComplaints(complaintBarcodes);
            console.log(
              `✅ Reloaded ${complaints.length} complaints after creation`,
            );
          }
        } catch (error) {
          console.error('Error reloading complaints:', error);
        }
      }
    },
    [],
  );

  // Check if complaint exists for barcode
  const hasComplaint = useCallback(
    (barcode: string) => {
      return itemsWithComplaints.has(barcode);
    },
    [itemsWithComplaints],
  );

  // Load reconcilable scans
  const loadReconcilableScans = useCallback(async () => {
    if (!selectedDate) return;

    try {
      const dateString = selectedDate.toISOString().split('T')[0];
      const response = await fetch(API_ENDPOINTS.RTO.RECONCILABLE_SCANS(dateString));
      if (response.ok) {
        const data = await response.json();
        setReconcilableScans(data);
      }
    } catch (error) {
      console.error('Error loading reconcilable scans:', error);
    }
  }, [selectedDate]);

  // Handle reconciliation
  const handleReconcile = useCallback(
    async (scanId: number, targetDate: string) => {
      setReconcilingScanId(scanId);
      try {
        const response = await fetch(API_ENDPOINTS.RTO.RECONCILE_SCAN, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ scanId, targetDate }),
        });

        if (response.ok) {
          toast.success('Scan moved to matched successfully');
          // Reload data by calling onDeleteUnmatched callback to refresh
          // The parent component should refresh the data
          if (onDeleteUnmatched) {
            // Trigger a refresh by reloading reconcilable scans
            await loadReconcilableScans();
          }
          // Reload page data
          window.location.reload();
        } else {
          const errorData = await response.json().catch(() => ({}));
          toast.error(errorData.error || 'Failed to reconcile scan');
        }
      } catch (error) {
        console.error('Error reconciling scan:', error);
        toast.error('Failed to reconcile scan');
      } finally {
        setReconcilingScanId(null);
      }
    },
    [onDeleteUnmatched, loadReconcilableScans],
  );

  // Load all complaints to check by barcode (not just selected date)
  // This ensures "Reported" status persists across different dates and page refreshes
  const loadComplaints = useCallback(async () => {
    try {
      // Fetch all complaints with a high limit to get all barcodes
      const response = await fetch(
        `${API_ENDPOINTS.COMPLAINTS.ALL}?limit=10000`,
      );
      if (response.ok) {
        const data = await response.json();
        // Get all complaints (could be an array or object with complaints property)
        const complaints = Array.isArray(data) ? data : data.complaints || [];
        // Create a Set of barcodes that have complaints (across all dates)
        const complaintBarcodes = new Set(
          complaints.map((complaint: any) => complaint.barcode),
        );
        setItemsWithComplaints(complaintBarcodes);
        setComplaintsLoaded(true);
        console.log(
          `✅ Loaded ${complaints.length} complaints, ${complaintBarcodes.size} unique barcodes`,
        );
      } else {
        console.error('Failed to load complaints:', response.statusText);
      }
    } catch (error) {
      console.error('Error loading complaints:', error);
    }
  }, []);

  // Load complaints when component mounts or data/date changes
  useEffect(() => {
    loadComplaints();
  }, [loadComplaints, selectedDate, data]);

  useEffect(() => {
    loadReconcilableScans();
  }, [loadReconcilableScans]);

  // CSV export function
  const exportToCSV = useCallback(() => {
    try {
      const { enrichedData } = processedData;

      // Prepare scanned data
      const scannedData = enrichedData.map((item) => [
        item.fulfilledBy || 'Unknown Courier',
        item.barcode || '',
        item.match ? 'Matched' : 'Unmatched',
        (item.productName || '').replace(/,/g, ';'),
        (item.quantity || 1).toString(),
        (item.price || 0).toString(),
        item.timestamp ? formatTimestamp(item.timestamp) : '',
      ]);

      // Prepare unscanned data
      const unscannedData = unscannedProducts.map((item) => [
        item.fulfilledBy || 'Unknown Courier',
        item.barcode || '',
        'Unscanned',
        (item.productName || 'Unknown Product').replace(/,/g, ';'),
        (item.quantity || 1).toString(),
        (item.price || 0).toString(),
        '',
      ]);

      // Create CSV content
      const csvContent = [CSV_HEADERS, ...scannedData, ...unscannedData]
        .map(createCSVRow)
        .join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

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
  }, [processedData, unscannedProducts, selectedDate]);

  // Render helpers
  const renderSummaryStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
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
          {data.length}
        </div>
        <div className="text-sm font-semibold text-gray-600">Total Scanned</div>
      </div>
      <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-xl border border-amber-200 text-center hover:shadow-md transition-all duration-200">
        <div className="text-3xl font-bold text-amber-600 mb-2">
          {unscannedProducts.length}
        </div>
        <div className="text-sm font-semibold text-amber-700">Unscanned</div>
      </div>
      <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200 text-center hover:shadow-md transition-all duration-200">
        <div className="text-3xl font-bold text-green-600 mb-2">
          {processedData.matchedData.length}
        </div>
        <div className="text-sm font-semibold text-green-700">Matched</div>
      </div>
      <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-xl border border-red-200 text-center hover:shadow-md transition-all duration-200">
        <div className="text-3xl font-bold text-red-600 mb-2">
          {processedData.unmatchedData.length}
        </div>
        <div className="text-sm font-semibold text-red-700">Unmatched</div>
      </div>
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200 text-center hover:shadow-md transition-all duration-200">
        <div className="text-3xl font-bold text-blue-600 mb-2">
          {data.length > 0
            ? Math.round((processedData.matchedData.length / data.length) * 100)
            : 0}
          %
        </div>
        <div className="text-sm font-semibold text-blue-700">Match Rate</div>
      </div>
    </div>
  );

  const renderCourierDistribution = () => {
    if (courierCounts.length === 0) return null;

    return (
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
    );
  };

  const renderRecentActivity = () => (
    <div className="bg-slate-50 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-slate-700 mb-4">
        Recent Activity
      </h3>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {data.slice(0, 10).map((item, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all duration-200"
          >
            <div className="flex-1">
              <code className="text-sm font-mono bg-slate-100 px-3 py-1 rounded-lg font-semibold">
                {item.barcode}
              </code>
              <div className="text-xs text-slate-500 mt-1">
                {formatTimestamp(item.timestamp)}
              </div>
            </div>
            <Badge
              variant={item.match ? 'default' : 'destructive'}
              size="sm"
              className={`status-badge ${
                item.match
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : 'bg-red-100 text-red-800 border-red-200'
              }`}
            >
              {item.match ? 'Matched' : 'Unmatched'}
            </Badge>
          </div>
        ))}
        {data.length === 0 && (
          <div className="text-center text-slate-500 py-8">
            <div className="p-4 bg-slate-200 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <FileText className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-lg font-medium">No scan data available</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderActionButton = (item: any) => {
    const hasComplaintForItem = hasComplaint(item.barcode);

    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleOpenComplaint(item.barcode)}
        title={
          hasComplaintForItem
            ? 'View/Update existing complaint'
            : 'Report an issue for this item'
        }
        className={`button-with-icon ${
          hasComplaintForItem
            ? 'text-green-600 border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300'
            : 'text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300'
        }`}
      >
        {hasComplaintForItem ? (
          <>
            <CheckCircle className="h-4 w-4" />
            Reported
          </>
        ) : (
          <>
            <AlertTriangle className="h-4 w-4" />
            Report
          </>
        )}
      </Button>
    );
  };

  const renderMatchedItemsTable = () => (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">
            Matched Items ({filteredData.matchedData.length})
          </CardTitle>
        </CardHeader>
      </div>
      <CardContent className="p-6">
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search by barcode, product name, courier, or order ID..."
              value={matchedSearchTerm}
              onChange={(e) => setMatchedSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {TABLE_CONFIGS.matched.headers.map((header) => (
                  <TableHead key={header}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.matchedData.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.fulfilledBy || 'Unknown Courier'}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {item.barcode}
                  </TableCell>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{formatPrice(item.price)}</TableCell>
                  <TableCell>{renderActionButton(item)}</TableCell>
                </TableRow>
              ))}
              {filteredData.matchedData.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={TABLE_CONFIGS.matched.columns}
                    className="text-center text-gray-500"
                  >
                    {matchedSearchTerm
                      ? 'No items match your search'
                      : 'No matched items'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  const renderUnscannedItemsTable = () => (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-6 text-white">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">
            Unscanned Items ({filteredData.unscannedData.length})
          </CardTitle>
        </CardHeader>
      </div>
      <CardContent className="p-6">
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search by barcode, product name, courier, or order ID..."
              value={unscannedSearchTerm}
              onChange={(e) => setUnscannedSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {TABLE_CONFIGS.unscanned.headers.map((header) => (
                  <TableHead key={header} className="text-center">
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.unscannedData.map((item, index) => (
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
                    {formatPrice(item.price)}
                  </TableCell>
                  <TableCell className="text-center">
                    {renderActionButton(item)}
                  </TableCell>
                </TableRow>
              ))}
              {filteredData.unscannedData.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={TABLE_CONFIGS.unscanned.columns}
                    className="text-center text-gray-500"
                  >
                    {unscannedSearchTerm
                      ? 'No items match your search'
                      : 'No unscanned items'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  const renderUnmatchedItemsTable = () => (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-red-600 to-pink-600 p-6 text-white">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">
            Unmatched Items ({filteredData.unmatchedData.length})
          </CardTitle>
        </CardHeader>
      </div>
      <CardContent className="p-6">
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search by barcode, product name, courier, or order ID..."
              value={unmatchedSearchTerm}
              onChange={(e) => setUnmatchedSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {TABLE_CONFIGS.unmatched.headers.map((header) => (
                  <TableHead key={header}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.unmatchedData.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.fulfilledBy || 'Unknown Courier'}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {item.barcode}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="destructive"
                      size="sm"
                      className="status-badge"
                    >
                      Not Found
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.isFromDifferentDate && item.originalDate ? (
                      <div className="flex flex-col gap-1">
                        <Badge
                          variant="outline"
                          size="sm"
                          className="text-orange-600 border-orange-300 bg-orange-50 status-badge w-fit"
                        >
                          Correct Date: {item.originalDate}
                        </Badge>
                        {item.message && (
                          <span className="text-xs text-gray-600 italic">
                            {item.message}
                          </span>
                        )}
                      </div>
                    ) : item.message && item.message !== 'Barcode not found in RTO data' ? (
                      <span className="text-xs text-gray-600">{item.message}</span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatTimestamp(item.timestamp)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {/* Move to Matched button for reconcilable scans */}
                      {(() => {
                        const reconcilableScan = reconcilableScans.find(
                          (rs) =>
                            rs.scanId === (item as any).id ||
                            rs.barcode === item.barcode,
                        );
                        if (reconcilableScan) {
                          return (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600 border-green-200 hover:bg-green-50 hover:border-green-300"
                              disabled={reconcilingScanId === reconcilableScan.scanId}
                              onClick={() =>
                                handleReconcile(
                                  reconcilableScan.scanId,
                                  reconcilableScan.targetDate,
                                )
                              }
                            >
                              {reconcilingScanId === reconcilableScan.scanId ? (
                                <div className="flex items-center gap-2">
                                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-green-600 border-t-transparent"></div>
                                  Moving...
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <ArrowRight className="h-3 w-3" />
                                  Move to {reconcilableScan.targetDate}
                                </div>
                              )}
                            </Button>
                          );
                        }
                        return null;
                      })()}
                      {/* Delete button for admin */}
                      {isAdmin && onDeleteUnmatched && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300 icon-align"
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
                                Are you sure you want to delete this unmatched scan
                                result?
                                <br />
                                <strong>Barcode:</strong> {item.barcode}
                                <br />
                                <strong>Time:</strong>{' '}
                                {formatTimestamp(item.timestamp)}
                                <br />
                                <br />
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onDeleteUnmatched?.(item.barcode)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {!isAdmin &&
                        !reconcilableScans.find(
                          (rs) =>
                            rs.scanId === (item as any).id ||
                            rs.barcode === item.barcode,
                        ) && <span className="text-gray-400 text-sm">-</span>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredData.unmatchedData.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={TABLE_CONFIGS.unmatched.columns}
                    className="text-center text-gray-500"
                  >
                    {unmatchedSearchTerm
                      ? 'No items match your search'
                      : 'No unmatched items'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Main Report Card */}
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
          {renderSummaryStats()}
          {renderCourierDistribution()}
          {renderRecentActivity()}
        </CardContent>
      </Card>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {renderMatchedItemsTable()}
        {renderUnscannedItemsTable()}
        {renderUnmatchedItemsTable()}
      </div>

      {/* Complaint Dialog */}
      <ComplaintDialog
        isOpen={complaintDialog.isOpen}
        onClose={handleCloseComplaint}
        barcode={complaintDialog.barcode}
        date={complaintDialog.date}
        onComplaintCreated={handleComplaintCreated}
      />
    </div>
  );
};

// Add display name for debugging
ReportTable.displayName = 'ReportTable';
