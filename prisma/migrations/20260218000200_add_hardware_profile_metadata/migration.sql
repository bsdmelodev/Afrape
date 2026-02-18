ALTER TABLE "monitoring_settings"
  ADD COLUMN "hardware_profile" JSONB;

UPDATE "monitoring_settings"
SET "hardware_profile" = jsonb_build_object(
  'transport', 'HTTP_REST',
  'esp32', jsonb_build_object(
    'connectivity', 'WIFI'
  ),
  'telemetry', jsonb_build_object(
    'sensorModel', 'SHT31',
    'supportedSensorModels', jsonb_build_array('SHT31', 'SHT35'),
    'i2cAddress', '0x44',
    'endpoint', '/api/iot/telemetry'
  ),
  'access', jsonb_build_object(
    'readerModel', 'PN532',
    'frequencyMHz', 13.56,
    'endpoint', '/api/iot/access'
  )
)
WHERE "hardware_profile" IS NULL;

ALTER TABLE "access_events"
  ADD COLUMN "metadata" JSONB;

ALTER TABLE "telemetry_readings"
  ADD COLUMN "metadata" JSONB;
