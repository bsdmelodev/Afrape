CREATE TYPE "DeviceType" AS ENUM ('PORTARIA', 'SALA');
CREATE TYPE "AccessResult" AS ENUM ('ALLOW', 'DENY');

CREATE TABLE "rooms" (
  "id" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "name" VARCHAR(120) NOT NULL,
  "location" VARCHAR(180),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT now()
);

CREATE INDEX "ix_rooms_name" ON "rooms"("name");

CREATE TABLE "devices" (
  "id" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "name" VARCHAR(120) NOT NULL,
  "type" "DeviceType" NOT NULL,
  "room_id" INT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "token" VARCHAR(120) NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT now()
);

ALTER TABLE "devices"
  ADD CONSTRAINT "fk_devices_room"
  FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
  ON DELETE SET NULL;

CREATE UNIQUE INDEX "devices_token_key" ON "devices"("token");
CREATE INDEX "ix_devices_type" ON "devices"("type");
CREATE INDEX "ix_devices_room_id" ON "devices"("room_id");

CREATE TABLE "access_events" (
  "id" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "device_id" INT NOT NULL,
  "student_id" INT NOT NULL,
  "result" "AccessResult" NOT NULL,
  "reason" VARCHAR(50) NOT NULL,
  "occurred_at" TIMESTAMP(6) NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
  CONSTRAINT "fk_access_events_device"
    FOREIGN KEY ("device_id") REFERENCES "devices"("id")
    ON DELETE RESTRICT
);

CREATE INDEX "ix_access_events_device_occurred" ON "access_events"("device_id", "occurred_at");
CREATE INDEX "ix_access_events_student_occurred" ON "access_events"("student_id", "occurred_at");

CREATE TABLE "telemetry_readings" (
  "id" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "device_id" INT NOT NULL,
  "room_id" INT NOT NULL,
  "temperature" NUMERIC(5,2) NOT NULL,
  "humidity" NUMERIC(5,2) NOT NULL,
  "measured_at" TIMESTAMP(6) NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
  CONSTRAINT "fk_telemetry_readings_device"
    FOREIGN KEY ("device_id") REFERENCES "devices"("id")
    ON DELETE RESTRICT,
  CONSTRAINT "fk_telemetry_readings_room"
    FOREIGN KEY ("room_id") REFERENCES "rooms"("id")
    ON DELETE RESTRICT
);

CREATE INDEX "ix_telemetry_readings_room_measured" ON "telemetry_readings"("room_id", "measured_at");
CREATE INDEX "ix_telemetry_readings_device_measured" ON "telemetry_readings"("device_id", "measured_at");

CREATE TABLE "monitoring_settings" (
  "id" INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "temp_min" NUMERIC(5,2) NOT NULL,
  "temp_max" NUMERIC(5,2) NOT NULL,
  "hum_min" NUMERIC(5,2) NOT NULL,
  "hum_max" NUMERIC(5,2) NOT NULL,
  "telemetry_interval_seconds" INT NOT NULL,
  "unlock_duration_seconds" INT NOT NULL,
  "allow_only_active_students" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
  CONSTRAINT "ck_monitoring_settings_ranges"
    CHECK (temp_min < temp_max AND hum_min < hum_max),
  CONSTRAINT "ck_monitoring_settings_intervals"
    CHECK (telemetry_interval_seconds > 0 AND unlock_duration_seconds > 0)
);
