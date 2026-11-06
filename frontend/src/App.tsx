import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { TenantProvider } from './context/TenantContext';
import { getTenantStrategy } from './tenancy/resolve';
import { PublicLayout } from './components/layout/PublicLayout';
import { PortalShell } from './components/layout/PortalShell';
import { DevSwitcher } from './components/layout/DevSwitcher';
import { RequirePlatformAdmin, RequireTenantRole } from './components/shared/Guards';
import { PageLoader } from './components/ui/Feedback';
import StudioPicker from './pages/StudioPicker';
import NotFound from './pages/NotFound';
 
const L = <T extends { default: React.ComponentType }>(f: () => Promise<T>) => lazy(f);
const lazyNamed = <K extends string>(f: () => Promise<Record<K, React.ComponentType>>, k: K) => lazy(() => f().then((m) => ({ default: m[k] })));
 
const Home = L(() => import('./pages/public/HomePage'));
const About = L(() => import('./pages/public/AboutPage'));
const Portfolio = L(() => import('./pages/public/PortfolioPage'));
const Videos = L(() => import('./pages/public/VideosPage'));
const Photographers = lazyNamed(() => import('./pages/public/PhotographersPage'), 'PhotographersPage');
const PhotographerProfile = lazyNamed(() => import('./pages/public/PhotographersPage'), 'PhotographerProfilePage');
const Services = lazyNamed(() => import('./pages/public/ServicesPackagesPages'), 'ServicesPage');
const Packages = lazyNamed(() => import('./pages/public/ServicesPackagesPages'), 'PackagesPage');
const Events = lazyNamed(() => import('./pages/public/EventsBlogPages'), 'EventsPage');
const EventDetail = lazyNamed(() => import('./pages/public/EventsBlogPages'), 'EventDetailPage');
const Blog = lazyNamed(() => import('./pages/public/EventsBlogPages'), 'BlogPage');
const BlogPost = lazyNamed(() => import('./pages/public/EventsBlogPages'), 'BlogPostPage');
const Contact = lazyNamed(() => import('./pages/public/ContactBookingPages'), 'ContactPage');
const Booking = lazyNamed(() => import('./pages/public/ContactBookingPages'), 'BookingPage');
const Login = lazyNamed(() => import('./pages/public/AuthPages'), 'LoginPage');
const Register = lazyNamed(() => import('./pages/public/AuthPages'), 'RegisterPage');
 
// Client portal
const ClientDashboard = L(() => import('./pages/client/ClientDashboard'));
const ClientPhotos = L(() => import('./pages/client/ClientPhotos'));
const ClientBookings = lazyNamed(() => import('./pages/client/ClientBookingsEvents'), 'ClientBookings');
const ClientEvents = lazyNamed(() => import('./pages/client/ClientBookingsEvents'), 'ClientEvents');
const ClientVideos = lazyNamed(() => import('./pages/client/ClientMisc'), 'ClientVideos');
const ClientNotifications = lazyNamed(() => import('./pages/client/ClientMisc'), 'ClientNotifications');
const ClientProfile = lazyNamed(() => import('./pages/client/ClientMisc'), 'ClientProfile');
// Photographer portal
const PhotographerShell = L(() => import('./pages/photographer/PhotographerShell'));
const PhotographerEventDetail = L(() => import('./pages/photographer/PhotographerEventDetail'));
const PhotographerDashboard = lazyNamed(() => import('./pages/photographer/PhotographerPages'), 'PhotographerDashboard');
const PhotographerEvents = lazyNamed(() => import('./pages/photographer/PhotographerPages'), 'PhotographerEvents');
const PhotographerBookings = lazyNamed(() => import('./pages/photographer/PhotographerPages'), 'PhotographerBookings');
 
// Studio admin
const AdminShell = L(() => import('./pages/admin/AdminShell'));
const AdminDashboard = L(() => import('./pages/admin/AdminDashboard'));
const AnalyticsPage = L(() => import('./pages/admin/AnalyticsPage'));
const BookingsPage = L(() => import('./pages/admin/BookingsPage'));
const EventsAdmin = L(() => import('./pages/admin/EventsPage'));
const DeliveryBoard = L(() => import('./pages/admin/DeliveryBoard'));
const CustomersPage = L(() => import('./pages/admin/CustomersPage'));
const GalleriesPage = L(() => import('./pages/admin/GalleriesPage'));
const WebsiteCms = L(() => import('./pages/admin/WebsiteCms'));
const SettingsPage = L(() => import('./pages/admin/SettingsPage'));
const PhotographersAdmin = lazyNamed(() => import('./pages/admin/CatalogPages'), 'PhotographersAdmin');
const ServicesAdmin = lazyNamed(() => import('./pages/admin/CatalogPages'), 'ServicesAdmin');
const PackagesAdmin = lazyNamed(() => import('./pages/admin/CatalogPages'), 'PackagesAdmin');
const TestimonialsAdmin = lazyNamed(() => import('./pages/admin/CatalogPages'), 'TestimonialsAdmin');
const VideosAdmin = lazyNamed(() => import('./pages/admin/CatalogPages'), 'VideosAdmin');
const DriveAdmin = lazyNamed(() => import('./pages/admin/CatalogPages'), 'DriveAdmin');
const BlogAdmin = lazyNamed(() => import('./pages/admin/CatalogPages'), 'BlogAdmin');
 
