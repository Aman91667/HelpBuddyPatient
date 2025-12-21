export interface User {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  type: 'PATIENT' | 'HELPER';
  status: 'ACTIVE' | 'INACTIVE' | 'BANNED';
  rating?: number;
  totalServices?: number;
  avatarUrl?: string;
  reputation?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  lat: number;
  lng: number;
  landmark?: string;
}

// Lightweight payload used for socket location messages
export interface LocationPayload {
  serviceId?: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
}

export interface MinimalHelper {
  id?: string;
  userId?: string;
  name?: string;
  rating?: number;
  phone?: string;
  currentLocation?: Location;
  user?: { name?: string };
}

export interface ServicePayload {
  serviceId?: string;
  service?: Partial<Service> & { helper?: Partial<MinimalHelper> };
  helper?: Partial<MinimalHelper>;
}

export type SocketAck<T = unknown> = (res?: T) => void;

export type ServiceType = 
  | 'QUEUE'
  | 'GUIDANCE'
  | 'CARRY_ITEMS'
  | 'WHEELCHAIR'
  | 'MEDICAL_ASSIST'
  | 'TRANSLATION';

export type ServiceStatus = 
  | 'REQUESTED'
  | 'SEARCHING'
  | 'ACCEPTED'
  | 'HELPER_ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

export interface Service {
  id: string;
  patientId: string;
  helperId?: string;
  patientLocation: Location;
  serviceType: ServiceType[];
  description?: string;
  status: ServiceStatus;
  fare?: number;
  billedMinutes?: number;
  rating?: number;
  review?: string;
  estimatedHelpers?: number;
  estimatedArrivalTime?: string;
  otpCode?: string;
  otpVerified?: boolean;
  helper?: {
    id: string;
    name: string;
    rating?: number;
    avgRating?: number;
    totalRatings?: number;
    phone?: string;
    currentLocation?: Location;
    profileImage?: string;
    aadhaarImage?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    user: User;
  };
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface OTPRequest {
  type: 'PHONE' | 'EMAIL';
  value: string;
}

export interface OTPVerify extends OTPRequest {
  code: string;
  name?: string;
}

export interface ServiceHistory {
  services: Service[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
