"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateTelemetryBatch, simulateRfidAccess, simulateTelemetry } from "../actions";

type RoomOption = { id: number; name: string };
type DeviceOption = { id: number; name: string; roomId: number | null; isActive: boolean };
type StudentOption = { id: number; name: string; isActive: boolean };
type HardwareProfile = {
  transport: "HTTP_REST";
  esp32: { connectivity: "WIFI" };
  telemetry: {
    sensorModel: "SHT31" | "SHT35";
    supportedSensorModels: ("SHT31" | "SHT35")[];
    i2cAddress: string;
    endpoint: string;
  };
  access: {
    readerModel: "PN532";
    frequencyMHz: number;
    endpoint: string;
  };
};

type AccessSimulationResult = {
  result: "ALLOW" | "DENY";
  reason: string;
  unlockDurationSeconds: number;
};

function randomHexUid(bytes = 4) {
  return Array.from({ length: bytes }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase()
  ).join("");
}

function normalizeI2cInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^0[xX][0-9A-Fa-f]{2}$/.test(trimmed)) {
    return `0x${trimmed.slice(2).toUpperCase()}`;
  }
  return trimmed;
}

export function HardwareSimulator({
  rooms,
  students,
  portariaDevices,
  salaDevices,
  hardwareProfile,
}: {
  rooms: RoomOption[];
  students: StudentOption[];
  portariaDevices: DeviceOption[];
  salaDevices: DeviceOption[];
  hardwareProfile: HardwareProfile;
}) {
  const [isPending, startTransition] = useTransition();

  const [portariaId, setPortariaId] = useState<string>(
    portariaDevices[0] ? String(portariaDevices[0].id) : ""
  );
  const [studentId, setStudentId] = useState(students[0] ? String(students[0].id) : "");
  const [cardUid, setCardUid] = useState("04A1B2C3");
  const [occurredAt, setOccurredAt] = useState("");
  const [accessResult, setAccessResult] = useState<AccessSimulationResult | null>(null);
  const [rfidMessage, setRfidMessage] = useState<string>("");
  const [autoRfidEnabled, setAutoRfidEnabled] = useState(false);
  const autoRfidBusyRef = useRef(false);
  const studentsRef = useRef(students);

  const [roomId, setRoomId] = useState<string>(rooms[0] ? String(rooms[0].id) : "");
  const [salaDeviceId, setSalaDeviceId] = useState<string>(
    salaDevices[0] ? String(salaDevices[0].id) : ""
  );
  const [temperature, setTemperature] = useState("26.5");
  const [humidity, setHumidity] = useState("58.2");
  const [sensorModel, setSensorModel] = useState<"SHT31" | "SHT35">(hardwareProfile.telemetry.sensorModel);
  const [i2cAddress, setI2cAddress] = useState(normalizeI2cInput(hardwareProfile.telemetry.i2cAddress));
  const [measuredAt, setMeasuredAt] = useState("");
  const [telemetryMessage, setTelemetryMessage] = useState<string>("");
  const [autoTelemetryEnabled, setAutoTelemetryEnabled] = useState(false);
  const autoTelemetryBusyRef = useRef(false);
  const lastAutoTelemetryAtRef = useRef(0);

  const [baseTemperature, setBaseTemperature] = useState("26");
  const [baseHumidity, setBaseHumidity] = useState("58");
  const [variation, setVariation] = useState("1.5");
  const [intervalSeconds, setIntervalSeconds] = useState("10");
  const [quantity, setQuantity] = useState("24");

  const [suggestedStudent, setSuggestedStudent] = useState(students[0] ? String(students[0].id) : "");
  const [suggestedTemperature, setSuggestedTemperature] = useState("26.5");
  const [suggestedHumidity, setSuggestedHumidity] = useState("58.2");

  const hasStudents = students.length > 0;
  const hasRooms = rooms.length > 0;
  const hasPortariaDevices = portariaDevices.length > 0;
  const hasSalaDevices = salaDevices.length > 0;

  const filteredSalaDevices = useMemo(() => {
    if (!roomId) return salaDevices;
    const target = Number(roomId);
    return salaDevices.filter((device) => device.roomId === null || device.roomId === target);
  }, [roomId, salaDevices]);

  useEffect(() => {
    if (!rooms.length) {
      setRoomId("");
      return;
    }
    const exists = rooms.some((room) => String(room.id) === roomId);
    if (!exists) {
      setRoomId(String(rooms[0].id));
    }
  }, [roomId, rooms]);

  useEffect(() => {
    if (!portariaDevices.length) {
      setPortariaId("");
      return;
    }
    const exists = portariaDevices.some((device) => String(device.id) === portariaId);
    if (!exists) {
      setPortariaId(String(portariaDevices[0].id));
    }
  }, [portariaDevices, portariaId]);

  useEffect(() => {
    if (!filteredSalaDevices.length) {
      setSalaDeviceId("");
      return;
    }
    const exists = filteredSalaDevices.some((device) => String(device.id) === salaDeviceId);
    if (!exists) {
      setSalaDeviceId(String(filteredSalaDevices[0].id));
    }
  }, [filteredSalaDevices, salaDeviceId]);

  useEffect(() => {
    if (!hasStudents || !hasPortariaDevices) {
      setAutoRfidEnabled(false);
    }
  }, [hasPortariaDevices, hasStudents]);

  useEffect(() => {
    if (!hasRooms || !hasSalaDevices) {
      setAutoTelemetryEnabled(false);
    }
  }, [hasRooms, hasSalaDevices]);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextStudent = students.length
        ? String(students[Math.floor(Math.random() * students.length)].id)
        : "";
      setSuggestedStudent(nextStudent);
    }, 5000);

    return () => clearInterval(interval);
  }, [students]);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextTemp = (24 + Math.random() * 6).toFixed(2);
      const nextHumidity = (45 + Math.random() * 25).toFixed(2);
      setSuggestedTemperature(nextTemp);
      setSuggestedHumidity(nextHumidity);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  useEffect(() => {
    if (!students.length) {
      setStudentId("");
      return;
    }

    const exists = students.some((student) => String(student.id) === studentId);
    if (!exists) {
      setStudentId(String(students[0].id));
    }
  }, [studentId, students]);

  const applyRfidSuggestion = () => {
    if (!suggestedStudent) {
      setRfidMessage("Cadastre pelo menos um aluno para gerar entrada RFID.");
      return;
    }
    setStudentId(suggestedStudent);
    setCardUid(randomHexUid());
    setOccurredAt(new Date().toISOString().slice(0, 16));
  };

  const applyTelemetrySuggestion = () => {
    setTemperature(suggestedTemperature);
    setHumidity(suggestedHumidity);
    setMeasuredAt(new Date().toISOString().slice(0, 16));
  };

  const submitTelemetry = async ({
    roomIdValue,
    deviceIdValue,
    temperatureValue,
    humidityValue,
    sensorModelValue,
    i2cAddressValue,
    measuredAtValue,
    silent,
  }: {
    roomIdValue: number;
    deviceIdValue: number;
    temperatureValue: number;
    humidityValue: number;
    sensorModelValue: "SHT31" | "SHT35";
    i2cAddressValue: string;
    measuredAtValue?: string;
    silent?: boolean;
  }) => {
    const result = await simulateTelemetry({
      roomId: roomIdValue,
      deviceId: deviceIdValue,
      temperature: temperatureValue,
      humidity: humidityValue,
      sensorModel: sensorModelValue,
      i2cAddress: i2cAddressValue,
      measuredAt: measuredAtValue,
    });

    if (result?.error) {
      const message = `Erro: ${result.error}`;
      setTelemetryMessage(message);
      if (!silent) {
        toast.error(result.error);
      }
      return { ok: false as const };
    }

    const message = silent
      ? `Auto: leitura enviada às ${new Date().toLocaleTimeString("pt-BR")}.`
      : "Leitura gravada com sucesso.";
    setTelemetryMessage(message);
    if (!silent) {
      toast.success("Leitura de telemetria enviada");
    }
    return { ok: true as const };
  };

  const submitRfid = async ({
    deviceIdValue,
    studentIdValue,
    cardUidValue,
    occurredAtValue,
    silent,
  }: {
    deviceIdValue: number;
    studentIdValue: number;
    cardUidValue?: string;
    occurredAtValue?: string;
    silent?: boolean;
  }) => {
    const result = await simulateRfidAccess({
      deviceId: deviceIdValue,
      studentId: studentIdValue,
      cardUid: cardUidValue,
      occurredAt: occurredAtValue,
      source: silent ? "auto" : "manual",
    });

    if (result?.error) {
      const message = `Erro: ${result.error}`;
      setRfidMessage(message);
      if (!silent) {
        toast.error(result.error);
      }
      return { ok: false as const };
    }

    if (result?.skipped) {
      const waitSeconds = Math.max(Math.ceil((result.retryAfterMs ?? 0) / 1000), 1);
      const message = `Auto: aguardando intervalo mínimo (${waitSeconds}s).`;
      setRfidMessage(message);
      return { ok: true as const, skipped: true as const };
    }

    if (result?.result) {
      setAccessResult(result.result);
    }

    const message = silent
      ? `Auto: leitura RFID enviada às ${new Date().toLocaleTimeString("pt-BR")}.`
      : "Leitura RFID simulada";
    setRfidMessage(message);
    if (!silent) {
      toast.success("Leitura RFID simulada");
    }
    return { ok: true as const };
  };

  const sendRfid = () => {
    startTransition(async () => {
      if (!hasStudents) {
        const message = "Cadastre pelo menos um aluno para gerar entrada RFID.";
        setRfidMessage(message);
        toast.error(message);
        return;
      }

      const parsedDeviceId = Number(portariaId);
      const parsedStudentId = Number(studentId);
      const normalizedCardUid = cardUid.trim().toUpperCase();

      if (!parsedDeviceId || !parsedStudentId) {
        toast.error("Selecione a portaria e informe student_id válido.");
        return;
      }
      if (normalizedCardUid && !/^[0-9A-F]{4,32}$/.test(normalizedCardUid)) {
        toast.error("Informe UID RFID válido (hexadecimal).");
        return;
      }

      await submitRfid({
        deviceIdValue: parsedDeviceId,
        studentIdValue: parsedStudentId,
        cardUidValue: normalizedCardUid || undefined,
        occurredAtValue: occurredAt ? new Date(occurredAt).toISOString() : undefined,
      });
    });
  };

  const sendTelemetry = () => {
    startTransition(async () => {
      if (!hasRooms) {
        const message = "Cadastre pelo menos uma sala ativa para gerar temperatura/umidade.";
        setTelemetryMessage(message);
        toast.error(message);
        return;
      }

      const parsedRoomId = Number(roomId);
      const parsedDeviceId = Number(salaDeviceId);
      const parsedTemperature = Number(temperature);
      const parsedHumidity = Number(humidity);
      const normalizedI2cAddress = normalizeI2cInput(i2cAddress);

      if (!parsedRoomId || !parsedDeviceId || Number.isNaN(parsedTemperature) || Number.isNaN(parsedHumidity)) {
        toast.error("Preencha sala, dispositivo, temperatura e umidade válidos.");
        return;
      }
      if (!/^0x[0-9A-F]{2}$/.test(normalizedI2cAddress)) {
        toast.error("Informe endereço I²C válido no formato 0x44.");
        return;
      }

      await submitTelemetry({
        roomIdValue: parsedRoomId,
        deviceIdValue: parsedDeviceId,
        temperatureValue: parsedTemperature,
        humidityValue: parsedHumidity,
        sensorModelValue: sensorModel,
        i2cAddressValue: normalizedI2cAddress,
        measuredAtValue: measuredAt ? new Date(measuredAt).toISOString() : undefined,
      });
    });
  };

  const sendTelemetryBatch = () => {
    startTransition(async () => {
      if (!hasRooms) {
        const message = "Cadastre pelo menos uma sala ativa para gerar temperatura/umidade.";
        setTelemetryMessage(message);
        toast.error(message);
        return;
      }

      const parsedRoomId = Number(roomId);
      const parsedDeviceId = Number(salaDeviceId);

      const result = await generateTelemetryBatch({
        roomId: parsedRoomId,
        deviceId: parsedDeviceId,
        baseTemperature: Number(baseTemperature),
        baseHumidity: Number(baseHumidity),
        variation: Number(variation),
        intervalSeconds: Number(intervalSeconds),
        quantity: Number(quantity),
      });

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Lote de leituras gerado");
      setTelemetryMessage(`Lote com ${quantity} leituras gerado.`);
    });
  };

  useEffect(() => {
    if (!autoTelemetryEnabled) return;

    const runAutoSend = async () => {
      if (autoTelemetryBusyRef.current) return;
      if (document.hidden) return;
      const now = Date.now();
      if (now - lastAutoTelemetryAtRef.current < 4000) return;
      if (!hasRooms) {
        setTelemetryMessage("Auto: cadastre pelo menos uma sala ativa.");
        return;
      }
      if (!hasSalaDevices) {
        setTelemetryMessage("Auto: selecione um dispositivo SALA válido.");
        return;
      }

      const parsedRoomId = Number(roomId);
      const parsedDeviceId = Number(salaDeviceId);
      if (!parsedRoomId || !parsedDeviceId) {
        setTelemetryMessage("Auto: selecione sala e dispositivo válidos.");
        return;
      }

      const nextTemp = (24 + Math.random() * 6).toFixed(2);
      const nextHumidity = (45 + Math.random() * 25).toFixed(2);
      const measured = new Date().toISOString();

      setTemperature(nextTemp);
      setHumidity(nextHumidity);
      setMeasuredAt(new Date().toISOString().slice(0, 16));

      autoTelemetryBusyRef.current = true;
      lastAutoTelemetryAtRef.current = now;
      try {
        await submitTelemetry({
          roomIdValue: parsedRoomId,
          deviceIdValue: parsedDeviceId,
          temperatureValue: Number(nextTemp),
          humidityValue: Number(nextHumidity),
          sensorModelValue: sensorModel,
          i2cAddressValue: normalizeI2cInput(i2cAddress),
          measuredAtValue: measured,
          silent: true,
        });
      } finally {
        autoTelemetryBusyRef.current = false;
      }
    };

    const interval = setInterval(() => {
      void runAutoSend();
    }, 4000);

    return () => clearInterval(interval);
  }, [autoTelemetryEnabled, roomId, salaDeviceId, hasRooms, hasSalaDevices, sensorModel, i2cAddress]);

  useEffect(() => {
    if (!autoRfidEnabled) return;

    let cancelled = false;
    let timeoutId: number | undefined;

    const scheduleNext = () => {
      if (cancelled) return;
      timeoutId = window.setTimeout(() => {
        void runAutoRfid();
      }, 5000);
    };

    const runAutoRfid = async () => {
      if (cancelled) return;
      if (autoRfidBusyRef.current) {
        scheduleNext();
        return;
      }
      if (document.hidden) {
        scheduleNext();
        return;
      }
      if (!hasStudents) {
        setRfidMessage("Auto: cadastre pelo menos um aluno.");
        scheduleNext();
        return;
      }
      if (!hasPortariaDevices) {
        setRfidMessage("Auto: selecione um dispositivo PORTARIA válido.");
        scheduleNext();
        return;
      }

      const parsedDeviceId = Number(portariaId);
      if (!parsedDeviceId) {
        setRfidMessage("Auto: selecione um dispositivo PORTARIA válido.");
        scheduleNext();
        return;
      }

      const randomStudentList = studentsRef.current;
      if (!randomStudentList.length) {
        setRfidMessage("Auto: cadastre pelo menos um aluno.");
        scheduleNext();
        return;
      }

      const randomStudent =
        randomStudentList[Math.floor(Math.random() * randomStudentList.length)];
      const nextStudentId = randomStudent.id;
      const measured = new Date().toISOString();
      const nextCardUid = randomHexUid();
      setStudentId(String(nextStudentId));
      setCardUid(nextCardUid);
      setOccurredAt(new Date().toISOString().slice(0, 16));

      autoRfidBusyRef.current = true;
      try {
        await submitRfid({
          deviceIdValue: parsedDeviceId,
          studentIdValue: nextStudentId,
          cardUidValue: nextCardUid,
          occurredAtValue: measured,
          silent: true,
        });
      } finally {
        autoRfidBusyRef.current = false;
        scheduleNext();
      }
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [autoRfidEnabled, hasPortariaDevices, hasStudents, portariaId]);

  return (
    <Tabs defaultValue="rfid" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="rfid">Simular Portaria RFID</TabsTrigger>
          <TabsTrigger value="telemetria">Simular Sensor de Sala</TabsTrigger>
        </TabsList>
        <Badge variant="outline">ESP32 Wi-Fi • HTTP REST • Temp/Umid 4s • RFID 5s</Badge>
      </div>

      <TabsContent value="rfid">
        <Card>
          <CardHeader>
            <CardTitle>Simular Portaria RFID</CardTitle>
            <CardDescription>
              Simula ESP32 + {hardwareProfile.access.readerModel} (13,56 MHz) enviando POST para{" "}
              <code>{hardwareProfile.access.endpoint}</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground md:grid-cols-4">
              <p>
                <span className="font-medium text-foreground">Transporte:</span> {hardwareProfile.transport}
              </p>
              <p>
                <span className="font-medium text-foreground">Conectividade:</span>{" "}
                {hardwareProfile.esp32.connectivity}
              </p>
              <p>
                <span className="font-medium text-foreground">Leitor RFID:</span>{" "}
                {hardwareProfile.access.readerModel}
              </p>
              <p>
                <span className="font-medium text-foreground">Frequência:</span>{" "}
                {hardwareProfile.access.frequencyMHz.toFixed(2)} MHz
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Dispositivo PORTARIA</Label>
                <Select value={portariaId} onValueChange={setPortariaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {portariaDevices.map((device) => (
                      <SelectItem key={device.id} value={String(device.id)}>
                        {device.name} {device.isActive ? "(ativo)" : "(inativo)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Aluno</Label>
                {hasStudents ? (
                  <Select value={studentId} onValueChange={setStudentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o aluno" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={String(student.id)}>
                          #{student.id} - {student.name}
                          {student.isActive ? "" : " (inativo)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input disabled value="" placeholder="Cadastre pelo menos um aluno" />
                )}
              </div>

              <div className="space-y-2">
                <Label>UID RFID (PN532)</Label>
                <Input
                  value={cardUid}
                  onChange={(event) => setCardUid(event.target.value.toUpperCase())}
                  placeholder="04A1B2C3"
                />
              </div>

              <div className="space-y-2">
                <Label>occurred_at (opcional)</Label>
                <Input
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(event) => setOccurredAt(event.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Modo automático (5s)</p>
                <p className="text-xs text-muted-foreground">
                  Gera entrada RFID automaticamente a cada 5 segundos.
                </p>
              </div>
              <Switch
                checked={autoRfidEnabled}
                onCheckedChange={setAutoRfidEnabled}
                disabled={!hasStudents || !hasPortariaDevices}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={sendRfid}
                disabled={isPending || !hasStudents || !hasPortariaDevices}
              >
                {isPending ? "Processando..." : "Simular Leitura RFID"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={applyRfidSuggestion}
                disabled={!hasStudents}
              >
                Aplicar sugestão 5s (student_id {suggestedStudent})
              </Button>
            </div>

            {!hasStudents ? (
              <p className="text-sm text-destructive">
                Cadastre pelo menos um aluno para liberar geração de entrada RFID.
              </p>
            ) : null}
            {!hasPortariaDevices ? (
              <p className="text-sm text-destructive">
                Cadastre pelo menos um dispositivo do tipo PORTARIA para simular entradas.
              </p>
            ) : null}

            {rfidMessage ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">{rfidMessage}</div>
            ) : null}

            {accessResult ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p>
                  <span className="font-semibold">Resultado:</span> {accessResult.result}
                </p>
                <p>
                  <span className="font-semibold">Motivo:</span> {accessResult.reason}
                </p>
                <p>
                  <span className="font-semibold">unlock_duration_seconds:</span>{" "}
                  {accessResult.unlockDurationSeconds}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="telemetria">
        <Card>
          <CardHeader>
            <CardTitle>Simular Sensor de Sala (Temp/Umid)</CardTitle>
            <CardDescription>
              Simula ESP32 + sensor I²C SHT31/SHT35 enviando POST para{" "}
              <code>{hardwareProfile.telemetry.endpoint}</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground md:grid-cols-4">
              <p>
                <span className="font-medium text-foreground">Transporte:</span> {hardwareProfile.transport}
              </p>
              <p>
                <span className="font-medium text-foreground">Conectividade:</span>{" "}
                {hardwareProfile.esp32.connectivity}
              </p>
              <p>
                <span className="font-medium text-foreground">Sensor:</span> {sensorModel}
              </p>
              <p>
                <span className="font-medium text-foreground">I²C:</span> {i2cAddress}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <Label>Sala</Label>
                <Select value={roomId} onValueChange={setRoomId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={String(room.id)}>
                        {room.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Dispositivo SALA</Label>
                <Select value={salaDeviceId} onValueChange={setSalaDeviceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSalaDevices.map((device) => (
                      <SelectItem key={device.id} value={String(device.id)}>
                        {device.name} {device.isActive ? "(ativo)" : "(inativo)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Modelo do sensor</Label>
                <Select
                  value={sensorModel}
                  onValueChange={(value) => setSensorModel(value as "SHT31" | "SHT35")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {hardwareProfile.telemetry.supportedSensorModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Endereço I²C</Label>
                <Input
                  value={i2cAddress}
                  onChange={(event) => setI2cAddress(normalizeI2cInput(event.target.value))}
                  placeholder="0x44"
                />
              </div>

              <div className="space-y-2">
                <Label>measured_at (opcional)</Label>
                <Input
                  type="datetime-local"
                  value={measuredAt}
                  onChange={(event) => setMeasuredAt(event.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Modo automático (4s)</p>
                <p className="text-xs text-muted-foreground">
                  Envia leitura automaticamente a cada 4 segundos.
                </p>
              </div>
              <Switch
                checked={autoTelemetryEnabled}
                onCheckedChange={setAutoTelemetryEnabled}
                disabled={!hasRooms || !hasSalaDevices}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Temperatura (°C)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={temperature}
                  onChange={(event) => setTemperature(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Umidade (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={humidity}
                  onChange={(event) => setHumidity(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={sendTelemetry}
                disabled={isPending || !hasRooms || !hasSalaDevices}
              >
                {isPending ? "Enviando..." : "Enviar leitura"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={applyTelemetrySuggestion}
                disabled={!hasRooms}
              >
                Aplicar sugestão 4s ({suggestedTemperature}°C / {suggestedHumidity}%)
              </Button>
            </div>

            {!hasRooms ? (
              <p className="text-sm text-destructive">
                Cadastre pelo menos uma sala ativa para liberar geração de temperatura/umidade.
              </p>
            ) : null}
            {!hasSalaDevices ? (
              <p className="text-sm text-destructive">
                Cadastre pelo menos um dispositivo do tipo SALA para simular telemetria.
              </p>
            ) : null}

            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold">Gerar automaticamente (lote)</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-2">
                  <Label>Temp base</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={baseTemperature}
                    onChange={(event) => setBaseTemperature(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Umid base</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={baseHumidity}
                    onChange={(event) => setBaseHumidity(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Variação (+/-)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={variation}
                    onChange={(event) => setVariation(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Intervalo (s)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={intervalSeconds}
                    onChange={(event) => setIntervalSeconds(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantidade (max 60)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={sendTelemetryBatch}
                disabled={isPending || !hasRooms || !hasSalaDevices}
              >
                Gerar lote
              </Button>
            </div>

            {telemetryMessage ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">{telemetryMessage}</div>
            ) : null}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
