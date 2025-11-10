// API Configuration
const getApiBaseUrl = (): string => {
  // Check if we're in development mode
  if (import.meta.env.DEV) {
    return 'http://localhost:5003';
  }

  // For production, use the current origin (same domain as frontend)
  return window.location.origin.replace(/:\d+$/, ':5003');
};

export const API_BASE_URL = getApiBaseUrl();

// API Endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/api/auth/login`,
  },
  RTO: {
    UPLOAD: `${API_BASE_URL}/api/rto/upload`,
    SCAN: `${API_BASE_URL}/api/rto/scan`,
    REPORT: (date: string) => `${API_BASE_URL}/api/rto/report/${date}`,
    CALENDAR: `${API_BASE_URL}/api/rto/calendar`,
    DATA: (date: string) => `${API_BASE_URL}/api/rto/data/${date}`,
    SCANS: (date: string) => `${API_BASE_URL}/api/rto/scans/${date}`,
    SUMMARY: `${API_BASE_URL}/api/rto/summary`,
    UPLOADS: `${API_BASE_URL}/api/rto/uploads`,
    DELETE_UPLOAD: (date: string) => `${API_BASE_URL}/api/rto/uploads/${date}`,
    DELETE_ALL_UPLOADS: `${API_BASE_URL}/api/rto/uploads`,
    COURIER_COUNTS: (date: string) =>
      `${API_BASE_URL}/api/rto/courier-counts/${date}`,
    DELETE_UNMATCHED_SCAN: `${API_BASE_URL}/api/rto/scan/unmatched`,
    RECONCILE_SCAN: `${API_BASE_URL}/api/rto/scan/reconcile`,
    RECONCILABLE_SCANS: (date: string) =>
      `${API_BASE_URL}/api/rto/reconcilable/${date}`,
  },
  COMPLAINTS: {
    ALL: `${API_BASE_URL}/api/complaints`,
    DELETE_ALL: `${API_BASE_URL}/api/complaints/all`,
    STATUS: (id: string) => `${API_BASE_URL}/api/complaints/${id}/status`,
    MAIL_DONE: (id: string) => `${API_BASE_URL}/api/complaints/${id}/mail-done`,
  },
};

// Helper function to get full API URL
export const getApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};

// Helper function to get auth headers with user role
export const getAuthHeaders = (): Record<string, string> => {
  const savedUser = localStorage.getItem('rto_user');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      if (user.role) {
        headers['x-user-role'] = user.role;
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
    }
  }

  return headers;
};

// Debug function to log current API configuration
export const logApiConfig = (): void => {
  console.log('API Configuration:', {
    baseUrl: API_BASE_URL,
    isDevelopment: import.meta.env.DEV,
    currentOrigin: window.location.origin,
  });
};
