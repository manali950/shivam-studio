/**
 * Domain entities shared by the mock provider, the API provider and every React page.
 * The backend (backend/src/modules/**) serialises rows into exactly these shapes (camelCase JSON),
 * so switching VITE_DATA_MODE never changes component code. IDs are opaque strings (UUIDs in PostgreSQL).
 */
export type ID = string;
export type ISODate = string;
 
export type Role = 'super_admin' | 'studio_admin' | 'photographer' | 'client';
export type ServiceCategory =
  | 'wedding' | 'pre-wedding' | 'engagement' | 'birthday' | 'corporate'
  | 'fashion' | 'product' | 'event' | 'portrait';
 
/* ---------------------------------------------------------------- Platform / tenancy */
export type TenantStatus = 'active' | 'inactive' | 'trial';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled';
 
export interface Tenant {
  id: ID;
  slug: string;
  name: string;
  status: TenantStatus;
  planId: ID;
  subscriptionStatus: SubscriptionStatus;
  renewsAt: ISODate | null;
  subdomain: string;
  customDomain: string | null;
  ownerName: string;
  ownerEmail: string;
  city: string;
  createdAt: ISODate;
}
 
/** Returned once by studio creation. `ownerTemporaryPassword` is shown to the super admin a single time and never retrievable again. */
export type TenantCreated = Tenant & { ownerTemporaryPassword?: string };
 
export interface TenantSettings {
  currency: 'INR' | 'USD' | 'EUR' | 'GBP';
  locale: string;
  deliveryTargetHours: number;
  booking: { enquiryEnabled: boolean; autoConfirm: boolean; requireDeposit: boolean; depositPercent: number; minLeadDays: number };
  notifications: { emailOnNewBooking: boolean; emailOnDelivery: boolean; smsReminders: boolean; reminderDaysBefore: number };
  business: { legalName: string; taxId: string; invoicePrefix: string; timezone: string };
}
 
export interface TenantConfig {
  tenantId: ID;
  branding: { logoUrl: string; faviconUrl: string; primaryColor: string; secondaryColor: string; heroImageUrl: string; tagline: string };
  home: { headline: string; subheadline: string; heroCtaLabel: string; featuredPhotoUrls: string[] };
  about: {
    title: string; intro: string; history: string; philosophy: string;
    achievements: { label: string; value: string }[];
    milestones: { year: string; text: string }[];
  };
  contact: { email: string; phone: string; whatsapp: string; address: string; city: string; mapUrl: string; hours: string };
  social: { instagram?: string; facebook?: string; youtube?: string; twitter?: string; pinterest?: string };
  footer: { text: string; copyright: string };
  settings: TenantSettings;
}
 
export interface SubscriptionPlan {
  id: ID;
  name: string;
  priceMonthly: number;
  currency: 'INR' | 'USD';
  maxPhotographers: number;
  maxStorageGb: number;
  maxBookingsPerMonth: number;
  features: string[];
  status: 'active' | 'archived';
}
 
export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  baseDomain: string;
  defaultPlanId: ID;
  trialDays: number;
  allowSelfSignup: boolean;
  maintenanceMode: boolean;
  defaultDeliveryTargetHours: number;
}
 
export interface PlatformStats {
  totalTenants: number; activeTenants: number; inactiveTenants: number; trialTenants: number;
  totalCustomers: number; totalBookings: number; totalPhotographers: number; monthlyRecurringRevenue: number;
  tenantsByPlan: { planId: ID; planName: string; count: number }[];
  bookingsByTenant: { tenantId: ID; tenantName: string; bookings: number; customers: number }[];
  signups: { month: string; tenants: number }[];
}
 
/* ---------------------------------------------------------------- Auth */
export interface User {
  id: ID;
  tenantId: ID | null;
  role: Role;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string;
  clientId?: ID | null;
  photographerId?: ID | null;
  status: 'active' | 'disabled';
}
export interface Session { user: User; token: string }
export interface LoginInput { email: string; password: string; tenantId?: ID | null }
export interface RegisterInput { name: string; email: string; phone: string; password: string; tenantId: ID }
 
/* ---------------------------------------------------------------- Studio */
export interface Availability { weekdays: number[]; blockedDates: ISODate[]; note: string }
export interface Photographer {
  id: ID; tenantId: ID; userId?: ID | null;
  name: string; slug: string; title: string; bio: string;
  avatarUrl: string; email: string; phone: string;
  experienceYears: number; rating: number;
  specialties: ServiceCategory[]; skills: string[]; equipment: string[]; portfolio: string[];
  status: 'active' | 'on_leave' | 'inactive';
  featured: boolean; availability: Availability; createdAt: ISODate;
}
export interface Client {
  id: ID; tenantId: ID; userId?: ID | null;
  name: string; email: string; phone: string; city: string; notes: string;
  source: 'website' | 'whatsapp' | 'referral' | 'walk-in'; createdAt: ISODate;
}
export interface Service {
  id: ID; tenantId: ID; name: string; slug: string; category: ServiceCategory; description: string;
  startingPrice: number; imageUrl: string; status: 'active' | 'inactive'; featured: boolean; sortOrder: number;
}
export interface Package {
  id: ID; tenantId: ID; serviceId: ID; name: string; description: string; price: number;
  durationHours: number; photographerCount: number; deliverables: string[]; features: string[];
  popular: boolean; status: 'active' | 'inactive'; sortOrder: number;
}
 
