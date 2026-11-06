/**
 * Service contracts. Pages talk ONLY to these interfaces (via `services` from ./index).
 * mock-provider.ts and api-provider.ts both implement `DataProvider`.
 * Tenant-scoped methods take `tenantId` first; the API provider forwards it as `X-Tenant-Id`
 * and the backend re-validates it against the authenticated user (never trusted blindly).
 */
import type {
  AppNotification, BlogPost, Booking, BookingInput, BookingNote, BookingStatus, Client, DriveLink, ExternalLink,
  Gallery, GalleryInput, GalleryPhoto, GallerySummary, ID, LoginInput, Package, PhotographyProgress,
  Photographer, PlatformSettings, PlatformStats, PortfolioPhoto, RegisterInput, Service, Session, StudioDashboard,
  StudioEvent, SubscriptionPlan, Tenant, TenantConfig, TenantCreated, TenantStatus, Testimonial, User, Video, EventNote,
} from '@/types';
 
export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number }
export interface ListParams {
  page?: number; pageSize?: number; search?: string; sort?: string; order?: 'asc' | 'desc';
}
type P<T> = ListParams & T;
 
export interface CrudService<T, C = Partial<T>, U = Partial<T>, F extends ListParams = ListParams> {
  list(tenantId: ID, params?: F): Promise<Paged<T>>;
  get(tenantId: ID, id: ID): Promise<T>;
  create(tenantId: ID, input: C): Promise<T>;
  update(tenantId: ID, id: ID, input: U): Promise<T>;
  remove(tenantId: ID, id: ID): Promise<void>;
}
 
export interface TenantService {
  resolve(q: { host?: string; slug?: string }): Promise<Tenant | null>;
  listPublic(): Promise<Tenant[]>;
  list(params?: P<{ status?: TenantStatus }>): Promise<Paged<Tenant>>;
  get(id: ID): Promise<Tenant>;
  create(input: Partial<Tenant> & { name: string; slug: string; ownerEmail: string; ownerName: string }): Promise<TenantCreated>;
  update(id: ID, input: Partial<Tenant>): Promise<Tenant>;
  setStatus(id: ID, status: TenantStatus): Promise<Tenant>;
  getConfig(tenantId: ID): Promise<TenantConfig>;
  /** Public contact form → notifies the studio's admins. */
  submitContact(tenantId: ID, input: { name: string; email: string; phone?: string; message: string }): Promise<void>;
  updateConfig(tenantId: ID, patch: DeepPartial<TenantConfig>): Promise<TenantConfig>;
}
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends (infer U)[] ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K] };
 
export interface AuthService {
  login(input: LoginInput): Promise<Session>;
  register(input: RegisterInput): Promise<Session>;
  logout(): Promise<void>;
  me(): Promise<Session | null>;
  updateProfile(patch: Partial<Pick<User, 'name' | 'phone' | 'avatarUrl'>>): Promise<User>;
  changePassword(input: { current: string; next: string }): Promise<void>;
  /** Mock mode only: demo logins shown on the sign-in page. Absent in api mode. */
  demoAccounts?(tenantId: ID | null): Promise<{ role: string; name: string; email: string; password: string }[]>;
}
 
export type PhotographerService = CrudService<Photographer, Partial<Photographer>, Partial<Photographer>,
  P<{ status?: string; specialty?: string; featured?: boolean }>>;
 
export interface ClientService extends CrudService<Client> {
  profile(tenantId: ID, id: ID): Promise<{ client: Client; bookings: Booking[]; events: StudioEvent[] }>;
}
 
export type ServiceService = CrudService<Service, Partial<Service>, Partial<Service>, P<{ status?: string; category?: string }>>;
export type PackageService = CrudService<Package, Partial<Package>, Partial<Package>, P<{ status?: string; serviceId?: ID }>>;
export type TestimonialService = CrudService<Testimonial, Partial<Testimonial>, Partial<Testimonial>, P<{ featured?: boolean }>>;
export type BlogService = CrudService<BlogPost, Partial<BlogPost>, Partial<BlogPost>, P<{ status?: string; category?: string }>> & {
  getBySlug(tenantId: ID, slug: string): Promise<BlogPost>;
};
export type DriveService = CrudService<DriveLink, Partial<DriveLink>, Partial<DriveLink>, P<{ clientId?: ID; eventId?: ID; visibility?: string }>>;
export type VideoService = CrudService<Video, Partial<Video>, Partial<Video>,
  P<{ category?: string; featured?: boolean; enabled?: boolean; visibility?: string; clientId?: ID; eventId?: ID }>>;
 
