export type RoomRow = {
  id: number;
  name: string;
  location: string | null;
  isActive: boolean;
  deviceCount: number;
  lastTemperature: number | null;
  lastHumidity: number | null;
  lastMeasuredAt: string | null;
  status: "OK" | "ATENCAO" | "CRITICO" | "SEM_LEITURA";
};

export type DeviceRow = {
  id: number;
  name: string;
  type: "PORTARIA" | "SALA";
  roomId: number | null;
  roomName: string | null;
  isActive: boolean;
  createdAt: string;
};

export type AccessEventRow = {
  id: number;
  deviceName: string;
  studentId: number;
  result: "ALLOW" | "DENY";
  reason: string;
  occurredAt: string;
  createdAt: string;
};

export type TelemetryRow = {
  id: number;
  roomId: number;
  roomName: string;
  deviceName: string;
  temperature: number;
  humidity: number;
  measuredAt: string;
  status: "OK" | "ATENCAO" | "CRITICO";
};
