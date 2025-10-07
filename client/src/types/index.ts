export interface RTOItem {
  id: string;
  barcode: string;
  productName: string;
  orderId: string;
  customerName: string;
  returnReason: string;
  quantity: number;
  value: number;
  date: string;
}

export interface ScannedBarcode {
  id: string;
  barcode: string;
  scannedAt: string;
  matched: boolean;
  rtoItem?: RTOItem;
  isFromDifferentDate?: boolean;
  originalDate?: string;
}

export interface DailyReconciliation {
  date: string;
  totalUploaded: number;
  totalScanned: number;
  matched: number;
  unmatched: number;
  matchRate: number;
  rtoItems: RTOItem[];
  scannedBarcodes: ScannedBarcode[];
}

export interface CalendarDay {
  date: string;
  hasData: boolean;
  summary?: {
    totalScanned: number;
    matchRate: number;
  };
}