/* ---------------------------------------------------------------- Bookings & events */
export type BookingStatus = 'enquiry' | 'pending' | 'confirmed' | 'completed' | 'rejected' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';
export interface BookingNote { id: ID; authorName: string; text: string; createdAt: ISODate }
export interface Booking {
  id: ID; tenantId: ID; reference: string; clientId: ID | null;
  customer: { name: string; email: string; phone: string };
  serviceId: ID; packageId: ID | null;
  eventDate: ISODate; location: string; guestCount: number | null; requirements: string;
  status: BookingStatus; paymentStatus: PaymentStatus; amount: number; paidAmount: number;
  assignedPhotographerIds: ID[]; notes: BookingNote[]; eventId: ID | null;
  source: 'website' | 'whatsapp' | 'referral' | 'manual'; createdAt: ISODate; updatedAt: ISODate;
}
export type BookingInput = Pick<Booking, 'serviceId' | 'eventDate' | 'location' | 'customer'> &
  Partial<Pick<Booking, 'packageId' | 'guestCount' | 'requirements' | 'source' | 'amount' | 'status'>>;
 
export type EventStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type PhotographyProgress = 'planned' | 'shooting' | 'wrapped' | 'editing' | 'delivered';
export type DeliveryStatus = 'not_due' | 'pending' | 'highlights_submitted' | 'highlights_published' | 'delivered';
export interface EventNote { id: ID; authorName: string; authorRole: Role; text: string; createdAt: ISODate }
export interface DeliveryInfo {
  targetHours: number;
  completedAt: ISODate | null;
  highlightsSubmittedAt: ISODate | null;
  highlightsPublishedAt: ISODate | null;
  galleryPublishedAt: ISODate | null;
  status: DeliveryStatus;
  notes: string;
}
export interface StudioEvent {
  id: ID; tenantId: ID; bookingId: ID | null; clientId: ID | null;
  title: string; type: ServiceCategory; date: ISODate; startTime: string; venue: string; city: string; description: string;
  status: EventStatus; progress: PhotographyProgress; photographerIds: ID[];
  isPublic: boolean; coverUrl: string; notes: EventNote[]; delivery: DeliveryInfo; createdAt: ISODate;
}
 
/* ---------------------------------------------------------------- Media */
export interface GalleryPhoto {
  id: ID; url: string; title: string; description: string; category: ServiceCategory;
  isHighlight: boolean; featured?: boolean; order: number; width: number; height: number;
  camera?: string; lens?: string; exposure?: string;
}
export interface ExternalLink { id: ID; label: string; url: string }
export type GalleryVisibility = 'private' | 'client' | 'public';
export interface GallerySummary {
  id: ID; tenantId: ID; eventId: ID | null; clientId: ID | null; title: string; description: string; coverUrl: string;
  visibility: GalleryVisibility; externalLinks: ExternalLink[];
  highlightsSubmittedAt: ISODate | null; highlightsPublishedAt: ISODate | null; completePublishedAt: ISODate | null;
  photoCount: number; highlightCount: number; previewUrls: string[]; createdAt: ISODate; updatedAt: ISODate;
}
export interface Gallery extends GallerySummary { photos: GalleryPhoto[] }
export type GalleryInput = Partial<Pick<Gallery, 'title' | 'description' | 'eventId' | 'clientId' | 'visibility' | 'externalLinks' | 'coverUrl'>>;
export interface PortfolioPhoto extends GalleryPhoto { galleryId: ID; galleryTitle: string }
 
export type VideoCategory = 'wedding' | 'pre-wedding' | 'event' | 'showcase';
export interface Video {
  id: ID; tenantId: ID; title: string; description: string; youtubeUrl: string; youtubeId: string;
  category: VideoCategory; thumbnailUrl: string; featured: boolean; enabled: boolean;
  visibility: 'public' | 'client'; eventId: ID | null; clientId: ID | null; createdAt: ISODate;
}
export interface DriveLink {
  id: ID; tenantId: ID; title: string; url: string; folderId: string; description: string;
  eventId: ID | null; clientId: ID | null; visibility: 'client' | 'private'; createdAt: ISODate;
}
 
/* ---------------------------------------------------------------- Content & ops */
export interface Testimonial {
  id: ID; tenantId: ID; clientName: string; role: string; eventType: ServiceCategory;
  rating: number; quote: string; avatarUrl: string; featured: boolean; createdAt: ISODate;
}
export interface BlogPost {
  id: ID; tenantId: ID; slug: string; title: string; excerpt: string; body: string; coverUrl: string;
  category: 'tips' | 'stories'; authorName: string; readMinutes: number; publishedAt: ISODate; status: 'published' | 'draft';
}
export type NotificationType =
  | 'booking_confirmed' | 'booking_update' | 'event_reminder' | 'highlights_published'
  | 'gallery_published' | 'new_enquiry' | 'delivery_overdue' | 'system';
export interface AppNotification {
  id: ID; tenantId: ID; userId: ID; type: NotificationType; title: string; body: string;
  link: string; read: boolean; createdAt: ISODate;
}
 
/* ---------------------------------------------------------------- Analytics */
export interface StudioDashboard {
  totals: {
    bookings: number; pendingEnquiries: number; upcomingEvents: number; completedEvents: number;
    clients: number; photographers: number; revenue: number; outstanding: number; pendingDeliveries: number;
  };
  revenueByMonth: { month: string; revenue: number; bookings: number }[];
  bookingsByStatus: { status: BookingStatus; count: number }[];
  bookingsByService: { name: string; count: number; revenue: number }[];
  deliveryFunnel: { label: string; count: number }[];
  photographerLoad: { photographerId: ID; name: string; upcoming: number; completed: number }[];
}