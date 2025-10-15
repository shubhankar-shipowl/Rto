// Test utility to verify API configuration
import { API_BASE_URL, API_ENDPOINTS, logApiConfig } from '../config/api';

export const testApiConfiguration = () => {
  console.log('🧪 Testing API Configuration...');

  // Log current configuration
  logApiConfig();

  // Test API endpoints
  console.log('📡 API Endpoints:');
  console.log('- Auth Login:', API_ENDPOINTS.AUTH.LOGIN);
  console.log('- RTO Upload:', API_ENDPOINTS.RTO.UPLOAD);
  console.log('- RTO Data (2025-01-14):', API_ENDPOINTS.RTO.DATA('2025-01-14'));
  console.log('- Complaints All:', API_ENDPOINTS.COMPLAINTS.ALL);
  console.log('- Complaints Delete All:', API_ENDPOINTS.COMPLAINTS.DELETE_ALL);

  // Test environment detection
  console.log('🌍 Environment Detection:');
  console.log('- Is Development:', import.meta.env.DEV);
  console.log('- Is Production:', import.meta.env.PROD);
  console.log('- Current Origin:', window.location.origin);
  console.log('- API Base URL:', API_BASE_URL);

  return {
    baseUrl: API_BASE_URL,
    isDevelopment: import.meta.env.DEV,
    currentOrigin: window.location.origin,
  };
};

// Auto-run test in development
if (import.meta.env.DEV) {
  testApiConfiguration();
}
