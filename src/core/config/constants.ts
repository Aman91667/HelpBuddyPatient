export const ROUTES = {
  HOME: '/',
  AUTH: '/auth',
  BOOK_HELPER: '/request',
  SEARCHING: '/matching/:serviceId',
  TRACKING: '/tracking/:serviceId',
  PAYMENT: '/payment/:serviceId',
  HISTORY: '/history',
  PROFILE: '/profile',
  FAVORITES: '/favorites',
} as const;

export const API_ENDPOINTS = {
  AUTH: {
    REQUEST_OTP: '/auth/request-otp',
    VERIFY_OTP: '/auth/verify-otp',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
    LOGOUT: '/auth/logout',
  },
  SERVICES: {
    CREATE: '/services',
    ACTIVE: '/services/active',
    HISTORY: '/services/history',
    BY_ID: (id: string) => `/services/${id}`,
    CANCEL: (id: string) => `/services/${id}/cancel`,
    RATE: (id: string) => `/services/${id}/rate`,
  },
  PATIENTS: {
    FAVORITES: '/patients/favorites',
    ADD_FAVORITE: (id: string) => `/patients/favorites/${id}`,
    REMOVE_FAVORITE: (id: string) => `/patients/favorites/${id}`,
  },
} as const;