// Super admin
const PlatformLogin = L(() => import('./pages/platform/PlatformLogin'));
const PlatformShell = L(() => import('./pages/platform/PlatformShell'));
const PlatformOverview = L(() => import('./pages/platform/PlatformOverview'));
const PlatformStudios = L(() => import('./pages/platform/PlatformStudios'));
const PlatformPlans = lazyNamed(() => import('./pages/platform/PlatformPlansSettings'), 'PlatformPlans');
const PlatformSettingsPage = lazyNamed(() => import('./pages/platform/PlatformPlansSettings'), 'PlatformSettingsPage');
 
const strategy = getTenantStrategy();
 
export default function App() {
  const tenantPath = strategy.mode === 'host' ? '/' : '/:tenantSlug';
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {strategy.mode === 'path' && <Route path="/" element={<StudioPicker />} />}
 
        <Route path="/platform/login" element={<PlatformLogin />} />
        <Route element={<RequirePlatformAdmin />}>
          <Route path="/platform" element={<PlatformShell />}>
            <Route index element={<PlatformOverview />} />
            <Route path="studios" element={<PlatformStudios />} />
            <Route path="plans" element={<PlatformPlans />} />
            <Route path="settings" element={<PlatformSettingsPage />} />
          </Route>
        </Route>
 
        <Route path={tenantPath} element={<TenantProvider />}>
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="about" element={<About />} />
            <Route path="photographers" element={<Photographers />} />
            <Route path="photographers/:slug" element={<PhotographerProfile />} />
            <Route path="services" element={<Services />} />
            <Route path="packages" element={<Packages />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="videos" element={<Videos />} />
            <Route path="events" element={<Events />} />
            <Route path="events/:id" element={<EventDetail />} />
            <Route path="blog" element={<Blog />} />
            <Route path="blog/:slug" element={<BlogPost />} />
            <Route path="contact" element={<Contact />} />
            <Route path="booking" element={<Booking />} />
          </Route>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route element={<RequireTenantRole roles={['client']} />}>
            <Route path="portal" element={<PortalShell />}>
              <Route index element={<ClientDashboard />} />
              <Route path="bookings" element={<ClientBookings />} />
              <Route path="events" element={<ClientEvents />} />
              <Route path="photos" element={<ClientPhotos />} />
              <Route path="videos" element={<ClientVideos />} />
              <Route path="notifications" element={<ClientNotifications />} />
              <Route path="profile" element={<ClientProfile />} />
            </Route>
          </Route>
          <Route element={<RequireTenantRole roles={['photographer']} />}>
            <Route path="photographer" element={<PhotographerShell />}>
              <Route index element={<PhotographerDashboard />} />
              <Route path="events" element={<PhotographerEvents />} />
              <Route path="events/:id" element={<PhotographerEventDetail />} />
              <Route path="bookings" element={<PhotographerBookings />} />
              <Route path="profile" element={<ClientProfile />} />
            </Route>
          </Route>
          <Route element={<RequireTenantRole roles={['studio_admin']} />}>
            <Route path="admin" element={<AdminShell />}>
              <Route index element={<AdminDashboard />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="bookings" element={<BookingsPage />} />
              <Route path="events" element={<EventsAdmin />} />
              <Route path="delivery" element={<DeliveryBoard />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="galleries" element={<GalleriesPage />} />
              <Route path="videos" element={<VideosAdmin />} />
              <Route path="drive" element={<DriveAdmin />} />
              <Route path="photographers" element={<PhotographersAdmin />} />
              <Route path="services" element={<ServicesAdmin />} />
              <Route path="packages" element={<PackagesAdmin />} />
              <Route path="testimonials" element={<TestimonialsAdmin />} />
              <Route path="website" element={<WebsiteCms />} />
              <Route path="blog" element={<BlogAdmin />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <DevSwitcher />
    </Suspense>
  );
}