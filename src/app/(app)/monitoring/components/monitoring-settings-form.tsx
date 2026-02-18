"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { saveMonitoringSettings } from "../actions";

const schema = z
  .object({
    tempMin: z.string().min(1, "Informe a temperatura mínima"),
    tempMax: z.string().min(1, "Informe a temperatura máxima"),
    humMin: z.string().min(1, "Informe a umidade mínima"),
    humMax: z.string().min(1, "Informe a umidade máxima"),
    telemetryIntervalSeconds: z.string().min(1, "Informe o intervalo"),
    unlockDurationSeconds: z.string().min(1, "Informe a duração de liberação"),
    allowOnlyActiveStudents: z.boolean(),
    hardwareProfile: z.object({
      telemetry: z.object({
        sensorModel: z.enum(["SHT31", "SHT35"]),
        i2cAddress: z
          .string()
          .trim()
          .regex(/^0[xX][0-9A-Fa-f]{2}$/, "Use endereço I²C no formato 0x44."),
        endpoint: z.string().min(1, "Informe o endpoint REST da telemetria."),
      }),
      access: z.object({
        readerModel: z.literal("PN532"),
        frequencyMHz: z.string().min(1, "Informe a frequência RFID."),
        endpoint: z.string().min(1, "Informe o endpoint REST de acesso."),
      }),
    }),
  })
  .refine((value) => Number(value.tempMin) < Number(value.tempMax), {
    path: ["tempMin"],
    message: "Temp. mínima deve ser menor que máxima",
  })
  .refine((value) => Number(value.humMin) < Number(value.humMax), {
    path: ["humMin"],
    message: "Umidade mínima deve ser menor que máxima",
  });

type FormValues = z.infer<typeof schema>;

export function MonitoringSettingsForm({
  defaultValues,
}: {
  defaultValues: {
    tempMin: number;
    tempMax: number;
    humMin: number;
    humMax: number;
    telemetryIntervalSeconds: number;
    unlockDurationSeconds: number;
    allowOnlyActiveStudents: boolean;
    hardwareProfile: {
      telemetry: {
        sensorModel: "SHT31" | "SHT35";
        i2cAddress: string;
        endpoint: string;
      };
      access: {
        readerModel: "PN532";
        frequencyMHz: number;
        endpoint: string;
      };
    };
  };
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tempMin: String(defaultValues.tempMin),
      tempMax: String(defaultValues.tempMax),
      humMin: String(defaultValues.humMin),
      humMax: String(defaultValues.humMax),
      telemetryIntervalSeconds: String(defaultValues.telemetryIntervalSeconds),
      unlockDurationSeconds: String(defaultValues.unlockDurationSeconds),
      allowOnlyActiveStudents: defaultValues.allowOnlyActiveStudents,
      hardwareProfile: {
        telemetry: {
          sensorModel: defaultValues.hardwareProfile.telemetry.sensorModel,
          i2cAddress: defaultValues.hardwareProfile.telemetry.i2cAddress,
          endpoint: defaultValues.hardwareProfile.telemetry.endpoint,
        },
        access: {
          readerModel: defaultValues.hardwareProfile.access.readerModel,
          frequencyMHz: String(defaultValues.hardwareProfile.access.frequencyMHz),
          endpoint: defaultValues.hardwareProfile.access.endpoint,
        },
      },
    },
  });

  const submit = (values: FormValues) => {
    startTransition(async () => {
      const payload = {
        tempMin: Number(values.tempMin),
        tempMax: Number(values.tempMax),
        humMin: Number(values.humMin),
        humMax: Number(values.humMax),
        telemetryIntervalSeconds: Number(values.telemetryIntervalSeconds),
        unlockDurationSeconds: Number(values.unlockDurationSeconds),
        allowOnlyActiveStudents: values.allowOnlyActiveStudents,
        hardwareProfile: {
          telemetry: {
            sensorModel: values.hardwareProfile.telemetry.sensorModel,
            i2cAddress: values.hardwareProfile.telemetry.i2cAddress,
            endpoint: values.hardwareProfile.telemetry.endpoint,
          },
          access: {
            readerModel: values.hardwareProfile.access.readerModel,
            frequencyMHz: Number(values.hardwareProfile.access.frequencyMHz),
            endpoint: values.hardwareProfile.access.endpoint,
          },
        },
      };

      if (
        Object.values(payload).some(
          (value) => typeof value === "number" && (!Number.isFinite(value) || Number.isNaN(value))
        )
      ) {
        const message = "Preencha valores numéricos válidos.";
        toast.error(message);
        form.setError("root", { message });
        return;
      }

      const result = await saveMonitoringSettings(payload);
      if (result?.error) {
        toast.error(result.error);
        form.setError("root", { message: result.error });
        return;
      }

      toast.success("Configurações salvas");
    });
  };

  return (
    <Form {...form}>
      <form className="grid gap-6" onSubmit={form.handleSubmit(submit)}>
        {form.formState.errors.root?.message ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {form.formState.errors.root.message}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="tempMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Temperatura mínima (°C)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tempMax"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Temperatura máxima (°C)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="humMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Umidade mínima (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="humMax"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Umidade máxima (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="telemetryIntervalSeconds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Intervalo de telemetria (segundos)</FormLabel>
                <FormControl>
                  <Input type="number" min={1} step={1} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="unlockDurationSeconds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duração de liberação (segundos)</FormLabel>
                <FormControl>
                  <Input type="number" min={1} step={1} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="allowOnlyActiveStudents"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-md border p-3">
              <div>
                <FormLabel>Permitir apenas alunos ativos</FormLabel>
                <p className="text-xs text-muted-foreground">Quando ativo, alunos inativos sempre recebem DENY.</p>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="space-y-3 rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Perfil de Hardware IoT (ESP32 + SHT3x + PN532)</p>
            <p className="text-xs text-muted-foreground">
              Comunicação fixa via HTTP REST sobre Wi-Fi, com parâmetros específicos do hardware.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormItem>
              <FormLabel>Protocolo</FormLabel>
              <FormControl>
                <Input value="HTTP REST" disabled />
              </FormControl>
            </FormItem>

            <FormItem>
              <FormLabel>Conectividade</FormLabel>
              <FormControl>
                <Input value="Wi-Fi (ESP32)" disabled />
              </FormControl>
            </FormItem>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <FormField
              control={form.control}
              name="hardwareProfile.telemetry.sensorModel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sensor Temp/Umid</FormLabel>
                  <FormControl>
                    <select
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="SHT31">SHT31</option>
                      <option value="SHT35">SHT35</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hardwareProfile.telemetry.i2cAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço I²C</FormLabel>
                  <FormControl>
                    <Input placeholder="0x44" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hardwareProfile.telemetry.endpoint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endpoint REST (telemetria)</FormLabel>
                  <FormControl>
                    <Input placeholder="/api/iot/telemetry" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <FormField
              control={form.control}
              name="hardwareProfile.access.readerModel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Leitor RFID</FormLabel>
                  <FormControl>
                    <select
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      <option value="PN532">PN532 (13,56 MHz)</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hardwareProfile.access.frequencyMHz"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequência RFID (MHz)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hardwareProfile.access.endpoint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endpoint REST (acesso)</FormLabel>
                  <FormControl>
                    <Input placeholder="/api/iot/access" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Button type="submit" disabled={isPending} className="justify-self-end">
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </form>
    </Form>
  );
}
