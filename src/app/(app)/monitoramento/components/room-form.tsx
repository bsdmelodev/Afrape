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
import type { RoomRow } from "../types";
import { createRoom, updateRoom } from "../actions";

const schema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  location: z.string().optional(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function RoomForm({
  room,
  onSuccess,
}: {
  room?: RoomRow;
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: room?.name ?? "",
      location: room?.location ?? "",
      isActive: room?.isActive ?? true,
    },
  });

  const submit = (values: FormValues) => {
    startTransition(async () => {
      const payload = {
        name: values.name,
        location: values.location?.trim() || undefined,
        isActive: values.isActive,
      };

      const result = room ? await updateRoom(room.id, payload) : await createRoom(payload);

      if (result?.error) {
        toast.error(result.error);
        form.setError("root", { message: result.error });
        return;
      }

      toast.success(room ? "Sala atualizada" : "Sala criada");
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
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Sala 101" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Localização</FormLabel>
              <FormControl>
                <Input placeholder="Bloco A" {...field} />
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
                <p className="text-xs text-muted-foreground">Ativar/desativar sala no monitoramento</p>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} className="justify-self-end">
          {isPending ? "Salvando..." : room ? "Atualizar" : "Salvar"}
        </Button>
      </form>
    </Form>
  );
}