export type BookingFilters = P<{ status?: BookingStatus; clientId?: ID; photographerId?: ID; paymentStatus?: string; from?: string; to?: string }>;
export interface BookingService extends CrudService<Booking, BookingInput, Partial<Booking>, BookingFilters> {
  setStatus(tenantId: ID, id: ID, status: BookingStatus, note?: string): Promise<Booking>;
  assignPhotographers(tenantId: ID, id: ID, photographerIds: ID[]): Promise<Booking>;
  addNote(tenantId: ID, id: ID, text: string): Promise<BookingNote>;
}
 
export type EventFilters = P<{ status?: string; photographerId?: ID; clientId?: ID; isPublic?: boolean; upcoming?: boolean; delivery?: string }>;
export interface EventService extends CrudService<StudioEvent, Partial<StudioEvent>, Partial<StudioEvent>, EventFilters> {
  markCompleted(tenantId: ID, id: ID): Promise<StudioEvent>;
  updateProgress(tenantId: ID, id: ID, progress: PhotographyProgress): Promise<StudioEvent>;
  assignPhotographers(tenantId: ID, id: ID, photographerIds: ID[]): Promise<StudioEvent>;
  addNote(tenantId: ID, id: ID, text: string): Promise<EventNote>;
  updateDelivery(tenantId: ID, id: ID, patch: { targetHours?: number; notes?: string }): Promise<StudioEvent>;
}
 
export type GalleryFilters = P<{ eventId?: ID; clientId?: ID; visibility?: string; status?: 'highlights_pending' | 'highlights_published' | 'complete' }>;
export interface GalleryService {
  list(tenantId: ID, params?: GalleryFilters): Promise<Paged<GallerySummary>>;
  get(tenantId: ID, id: ID): Promise<Gallery>;
  create(tenantId: ID, input: GalleryInput): Promise<Gallery>;
  update(tenantId: ID, id: ID, input: GalleryInput): Promise<Gallery>;
  remove(tenantId: ID, id: ID): Promise<void>;
  listByEvent(tenantId: ID, eventId: ID): Promise<GallerySummary[]>;
  addPhotos(tenantId: ID, id: ID, photos: Partial<GalleryPhoto>[]): Promise<Gallery>;
  updatePhoto(tenantId: ID, id: ID, photoId: ID, patch: Partial<GalleryPhoto>): Promise<Gallery>;
  removePhoto(tenantId: ID, id: ID, photoId: ID): Promise<Gallery>;
  reorderPhotos(tenantId: ID, id: ID, photoIds: ID[]): Promise<Gallery>;
  setExternalLinks(tenantId: ID, id: ID, links: ExternalLink[]): Promise<Gallery>;
  submitHighlights(tenantId: ID, id: ID, photoIds: ID[], note?: string): Promise<Gallery>;
  publishHighlights(tenantId: ID, id: ID): Promise<Gallery>;
  publishComplete(tenantId: ID, id: ID): Promise<Gallery>;
  portfolio(tenantId: ID, params?: P<{ category?: string; featured?: boolean }>): Promise<Paged<PortfolioPhoto>>;
  sampleLibrary(): Promise<Partial<GalleryPhoto>[]>;
}
 
export interface NotificationService {
  list(tenantId: ID, userId: ID, params?: P<{ unread?: boolean }>): Promise<Paged<AppNotification>>;
  markRead(tenantId: ID, id: ID): Promise<AppNotification>;
  markAllRead(tenantId: ID, userId: ID): Promise<void>;
}
 
export interface AnalyticsService {
  studioDashboard(tenantId: ID): Promise<StudioDashboard>;
}
 
export interface PlatformService {
  stats(): Promise<PlatformStats>;
  plans: { list(): Promise<SubscriptionPlan[]>; create(i: Partial<SubscriptionPlan>): Promise<SubscriptionPlan>; update(id: ID, i: Partial<SubscriptionPlan>): Promise<SubscriptionPlan>; remove(id: ID): Promise<void> };
  getSettings(): Promise<PlatformSettings>;
  updateSettings(patch: Partial<PlatformSettings>): Promise<PlatformSettings>;
}
 
export interface DataProvider {
  mode: 'mock' | 'api';
  tenants: TenantService;
  auth: AuthService;
  photographers: PhotographerService;
  clients: ClientService;
  services: ServiceService;
  packages: PackageService;
  bookings: BookingService;
  events: EventService;
  galleries: GalleryService;
  videos: VideoService;
  drive: DriveService;
  testimonials: TestimonialService;
  blog: BlogService;
  notifications: NotificationService;
  analytics: AnalyticsService;
  platform: PlatformService;
}