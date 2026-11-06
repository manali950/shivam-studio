-- 001_schema.sql — shivamStudio core schema (PostgreSQL 14+; developed and tested on 16).
-- Conventions: UUID primary keys · tenant_id on every tenant-owned row · composite (tenant_id, id) foreign keys so a row can
-- never reference another studio's data · created_at / updated_at maintained by trigger · soft delete via deleted_at on
-- business entities · text + CHECK instead of enum types (cheap to evolve).
 
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
 
-- ISO-8601 UTC text for timestamps embedded in JSON (matches JavaScript's Date#toISOString, so every API timestamp has one format).
CREATE OR REPLACE FUNCTION iso_ts(ts timestamptz) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$$ SELECT to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;
 
/* ======================================================================== platform (global, no tenant_id) */
CREATE TABLE plans (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text NOT NULL,
  price_monthly           numeric(12,2) NOT NULL DEFAULT 0 CHECK (price_monthly >= 0),
  currency                text NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR','USD')),
  max_photographers       integer NOT NULL DEFAULT 1 CHECK (max_photographers > 0),
  max_storage_gb          integer NOT NULL DEFAULT 5 CHECK (max_storage_gb > 0),
  max_bookings_per_month  integer NOT NULL DEFAULT 10 CHECK (max_bookings_per_month > 0),
  features                text[] NOT NULL DEFAULT '{}',
  status                  text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
 
CREATE TABLE platform_settings (
  singleton                    boolean PRIMARY KEY DEFAULT true CHECK (singleton),   -- exactly one row
  platform_name                text NOT NULL DEFAULT 'shivamStudio',
  support_email                text NOT NULL DEFAULT 'support@example.com',
  base_domain                  text NOT NULL DEFAULT 'localhost',
  default_plan_id              uuid REFERENCES plans(id),
  trial_days                   integer NOT NULL DEFAULT 14 CHECK (trial_days BETWEEN 0 AND 365),
  allow_self_signup            boolean NOT NULL DEFAULT false,
  maintenance_mode             boolean NOT NULL DEFAULT false,
  default_delivery_target_hours integer NOT NULL DEFAULT 24 CHECK (default_delivery_target_hours BETWEEN 1 AND 720),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);
 
-- Stock images offered in the gallery editor's "sample library" (platform level, never tenant data).
CREATE TABLE sample_photos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url        text NOT NULL UNIQUE,
  title      text NOT NULL DEFAULT '',
  category   text NOT NULL DEFAULT 'wedding',
  width      integer NOT NULL DEFAULT 1200,
  height     integer NOT NULL DEFAULT 800,
  created_at timestamptz NOT NULL DEFAULT now()
);
 
/* ======================================================================== tenancy */
CREATE TABLE tenants (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                 text NOT NULL CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
  name                 text NOT NULL CHECK (length(btrim(name)) > 0),
  status               text NOT NULL DEFAULT 'trial' CHECK (status IN ('active','inactive','trial')),
  plan_id              uuid NOT NULL REFERENCES plans(id),
  subscription_status  text NOT NULL DEFAULT 'trialing' CHECK (subscription_status IN ('trialing','active','past_due','cancelled')),
  renews_at            date,
  subdomain            text NOT NULL CHECK (subdomain ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
  custom_domain        text CHECK (custom_domain IS NULL OR custom_domain = lower(custom_domain)),
  owner_name           text NOT NULL,
  owner_email          text NOT NULL,
  city                 text NOT NULL DEFAULT '',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);
CREATE UNIQUE INDEX tenants_slug_uq      ON tenants (slug)              WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX tenants_subdomain_uq ON tenants (subdomain)         WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX tenants_domain_uq    ON tenants (custom_domain)     WHERE deleted_at IS NULL AND custom_domain IS NOT NULL;
CREATE INDEX tenants_plan_idx ON tenants (plan_id);
 
-- Website content + business settings. One JSONB column per section keeps partial updates simple (validated by Zod in the API).
CREATE TABLE tenant_configs (
  tenant_id  uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  branding   jsonb NOT NULL DEFAULT '{}',
  home       jsonb NOT NULL DEFAULT '{}',
  about      jsonb NOT NULL DEFAULT '{}',
  contact    jsonb NOT NULL DEFAULT '{}',
  social     jsonb NOT NULL DEFAULT '{}',
  footer     jsonb NOT NULL DEFAULT '{}',
  settings   jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
 
/* ======================================================================== identity */
CREATE TABLE users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid REFERENCES tenants(id) ON DELETE CASCADE,          -- NULL only for platform super admins
  role                 text NOT NULL CHECK (role IN ('super_admin','studio_admin','photographer','client')),
  name                 text NOT NULL,
  email                text NOT NULL,
  phone                text NOT NULL DEFAULT '',
  avatar_url           text NOT NULL DEFAULT '',
  password_hash        text NOT NULL,                                          -- scrypt$N$r$p$salt$hash — never plain text
  status               text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  last_login_at        timestamptz,
  password_changed_at  timestamptz NOT NULL DEFAULT now(),                     -- JWTs issued before this are rejected
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz,
  CONSTRAINT users_role_tenant_ck CHECK ((role = 'super_admin') = (tenant_id IS NULL)),
  CONSTRAINT users_tenant_id_uq UNIQUE (tenant_id, id)
);
CREATE UNIQUE INDEX users_email_tenant_uq   ON users (tenant_id, lower(email)) WHERE tenant_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX users_email_platform_uq ON users (lower(email))            WHERE tenant_id IS NULL     AND deleted_at IS NULL;
 
/* ======================================================================== studio catalogue */
CREATE TABLE photographers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id           uuid,
  name              text NOT NULL,
  slug              text NOT NULL,
  title             text NOT NULL DEFAULT '',
  bio               text NOT NULL DEFAULT '',
  avatar_url        text NOT NULL DEFAULT '',
  email             text NOT NULL,
  phone             text NOT NULL DEFAULT '',
  experience_years  integer NOT NULL DEFAULT 1 CHECK (experience_years BETWEEN 0 AND 80),
  rating            numeric(2,1) NOT NULL DEFAULT 5.0 CHECK (rating BETWEEN 0 AND 5),
  specialties       text[] NOT NULL DEFAULT '{}',
  skills            text[] NOT NULL DEFAULT '{}',
  equipment         text[] NOT NULL DEFAULT '{}',
  portfolio         text[] NOT NULL DEFAULT '{}',
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_leave','inactive')),
  featured          boolean NOT NULL DEFAULT false,
  availability      jsonb NOT NULL DEFAULT '{"weekdays":[1,2,3,4,5,6],"blockedDates":[],"note":""}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  CONSTRAINT photographers_tenant_id_uq UNIQUE (tenant_id, id),
  CONSTRAINT photographers_user_fk FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id)
);
CREATE UNIQUE INDEX photographers_slug_uq ON photographers (tenant_id, slug) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX photographers_user_uq ON photographers (user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX photographers_list_idx ON photographers (tenant_id, status, featured);
 
CREATE TABLE clients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     uuid,
  name        text NOT NULL,
  email       text NOT NULL,
  phone       text NOT NULL DEFAULT '',
  city        text NOT NULL DEFAULT '',
  notes       text NOT NULL DEFAULT '',
  source      text NOT NULL DEFAULT 'website' CHECK (source IN ('website','whatsapp','referral','walk-in')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  CONSTRAINT clients_tenant_id_uq UNIQUE (tenant_id, id),
  CONSTRAINT clients_user_fk FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id)
);
CREATE UNIQUE INDEX clients_email_uq ON clients (tenant_id, lower(email)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX clients_user_uq  ON clients (user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX clients_created_idx ON clients (tenant_id, created_at DESC);
 
CREATE TABLE services (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  slug            text NOT NULL,
  category        text NOT NULL CHECK (category IN ('wedding','pre-wedding','engagement','birthday','corporate','fashion','product','event','portrait')),
  description     text NOT NULL DEFAULT '',
  starting_price  numeric(12,2) NOT NULL DEFAULT 0 CHECK (starting_price >= 0),
  image_url       text NOT NULL DEFAULT '',
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  featured        boolean NOT NULL DEFAULT false,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CONSTRAINT services_tenant_id_uq UNIQUE (tenant_id, id)
);
CREATE UNIQUE INDEX services_slug_uq ON services (tenant_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX services_list_idx ON services (tenant_id, status, sort_order);
 
CREATE TABLE packages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id          uuid NOT NULL,
  name                text NOT NULL,
  description         text NOT NULL DEFAULT '',
  price               numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  duration_hours      integer NOT NULL DEFAULT 4 CHECK (duration_hours > 0),
  photographer_count  integer NOT NULL DEFAULT 1 CHECK (photographer_count > 0),
  deliverables        text[] NOT NULL DEFAULT '{}',
  features            text[] NOT NULL DEFAULT '{}',
  popular             boolean NOT NULL DEFAULT false,
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  CONSTRAINT packages_tenant_id_uq UNIQUE (tenant_id, id),
  CONSTRAINT packages_service_fk FOREIGN KEY (tenant_id, service_id) REFERENCES services (tenant_id, id)
);
CREATE INDEX packages_service_idx ON packages (tenant_id, service_id, sort_order);
 
/* ======================================================================== bookings */
CREATE TABLE bookings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reference        text NOT NULL,
  client_id        uuid,
  customer_name    text NOT NULL,
  customer_email   text NOT NULL,
  customer_phone   text NOT NULL DEFAULT '',
  service_id       uuid NOT NULL,
  package_id       uuid,
  event_date       date NOT NULL,
  location         text NOT NULL,
  guest_count      integer CHECK (guest_count IS NULL OR guest_count >= 0),
  requirements     text NOT NULL DEFAULT '',
  status           text NOT NULL DEFAULT 'enquiry' CHECK (status IN ('enquiry','pending','confirmed','completed','rejected','cancelled')),
  payment_status   text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid','refunded')),
  amount           numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  paid_amount      numeric(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  source           text NOT NULL DEFAULT 'website' CHECK (source IN ('website','whatsapp','referral','manual')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  CONSTRAINT bookings_tenant_id_uq UNIQUE (tenant_id, id),
  CONSTRAINT bookings_client_fk  FOREIGN KEY (tenant_id, client_id)  REFERENCES clients  (tenant_id, id),
  CONSTRAINT bookings_service_fk FOREIGN KEY (tenant_id, service_id) REFERENCES services (tenant_id, id),
  CONSTRAINT bookings_package_fk FOREIGN KEY (tenant_id, package_id) REFERENCES packages (tenant_id, id)
);
CREATE UNIQUE INDEX bookings_reference_uq ON bookings (tenant_id, reference);
CREATE INDEX bookings_status_idx ON bookings (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX bookings_date_idx   ON bookings (tenant_id, event_date) WHERE deleted_at IS NULL;
CREATE INDEX bookings_client_idx ON bookings (tenant_id, client_id) WHERE deleted_at IS NULL;
CREATE INDEX bookings_created_idx ON bookings (tenant_id, created_at DESC);
 
CREATE TABLE booking_photographers (
  tenant_id        uuid NOT NULL,
  booking_id       uuid NOT NULL,
  photographer_id  uuid NOT NULL,
  position         smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (booking_id, photographer_id),
  FOREIGN KEY (tenant_id, booking_id)      REFERENCES bookings      (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, photographer_id) REFERENCES photographers (tenant_id, id)
);
CREATE INDEX booking_photographers_ph_idx ON booking_photographers (tenant_id, photographer_id);
 
CREATE TABLE booking_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  booking_id      uuid NOT NULL,
  author_user_id  uuid,
  author_name     text NOT NULL,
  text            text NOT NULL CHECK (length(btrim(text)) > 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, booking_id) REFERENCES bookings (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX booking_notes_idx ON booking_notes (booking_id, created_at);
 
/* ======================================================================== events + next-day delivery */
CREATE TABLE events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id    uuid,
  client_id     uuid,
  title         text NOT NULL,
  type          text NOT NULL CHECK (type IN ('wedding','pre-wedding','engagement','birthday','corporate','fashion','product','event','portrait')),
  date          date NOT NULL,
  start_time    text NOT NULL DEFAULT '10:00' CHECK (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  venue         text NOT NULL DEFAULT '',
  city          text NOT NULL DEFAULT '',
  description   text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  progress      text NOT NULL DEFAULT 'planned' CHECK (progress IN ('planned','shooting','wrapped','editing','delivered')),
  is_public     boolean NOT NULL DEFAULT false,
  cover_url     text NOT NULL DEFAULT '',
  -- delivery workflow. Overdue is informational only: nothing here is ever flipped automatically by a clock.
  delivery_target_hours             integer NOT NULL DEFAULT 24 CHECK (delivery_target_hours BETWEEN 1 AND 720),
  delivery_completed_at             timestamptz,
  delivery_highlights_submitted_at  timestamptz,
  delivery_highlights_published_at  timestamptz,
  delivery_gallery_published_at     timestamptz,
  delivery_notes                    text NOT NULL DEFAULT '',
  delivery_status text GENERATED ALWAYS AS (
    CASE WHEN delivery_gallery_published_at    IS NOT NULL THEN 'delivered'
         WHEN delivery_highlights_published_at IS NOT NULL THEN 'highlights_published'
         WHEN delivery_highlights_submitted_at IS NOT NULL THEN 'highlights_submitted'
         WHEN delivery_completed_at            IS NOT NULL THEN 'pending'
         ELSE 'not_due' END) STORED,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  CONSTRAINT events_tenant_id_uq UNIQUE (tenant_id, id),
  CONSTRAINT events_booking_fk FOREIGN KEY (tenant_id, booking_id) REFERENCES bookings (tenant_id, id),
  CONSTRAINT events_client_fk  FOREIGN KEY (tenant_id, client_id)  REFERENCES clients  (tenant_id, id)
);
CREATE UNIQUE INDEX events_booking_uq ON events (booking_id) WHERE booking_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX events_date_idx     ON events (tenant_id, date DESC) WHERE deleted_at IS NULL;
CREATE INDEX events_status_idx   ON events (tenant_id, status)    WHERE deleted_at IS NULL;
CREATE INDEX events_delivery_idx ON events (tenant_id, delivery_status) WHERE deleted_at IS NULL;
CREATE INDEX events_client_idx   ON events (tenant_id, client_id) WHERE deleted_at IS NULL;
 
CREATE TABLE event_photographers (
  tenant_id        uuid NOT NULL,
  event_id         uuid NOT NULL,
  photographer_id  uuid NOT NULL,
  position         smallint NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, photographer_id),
  FOREIGN KEY (tenant_id, event_id)        REFERENCES events        (tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, photographer_id) REFERENCES photographers (tenant_id, id)
);
CREATE INDEX event_photographers_ph_idx ON event_photographers (tenant_id, photographer_id);
 
CREATE TABLE event_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  event_id        uuid NOT NULL,
  author_user_id  uuid,
  author_name     text NOT NULL,
  author_role     text NOT NULL CHECK (author_role IN ('super_admin','studio_admin','photographer','client')),
  text            text NOT NULL CHECK (length(btrim(text)) > 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, event_id) REFERENCES events (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX event_notes_idx ON event_notes (event_id, created_at);
 
/* ======================================================================== galleries & media */
CREATE TABLE galleries (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id                  uuid,
  client_id                 uuid,
  title                     text NOT NULL CHECK (length(btrim(title)) > 0),
  description               text NOT NULL DEFAULT '',
  cover_url                 text NOT NULL DEFAULT '',
  visibility                text NOT NULL DEFAULT 'client' CHECK (visibility IN ('private','client','public')),
  highlights_submitted_at   timestamptz,
  highlights_published_at   timestamptz,
  complete_published_at     timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  deleted_at                timestamptz,
  CONSTRAINT galleries_tenant_id_uq UNIQUE (tenant_id, id),
  CONSTRAINT galleries_event_fk  FOREIGN KEY (tenant_id, event_id)  REFERENCES events  (tenant_id, id),
  CONSTRAINT galleries_client_fk FOREIGN KEY (tenant_id, client_id) REFERENCES clients (tenant_id, id)
);
CREATE INDEX galleries_event_idx  ON galleries (tenant_id, event_id)  WHERE deleted_at IS NULL;
CREATE INDEX galleries_client_idx ON galleries (tenant_id, client_id) WHERE deleted_at IS NULL;
CREATE INDEX galleries_updated_idx ON galleries (tenant_id, updated_at DESC) WHERE deleted_at IS NULL;
 
CREATE TABLE gallery_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  gallery_id   uuid NOT NULL,
  url          text NOT NULL CHECK (url ~* '^https?://'),
  title        text NOT NULL DEFAULT 'Untitled',
  description  text NOT NULL DEFAULT '',
  category     text NOT NULL DEFAULT 'wedding' CHECK (category IN ('wedding','pre-wedding','engagement','birthday','corporate','fashion','product','event','portrait')),
  is_highlight boolean NOT NULL DEFAULT false,
  featured     boolean NOT NULL DEFAULT false,
  sort_order   integer NOT NULL DEFAULT 0,
  width        integer NOT NULL DEFAULT 1200 CHECK (width > 0),
  height       integer NOT NULL DEFAULT 800 CHECK (height > 0),
  camera       text,
  lens         text,
  exposure     text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gallery_photos_tenant_id_uq UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, gallery_id) REFERENCES galleries (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX gallery_photos_idx ON gallery_photos (gallery_id, sort_order);
CREATE INDEX gallery_photos_hl_idx ON gallery_photos (gallery_id) WHERE is_highlight;
 
-- Delivery links outside the platform (Pixieset, WeTransfer, …). https only; access is controlled by the third party.
CREATE TABLE gallery_external_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  gallery_id  uuid NOT NULL,
  label       text NOT NULL,
  url         text NOT NULL CHECK (url ~* '^https://'),
  sort_order  integer NOT NULL DEFAULT 0,
  FOREIGN KEY (tenant_id, gallery_id) REFERENCES galleries (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX gallery_links_idx ON gallery_external_links (gallery_id, sort_order);
 
CREATE TABLE videos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title          text NOT NULL,
  description    text NOT NULL DEFAULT '',
  youtube_url    text NOT NULL,
  youtube_id     text NOT NULL CHECK (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  category       text NOT NULL DEFAULT 'showcase' CHECK (category IN ('wedding','pre-wedding','event','showcase')),
  thumbnail_url  text NOT NULL DEFAULT '',
  featured       boolean NOT NULL DEFAULT false,
  enabled        boolean NOT NULL DEFAULT true,
  visibility     text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','client')),
  event_id       uuid,
  client_id      uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz,
  CONSTRAINT videos_tenant_id_uq UNIQUE (tenant_id, id),
  CONSTRAINT videos_event_fk  FOREIGN KEY (tenant_id, event_id)  REFERENCES events  (tenant_id, id),
  CONSTRAINT videos_client_fk FOREIGN KEY (tenant_id, client_id) REFERENCES clients (tenant_id, id)
);
CREATE INDEX videos_list_idx ON videos (tenant_id, enabled, visibility, created_at DESC) WHERE deleted_at IS NULL;
 
CREATE TABLE drive_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title        text NOT NULL,
  url          text NOT NULL CHECK (url ~ '^https://drive\.google\.com/'),
  folder_id    text NOT NULL,
  description  text NOT NULL DEFAULT '',
  event_id     uuid,
  client_id    uuid,
  visibility   text NOT NULL DEFAULT 'client' CHECK (visibility IN ('client','private')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  CONSTRAINT drive_links_tenant_id_uq UNIQUE (tenant_id, id),
  CONSTRAINT drive_links_event_fk  FOREIGN KEY (tenant_id, event_id)  REFERENCES events  (tenant_id, id),
  CONSTRAINT drive_links_client_fk FOREIGN KEY (tenant_id, client_id) REFERENCES clients (tenant_id, id)
);
CREATE INDEX drive_links_client_idx ON drive_links (tenant_id, client_id, visibility) WHERE deleted_at IS NULL;
 
/* ======================================================================== website content & ops */
CREATE TABLE testimonials (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  role        text NOT NULL DEFAULT '',
  event_type  text NOT NULL DEFAULT 'wedding' CHECK (event_type IN ('wedding','pre-wedding','engagement','birthday','corporate','fashion','product','event','portrait')),
  rating      integer NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  quote       text NOT NULL,
  avatar_url  text NOT NULL DEFAULT '',
  featured    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  CONSTRAINT testimonials_tenant_id_uq UNIQUE (tenant_id, id)
);
CREATE INDEX testimonials_idx ON testimonials (tenant_id, featured, created_at DESC) WHERE deleted_at IS NULL;
 
CREATE TABLE blog_posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug          text NOT NULL,
  title         text NOT NULL,
  excerpt       text NOT NULL DEFAULT '',
  body          text NOT NULL DEFAULT '',
  cover_url     text NOT NULL DEFAULT '',
  category      text NOT NULL DEFAULT 'tips' CHECK (category IN ('tips','stories')),
  author_name   text NOT NULL DEFAULT '',
  read_minutes  integer NOT NULL DEFAULT 3 CHECK (read_minutes > 0),
  published_at  timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL DEFAULT 'published' CHECK (status IN ('published','draft')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  CONSTRAINT blog_posts_tenant_id_uq UNIQUE (tenant_id, id)
);
CREATE UNIQUE INDEX blog_posts_slug_uq ON blog_posts (tenant_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX blog_posts_idx ON blog_posts (tenant_id, status, published_at DESC) WHERE deleted_at IS NULL;
 
CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  user_id     uuid NOT NULL,
  type        text NOT NULL CHECK (type IN ('booking_confirmed','booking_update','event_reminder','highlights_published','gallery_published','new_enquiry','delivery_overdue','system')),
  title       text NOT NULL,
  body        text NOT NULL DEFAULT '',
  link        text NOT NULL DEFAULT '',
  read        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX notifications_user_idx ON notifications (tenant_id, user_id, read, created_at DESC);
 
-- Public "contact us" form submissions (also fanned out to admins as notifications).
CREATE TABLE contact_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  email       text NOT NULL,
  phone       text NOT NULL DEFAULT '',
  message     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contact_messages_idx ON contact_messages (tenant_id, created_at DESC);
 
-- Append-only trail of security-relevant and workflow actions.
CREATE TABLE audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid,
  user_id     uuid,
  action      text NOT NULL,
  entity      text NOT NULL,
  entity_id   uuid,
  metadata    jsonb NOT NULL DEFAULT '{}',
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_tenant_idx ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity, entity_id);
 
/* ======================================================================== updated_at triggers */
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['plans','platform_settings','tenants','tenant_configs','users','photographers','clients','services','packages',
                            'bookings','events','galleries','videos','drive_links','testimonials','blog_posts']
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t || '_updated_at', t);
  END LOOP;
END $$;