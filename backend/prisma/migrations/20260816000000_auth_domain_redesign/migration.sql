-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'FACULTY_MENTOR', 'LAB_ASSISTANT', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'TEAM_ACCEPTANCE_PENDING', 'MENTOR_APPROVAL_PENDING', 'VERIFIED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectMemberRole" AS ENUM ('LEADER', 'MEMBER');

-- CreateEnum
CREATE TYPE "ProjectMemberStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'REMOVED');

-- CreateEnum
CREATE TYPE "MentorRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('AVAILABLE', 'PARTIALLY_AVAILABLE', 'IN_USE', 'UNAVAILABLE', 'UNDER_MAINTENANCE', 'DAMAGED', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('OPEN', 'BLOCKED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "QuickVisitStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('EXPECTED', 'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "google_subject" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "roles" "UserRole"[] DEFAULT ARRAY['STUDENT']::"UserRole"[],
    "profile_complete" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_provisioning" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "roles" "UserRole"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "claimed_by_id" UUID,
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_provisioning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programmes" (
    "id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programmes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "user_id" UUID NOT NULL,
    "prn" VARCHAR(10) NOT NULL,
    "department_id" UUID NOT NULL,
    "programme_id" UUID NOT NULL,
    "academic_year" INTEGER NOT NULL,
    "division" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "labs" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "time_zone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "slot_duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "booking_capacity" INTEGER NOT NULL DEFAULT 20,
    "quick_visit_capacity" INTEGER NOT NULL DEFAULT 10,
    "booking_horizon_days" INTEGER NOT NULL DEFAULT 14,
    "cancellation_window_hours" INTEGER NOT NULL DEFAULT 2,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_schedules" (
    "id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "opens_at_minute" INTEGER NOT NULL,
    "closes_at_minute" INTEGER NOT NULL,
    "is_open" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "lab_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_closures" (
    "id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_closures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_slots" (
    "id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "booking_capacity" INTEGER NOT NULL,
    "quick_visit_capacity" INTEGER NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_categories" (
    "id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "image_url" TEXT,
    "total_quantity" INTEGER NOT NULL DEFAULT 1,
    "available_quantity" INTEGER NOT NULL DEFAULT 1,
    "specs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumable_categories" (
    "id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumable_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumables" (
    "id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "current_mentor_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "domain" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "user_id" UUID,
    "email" TEXT NOT NULL,
    "role" "ProjectMemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "ProjectMemberStatus" NOT NULL DEFAULT 'INVITED',
    "invitation_token_hash" TEXT,
    "invitation_expires_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "removed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_requests" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "faculty_id" UUID NOT NULL,
    "status" "MentorRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "mentor_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_equipment_requirements" (
    "project_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,

    CONSTRAINT "project_equipment_requirements_pkey" PRIMARY KEY ("project_id","equipment_id")
);

-- CreateTable
CREATE TABLE "project_consumable_requirements" (
    "project_id" UUID NOT NULL,
    "consumable_id" UUID NOT NULL,
    "expected_quantity" DECIMAL(12,3),
    "notes" TEXT,

    CONSTRAINT "project_consumable_requirements_pkey" PRIMARY KEY ("project_id","consumable_id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "lab_slot_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "cancelled_by_id" UUID,
    "idempotency_key" UUID NOT NULL,
    "attendee_count" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "qr_token_hash" TEXT,
    "qr_expires_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_participants" (
    "booking_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "attendance_status" "AttendanceStatus" NOT NULL DEFAULT 'EXPECTED',

    CONSTRAINT "booking_participants_pkey" PRIMARY KEY ("booking_id","user_id")
);

-- CreateTable
CREATE TABLE "booking_equipment" (
    "booking_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "booking_equipment_pkey" PRIMARY KEY ("booking_id","equipment_id")
);

-- CreateTable
CREATE TABLE "booking_consumables" (
    "booking_id" UUID NOT NULL,
    "consumable_id" UUID NOT NULL,
    "expected_quantity" DECIMAL(12,3),

    CONSTRAINT "booking_consumables_pkey" PRIMARY KEY ("booking_id","consumable_id")
);

-- CreateTable
CREATE TABLE "quick_visits" (
    "id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "lab_slot_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "QuickVisitStatus" NOT NULL DEFAULT 'REQUESTED',
    "qr_token_hash" TEXT,
    "qr_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "booking_id" UUID,
    "quick_visit_id" UUID,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'CHECKED_IN',
    "checked_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checked_out_at" TIMESTAMP(3),
    "checked_in_by_id" UUID NOT NULL,
    "checked_out_by_id" UUID,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "lab_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "organizer_id" UUID NOT NULL,
    "location" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_registrations" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "provider_id" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploads" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_google_subject_key" ON "users"("google_subject");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_roles_idx" ON "users" USING GIN ("roles");

-- CreateIndex
CREATE INDEX "users_is_active_deleted_at_idx" ON "users"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_provisioning_email_key" ON "user_provisioning"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_provisioning_claimed_by_id_key" ON "user_provisioning"("claimed_by_id");

-- CreateIndex
CREATE INDEX "user_provisioning_is_active_claimed_at_idx" ON "user_provisioning"("is_active", "claimed_at");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE INDEX "programmes_department_id_is_active_idx" ON "programmes"("department_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "programmes_department_id_code_key" ON "programmes"("department_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_prn_key" ON "student_profiles"("prn");

-- CreateIndex
CREATE INDEX "student_profiles_department_id_idx" ON "student_profiles"("department_id");

-- CreateIndex
CREATE INDEX "student_profiles_programme_id_academic_year_idx" ON "student_profiles"("programme_id", "academic_year");

-- CreateIndex
CREATE UNIQUE INDEX "labs_name_key" ON "labs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "labs_code_key" ON "labs"("code");

-- CreateIndex
CREATE INDEX "labs_is_active_idx" ON "labs"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "lab_schedules_lab_id_day_of_week_key" ON "lab_schedules"("lab_id", "day_of_week");

-- CreateIndex
CREATE INDEX "lab_closures_lab_id_starts_at_ends_at_idx" ON "lab_closures"("lab_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "lab_slots_lab_id_status_starts_at_idx" ON "lab_slots"("lab_id", "status", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "lab_slots_lab_id_starts_at_ends_at_key" ON "lab_slots"("lab_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "equipment_categories_lab_id_is_active_idx" ON "equipment_categories"("lab_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_categories_lab_id_name_key" ON "equipment_categories"("lab_id", "name");

-- CreateIndex
CREATE INDEX "equipment_lab_id_category_id_status_idx" ON "equipment"("lab_id", "category_id", "status");

-- CreateIndex
CREATE INDEX "equipment_visible_deleted_at_idx" ON "equipment"("visible", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_lab_id_name_key" ON "equipment"("lab_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "consumable_categories_lab_id_name_key" ON "consumable_categories"("lab_id", "name");

-- CreateIndex
CREATE INDEX "consumables_lab_id_category_id_is_active_idx" ON "consumables"("lab_id", "category_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "consumables_lab_id_name_key" ON "consumables"("lab_id", "name");

-- CreateIndex
CREATE INDEX "projects_creator_id_status_idx" ON "projects"("creator_id", "status");

-- CreateIndex
CREATE INDEX "projects_current_mentor_id_status_idx" ON "projects"("current_mentor_id", "status");

-- CreateIndex
CREATE INDEX "projects_lab_id_status_created_at_idx" ON "projects"("lab_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_invitation_token_hash_key" ON "project_members"("invitation_token_hash");

-- CreateIndex
CREATE INDEX "project_members_user_id_status_idx" ON "project_members"("user_id", "status");

-- CreateIndex
CREATE INDEX "project_members_email_status_idx" ON "project_members"("email", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_email_key" ON "project_members"("project_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "mentor_requests_faculty_id_status_requested_at_idx" ON "mentor_requests"("faculty_id", "status", "requested_at");

-- CreateIndex
CREATE INDEX "mentor_requests_project_id_status_idx" ON "mentor_requests"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_qr_token_hash_key" ON "bookings"("qr_token_hash");

-- CreateIndex
CREATE INDEX "bookings_lab_slot_id_status_idx" ON "bookings"("lab_slot_id", "status");

-- CreateIndex
CREATE INDEX "bookings_project_id_created_at_idx" ON "bookings"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "bookings_created_by_id_status_created_at_idx" ON "bookings"("created_by_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_created_by_id_idempotency_key_key" ON "bookings"("created_by_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "booking_participants_user_id_attendance_status_idx" ON "booking_participants"("user_id", "attendance_status");

-- CreateIndex
CREATE UNIQUE INDEX "quick_visits_qr_token_hash_key" ON "quick_visits"("qr_token_hash");

-- CreateIndex
CREATE INDEX "quick_visits_lab_slot_id_status_idx" ON "quick_visits"("lab_slot_id", "status");

-- CreateIndex
CREATE INDEX "quick_visits_user_id_created_at_idx" ON "quick_visits"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "quick_visits_user_id_idempotency_key_key" ON "quick_visits"("user_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "visits_quick_visit_id_key" ON "visits"("quick_visit_id");

-- CreateIndex
CREATE INDEX "visits_lab_id_status_checked_in_at_idx" ON "visits"("lab_id", "status", "checked_in_at");

-- CreateIndex
CREATE INDEX "visits_user_id_checked_in_at_idx" ON "visits"("user_id", "checked_in_at");

-- CreateIndex
CREATE UNIQUE INDEX "visits_booking_id_user_id_key" ON "visits"("booking_id", "user_id");

-- CreateIndex
CREATE INDEX "events_lab_id_start_time_idx" ON "events"("lab_id", "start_time");

-- CreateIndex
CREATE INDEX "events_organizer_id_idx" ON "events"("organizer_id");

-- CreateIndex
CREATE INDEX "event_registrations_user_id_idx" ON "event_registrations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_event_id_user_id_key" ON "event_registrations"("event_id", "user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_created_at_idx" ON "notification_deliveries"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_notification_id_channel_key" ON "notification_deliveries"("notification_id", "channel");

-- CreateIndex
CREATE INDEX "uploads_owner_id_created_at_idx" ON "uploads"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_provisioning" ADD CONSTRAINT "user_provisioning_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_provisioning" ADD CONSTRAINT "user_provisioning_claimed_by_id_fkey" FOREIGN KEY ("claimed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programmes" ADD CONSTRAINT "programmes_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_programme_id_fkey" FOREIGN KEY ("programme_id") REFERENCES "programmes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labs" ADD CONSTRAINT "labs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_schedules" ADD CONSTRAINT "lab_schedules_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_closures" ADD CONSTRAINT "lab_closures_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_slots" ADD CONSTRAINT "lab_slots_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_categories" ADD CONSTRAINT "equipment_categories_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "equipment_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_categories" ADD CONSTRAINT "consumable_categories_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumables" ADD CONSTRAINT "consumables_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumables" ADD CONSTRAINT "consumables_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "consumable_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_current_mentor_id_fkey" FOREIGN KEY ("current_mentor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_requests" ADD CONSTRAINT "mentor_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_requests" ADD CONSTRAINT "mentor_requests_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_equipment_requirements" ADD CONSTRAINT "project_equipment_requirements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_equipment_requirements" ADD CONSTRAINT "project_equipment_requirements_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_consumable_requirements" ADD CONSTRAINT "project_consumable_requirements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_consumable_requirements" ADD CONSTRAINT "project_consumable_requirements_consumable_id_fkey" FOREIGN KEY ("consumable_id") REFERENCES "consumables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_lab_slot_id_fkey" FOREIGN KEY ("lab_slot_id") REFERENCES "lab_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_equipment" ADD CONSTRAINT "booking_equipment_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_equipment" ADD CONSTRAINT "booking_equipment_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_consumables" ADD CONSTRAINT "booking_consumables_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_consumables" ADD CONSTRAINT "booking_consumables_consumable_id_fkey" FOREIGN KEY ("consumable_id") REFERENCES "consumables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quick_visits" ADD CONSTRAINT "quick_visits_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quick_visits" ADD CONSTRAINT "quick_visits_lab_slot_id_fkey" FOREIGN KEY ("lab_slot_id") REFERENCES "lab_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quick_visits" ADD CONSTRAINT "quick_visits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_quick_visit_id_fkey" FOREIGN KEY ("quick_visit_id") REFERENCES "quick_visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_checked_in_by_id_fkey" FOREIGN KEY ("checked_in_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_checked_out_by_id_fkey" FOREIGN KEY ("checked_out_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Domain invariants that Prisma cannot express directly.
ALTER TABLE "users" ADD CONSTRAINT "users_roles_not_empty" CHECK (cardinality("roles") > 0);
ALTER TABLE "users" ADD CONSTRAINT "users_email_normalized" CHECK ("email" = lower("email"));
ALTER TABLE "user_provisioning" ADD CONSTRAINT "user_provisioning_roles_not_empty" CHECK (cardinality("roles") > 0);
ALTER TABLE "user_provisioning" ADD CONSTRAINT "user_provisioning_email_normalized" CHECK ("email" = lower("email"));
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_prn_format" CHECK ("prn" ~ '^[0-9]{10}$');
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_academic_year_range" CHECK ("academic_year" BETWEEN 1 AND 8);
ALTER TABLE "labs" ADD CONSTRAINT "labs_capacity_positive" CHECK ("booking_capacity" > 0 AND "quick_visit_capacity" > 0);
ALTER TABLE "labs" ADD CONSTRAINT "labs_policy_values_positive" CHECK ("slot_duration_minutes" > 0 AND "booking_horizon_days" > 0 AND "cancellation_window_hours" >= 0);
ALTER TABLE "lab_schedules" ADD CONSTRAINT "lab_schedules_day_range" CHECK ("day_of_week" BETWEEN 0 AND 6);
ALTER TABLE "lab_schedules" ADD CONSTRAINT "lab_schedules_minutes_range" CHECK ("opens_at_minute" BETWEEN 0 AND 1439 AND "closes_at_minute" BETWEEN 1 AND 1440 AND "opens_at_minute" < "closes_at_minute");
ALTER TABLE "lab_closures" ADD CONSTRAINT "lab_closures_valid_range" CHECK ("ends_at" > "starts_at");
ALTER TABLE "lab_slots" ADD CONSTRAINT "lab_slots_valid_range" CHECK ("ends_at" > "starts_at");
ALTER TABLE "lab_slots" ADD CONSTRAINT "lab_slots_capacity_positive" CHECK ("booking_capacity" > 0 AND "quick_visit_capacity" > 0);
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_quantities_valid" CHECK ("total_quantity" >= 0 AND "available_quantity" >= 0 AND "available_quantity" <= "total_quantity");
ALTER TABLE "project_equipment_requirements" ADD CONSTRAINT "project_equipment_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "project_consumable_requirements" ADD CONSTRAINT "project_consumable_quantity_positive" CHECK ("expected_quantity" IS NULL OR "expected_quantity" > 0);
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_attendee_count_positive" CHECK ("attendee_count" > 0);
ALTER TABLE "booking_equipment" ADD CONSTRAINT "booking_equipment_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "booking_consumables" ADD CONSTRAINT "booking_consumable_quantity_positive" CHECK ("expected_quantity" IS NULL OR "expected_quantity" > 0);
ALTER TABLE "events" ADD CONSTRAINT "events_valid_range" CHECK ("end_time" > "start_time");
ALTER TABLE "events" ADD CONSTRAINT "events_capacity_positive" CHECK ("capacity" > 0);
ALTER TABLE "visits" ADD CONSTRAINT "visits_exactly_one_source" CHECK (num_nonnulls("booking_id", "quick_visit_id") = 1);

CREATE UNIQUE INDEX "mentor_requests_one_pending_per_project"
ON "mentor_requests" ("project_id")
WHERE "status" = 'PENDING';
