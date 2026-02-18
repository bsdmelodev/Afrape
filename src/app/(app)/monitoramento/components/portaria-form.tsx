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
import type { DeviceRow } from "../types";
import { createDevice, updateDevice } from "../actions";

const schema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  isActive: z.boolean(),
  regenerateToken: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function PortariaForm({
  device,
  onSuccess,
}: {
  device?: DeviceRow;
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: device?.name ?? "",
      isActive: device?.isActive ?? true,
      regenerateToken: false,
    },
  });

  const submit = (values: FormValues) => {
    startTransition(async () => {
      const result = device
        ? await updateDevice(device.id, {
            name: values.name,
            type: "PORTARIA",
            roomId: null,
            isActive: values.isActive,
            regenerateToken: values.regenerateToken,
          })
        : await createDevice({
            name: values.name,
            type: "PORTARIA",
            roomId: null,
            isActive: values.isActive,
          });

      if (result?.error) {
        toast.error(result.error);
        form.setError("root", { message: result.error });
        return;
      }

      toast.success(device ? "Portaria atualizada" : "Portaria criada");
      onSuccess?.();
    });
  };

  return (
    <Form {...form}>
      <form className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
        {form.formState.errors.root?.message && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {form.formState.errors.root.message}
          </div>
        )}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do device</FormLabel>
              <FormControl>
                <Input placeholder="Portaria principal" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-md border p-3">
              <div>
                <FormLabel>Status</FormLabel>
                <p className="text-xs text-muted-foreground">Ativar/desativar device de portaria</p>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        {device ? (
          <FormField
            control={form.control}
            name="regenerateToken"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <FormLabel>Regenerar token</FormLabel>
                  <p className="text-xs text-muted-foreground">Gere um novo token para autenticação do hardware</p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        ) : null}

        <Button type="submit" disabled={isPending} className="justify-self-end">
          {isPending ? "Salvando..." : device ? "Atualizar" : "Salvar"}
        </Button>
      </form>
    </Form>
  );
}
