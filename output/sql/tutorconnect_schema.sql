create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text,
  full_name text not null,
  phone text unique,
  avatar_url text,
  role text not null default 'STUDENT',
  status text not null default 'PENDING_EMAIL_VERIFICATION',
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tutor_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  headline text,
  bio text,
  avatar_url text,
  intro_video_url text,
  experience_years integer,
  hourly_rate numeric(12, 2),
  teaching_mode text not null default 'BOTH',
  location_city text,
  location_district text,
  verification_status text not null default 'DRAFT',
  verification_submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  rating_avg numeric(3, 2) not null default 0,
  total_sessions integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tutor_subjects (
  id uuid primary key default gen_random_uuid(),
  tutor_profile_id uuid not null references tutor_profiles(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete restrict,
  level text not null default 'BASIC',
  created_at timestamptz not null default now(),
  unique (tutor_profile_id, subject_id, level)
);

create table if not exists tutor_documents (
  id uuid primary key default gen_random_uuid(),
  tutor_profile_id uuid not null references tutor_profiles(id) on delete cascade,
  uploaded_by_id uuid not null references users(id) on delete restrict,
  reviewed_by_id uuid references users(id) on delete set null,
  type text not null,
  status text not null default 'PENDING',
  file_name text not null,
  file_path text not null,
  mime_type text not null,
  file_size_bytes integer not null,
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists availability_slots (
  id uuid primary key default gen_random_uuid(),
  tutor_profile_id uuid not null references tutor_profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_booked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references users(id) on delete restrict,
  tutor_profile_id uuid not null references tutor_profiles(id) on delete restrict,
  availability_slot_id uuid not null unique references availability_slots(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  hourly_rate_snapshot numeric(12, 2) not null default 0,
  gross_amount_snapshot numeric(12, 2) not null default 0,
  teaching_mode text not null default 'ONLINE',
  status text not null default 'PENDING',
  student_note text,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings(id) on delete restrict,
  payer_id uuid not null references users(id) on delete restrict,
  amount numeric(12, 2) not null,
  platform_fee_amount numeric(12, 2) not null default 0,
  tutor_payout_amount numeric(12, 2) not null default 0,
  currency text not null default 'VND',
  provider text not null default 'MOCK',
  status text not null default 'PENDING',
  payout_status text not null default 'HELD',
  checkout_url text,
  provider_txn_ref text,
  paid_at timestamptz,
  refunded_at timestamptz,
  refund_reason text,
  revenue_released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings(id) on delete restrict,
  student_id uuid not null references users(id) on delete restrict,
  tutor_profile_id uuid not null references tutor_profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique references bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  last_read_at timestamptz,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references users(id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists tutor_wallets (
  id uuid primary key default gen_random_uuid(),
  tutor_profile_id uuid not null unique references tutor_profiles(id) on delete cascade,
  available_balance numeric(12, 2) not null default 0,
  withdrawn_balance numeric(12, 2) not null default 0,
  currency text not null default 'VND',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists withdrawals (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references tutor_wallets(id) on delete restrict,
  tutor_profile_id uuid not null references tutor_profiles(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'VND',
  status text not null default 'PENDING',
  bank_name text not null,
  bank_account_number text not null,
  bank_account_name text not null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  rejection_reason text
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references users(id) on delete restrict,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  reason text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_refresh_tokens_user_id on refresh_tokens(user_id);
create index if not exists idx_tutor_profiles_verification_status on tutor_profiles(verification_status);
create index if not exists idx_tutor_profiles_location on tutor_profiles(location_city, location_district);
create index if not exists idx_tutor_subjects_subject_id on tutor_subjects(subject_id);
create index if not exists idx_tutor_documents_status on tutor_documents(status);
create index if not exists idx_availability_slots_tutor_time on availability_slots(tutor_profile_id, starts_at);
create index if not exists idx_bookings_student_time on bookings(student_id, starts_at);
create index if not exists idx_bookings_tutor_time on bookings(tutor_profile_id, starts_at);
create index if not exists idx_payments_payer_id on payments(payer_id);
create index if not exists idx_payments_status on payments(status);
create index if not exists idx_reviews_tutor_time on reviews(tutor_profile_id, created_at);
create index if not exists idx_messages_conversation_time on messages(conversation_id, created_at);
create index if not exists idx_notifications_user_read_time on notifications(user_id, read_at, created_at);
create index if not exists idx_admin_audit_actor on admin_audit_logs(actor_id);
