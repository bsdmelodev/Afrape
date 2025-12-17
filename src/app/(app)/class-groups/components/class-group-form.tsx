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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createClassGroup, updateClassGroup } from "../actions";
import type { ClassGroupRow } from "../types";

const SHIFT_OPTIONS = [
  { value: 1, label: "Manhã" },
  { value: 2, label: "Tarde" },
  { value: 3, label: "Noite" },
  { value: 4, label: "Integral" },
];

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  schoolYear: z.coerce.number().int().min(1900, "Ano inválido"),
  shift: z.coerce.number().int().min(1).max(4).optional(),
  isActive: z.boolean().default(true),
});

type FormValues = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

export function ClassGroupForm({
  group,
  onSuccess,
}: {
  group?: ClassGroupRow;
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: group?.name ?? "",
      schoolYear: group?.schoolYear ?? new Date().getFullYear(),
      shift: group?.shift ?? undefined,
      isActive: group?.isActive ?? true,
    },
  });

  const handleSubmit = (values: FormOutput) => {
    startTransition(async () => {
      const payload = {
        ...values,
        shift: values.shift || undefined,
      };

      const result = group
        ? await updateClassGroup(group.id, payload)
        : await createClassGroup(payload);

      if (result?.error) {
        if (result.error.toLowerCase().includes("nome")) {
          form.setError("name", { message: result.error });
        }
        if (result.error.toLowerCase().includes("turno")) {
          form.setError("shift", { message: result.error });
        }
        form.setError("root", { message: result.error });
        toast.error(result.error);
        return;
      }

      toast.success(group ? "Turma atualizada" : "Turma criada");
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
                <Input placeholder="6ºA, 3ºB..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="schoolYear"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ano letivo</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={(field.value as number | undefined) ?? ""}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="shift"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Turno</FormLabel>
                <Select
                  value={field.value ? String(field.value) : undefined}
                  onValueChange={(val) => field.onChange(Number(val))}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o turno" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SHIFT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select
                value={field.value ? "true" : "false"}
                onValueChange={(value) => field.onChange(value === "true")}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="true">Ativa</SelectItem>
                  <SelectItem value="false">Inativa</SelectItem>
                </SelectContent>
              </Select>
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
