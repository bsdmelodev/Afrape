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

        <Button type="submit" disabled={isPending} className="justify-self-end">
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </form>
    </Form>
  );
}
