import type { BookingStatus } from '@/types';
 
/** Semantic status colours (reserved for state, never reused as categorical series colours). */
export const BOOKING_STATUS_COLOR: Record<BookingStatus, string> = {
  enquiry: '#2a78d6', pending: '#eda100', confirmed: '#1baf7a', completed: '#6b7280', cancelled: '#9ca3af', rejected: '#dc2626',
};
export const BOOKING_STATUSES: BookingStatus[] = ['enquiry', 'pending', 'confirmed', 'completed', 'cancelled', 'rejected'];
export const CATEGORY_OPTIONS = ['wedding', 'pre-wedding', 'engagement', 'birthday', 'corporate', 'fashion', 'product', 'event', 'portrait'].map((v) => ({ value: v, label: v.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }));