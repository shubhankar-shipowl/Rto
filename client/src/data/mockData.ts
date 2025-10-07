import { RTOItem, DailyReconciliation } from '../types';

export const generateMockRTOItems = (date: string, count: number = 15): RTOItem[] => {
  const products = ['Wireless Headphones', 'Smart Watch', 'Laptop Stand', 'USB-C Cable', 'Phone Case', 
    'Bluetooth Speaker', 'Keyboard', 'Mouse Pad', 'Webcam', 'Monitor', 'Desk Lamp', 'Power Bank',
    'HDMI Cable', 'External SSD', 'Gaming Mouse'];
  const reasons = ['Size Issue', 'Damaged', 'Wrong Item', 'Not Needed', 'Quality Issue'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `RTO-${date}-${i + 1}`,
    barcode: `BC${Math.random().toString().slice(2, 14)}`,
    productName: products[i % products.length],
    orderId: `ORD${Math.random().toString().slice(2, 10)}`,
    customerName: `Customer ${i + 1}`,
    returnReason: reasons[i % reasons.length],
    quantity: Math.floor(Math.random() * 3) + 1,
    value: Math.floor(Math.random() * 5000) + 500,
    date
  }));
};

export const mockReconciliations: Record<string, DailyReconciliation> = {};
