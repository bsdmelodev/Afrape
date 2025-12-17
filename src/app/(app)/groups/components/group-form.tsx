"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createGroup, updateGroup } from "../actions";
import type { GroupRow } from "../types";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  permissionIds: z.array(z.number().int()).default([]),
});

type FormValues = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

export function GroupForm({
  group,
  permissions,
  onSuccess,
}: {
  group?: GroupRow;
  permissions: { id: number; code: string; description: string | null }[];
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: group?.name ?? "",
      description: group?.description ?? "",
      permissionIds: group?.permissions.map((code) => {
        const perm = permissions.find((p) => p.code === code);
        return perm ? perm.id : 0;
      }).filter(Boolean) ?? [],
    },
  });

  const handleSubmit = (values: FormOutput) => {
    startTransition(async () => {
      const payload = {
        name: values.name,
        description: values.description?.trim() || undefined,
        permissionIds: values.permissionIds,
      };
      const result = group
        ? await updateGroup(group.id, payload)
        : await createGroup(payload);

      if (result?.error) {
        toast.error(result.error);
        form.setError("root", { message: result.error });
        return;
      }

      toast.success(group ? "Grupo atualizado" : "Grupo criado");
      onSuccess?.();
    });
  };

  return (
    <Form {...form}>
      <form className="grid gap-4" onSubmit={form.handleSubmit(handleSubmit)}>
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
                <Input placeholder="Admin, Secretaria, Professor..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea placeholder="Opcional" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="permissionIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Permissões</FormLabel>
              <FormControl>
                <ScrollArea className="h-48 rounded-md border p-3">
                  <div className="space-y-2">
                    {permissions.map((perm) => (
                      <label
                        key={perm.id}
                        className="flex items-center gap-2 text-sm leading-tight"
                      >
                        <Checkbox
                          checked={field.value?.includes(perm.id)}
                          onCheckedChange={(checked) => {
                            const current = new Set(field.value || []);
                            if (checked) current.add(perm.id);
                            else current.delete(perm.id);
                            field.onChange(Array.from(current));
                          }}
                        />
                        <div className="space-y-0.5">
                          <span className="font-medium">{perm.code}</span>
                          {perm.description && (
                            <p className="text-xs text-muted-foreground">
                              {perm.description}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} className="justify-self-end">
          {isPending ? "Salvando..." : group ? "Atualizar" : "Salvar"}
        </Button>
      </form>
    </Form>
  );
}
