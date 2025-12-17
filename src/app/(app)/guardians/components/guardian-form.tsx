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
import { toast } from "sonner";
import { createGuardian, updateGuardian } from "../actions";
import type { GuardianRow } from "../types";

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 9);
  const part4 = digits.slice(9, 11);
  if (digits.length > 9) return `${part1}.${part2}.${part3}-${part4}`;
  if (digits.length > 6) return `${part1}.${part2}.${part3}`;
  if (digits.length > 3) return `${part1}.${part2}`;
  return part1;
}

function formatPhoneBr(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  const ddd = digits.slice(0, 2);
  const first = digits.length > 10 ? digits.slice(2, 7) : digits.slice(2, 6);
  const second = digits.length > 10 ? digits.slice(7, 11) : digits.slice(6, 10);
  if (digits.length <= 2) return ddd ? `(${ddd}` : "";
  if (digits.length <= 6) return `(${ddd}) ${first}`;
  return `(${ddd}) ${first}${second ? `-${second}` : ""}`;
}

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  cpf: z
    .string()
    .min(1, "CPF é obrigatório")
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length === 11, "CPF deve ter 11 dígitos"),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function GuardianForm({
  guardian,
  onSuccess,
}: {
  guardian?: GuardianRow;
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: guardian?.name ?? "",
      cpf: guardian?.cpf ? formatCpf(guardian.cpf) : "",
      email: guardian?.email ?? "",
      phone: guardian?.phone ? formatPhoneBr(guardian.phone) : "",
    },
  });

  const handleSubmit = (values: FormValues) => {
    startTransition(async () => {
      const result = guardian
        ? await updateGuardian(guardian.id, values)
        : await createGuardian(values);

      if (result?.error) {
        const lower = result.error.toLowerCase();
        if (lower.includes("cpf")) form.setError("cpf", { message: result.error });
        if (lower.includes("nome")) form.setError("name", { message: result.error });
        form.setError("root", { message: result.error });
        toast.error(result.error);
        return;
      }

      toast.success(guardian ? "Responsável atualizado" : "Responsável criado");
      onSuccess?.();
    });
  };

  return (
    <Form {...form}>
      <form className="grid gap-6" onSubmit={form.handleSubmit(handleSubmit)}>
        {form.formState.errors.root?.message && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {form.formState.errors.root.message}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome completo</FormLabel>
                <FormControl>
                  <Input placeholder="Nome completo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="cpf"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CPF</FormLabel>
                <FormControl>
                  <Input
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    maxLength={14}
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(formatCpf(event.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@exemplo.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl>
                  <Input
                    placeholder="(00) 00000-0000"
                    inputMode="tel"
                    maxLength={15}
                    value={field.value ?? ""}
                    onChange={(event) =>
                      field.onChange(formatPhoneBr(event.target.value))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <p className="text-sm text-muted-foreground">
          CPF é obrigatório e único no sistema; telefone é formatado automaticamente.
        </p>

        <Button type="submit" disabled={isPending} className="justify-self-end">
          {isPending ? "Salvando..." : guardian ? "Atualizar" : "Salvar"}
        </Button>
      </form>
    </Form>
  );
}
