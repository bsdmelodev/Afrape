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
import type { TermRow } from "../types";
import { createTerm, updateTerm } from "../actions";

const formSchema = z.object({
  schoolYear: z.string().min(1, "Ano letivo obrigatório"),
  name: z.string().min(1, "Nome é obrigatório"),
  termOrder: z.string().min(1, "Ordem obrigatória"),
  startsAt: z.string().min(1, "Início obrigatório"),
  endsAt: z.string().min(1, "Fim obrigatório"),
});

type FormValues = z.infer<typeof formSchema>;

export function TermForm({ term, onSuccess }: { term?: TermRow; onSuccess?: () => void }) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      schoolYear: term ? String(term.schoolYear) : "",
      name: term?.name ?? "",
      termOrder: term ? String(term.termOrder) : "",
      startsAt: term?.startsAt ?? "",
      endsAt: term?.endsAt ?? "",
    },
  });

  const handleSubmit = (values: FormValues) => {
    startTransition(async () => {
      const payload = {
        schoolYear: Number(values.schoolYear),
        name: values.name,
        termOrder: Number(values.termOrder),
        startsAt: values.startsAt,
        endsAt: values.endsAt,
      };

      const result = term ? await updateTerm(term.id, payload) : await createTerm(payload);
      if (result?.error) {
        toast.error(result.error);
        form.setError("root", { message: result.error });
        return;
      }
      toast.success(term ? "Período atualizado" : "Período criado");
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
            name="schoolYear"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ano letivo</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="2025" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="termOrder"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ordem</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="1º Bimestre" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="startsAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Início</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endsAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fim</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={isPending} className="justify-self-end">
          {isPending ? "Salvando..." : term ? "Atualizar" : "Salvar"}
        </Button>
      </form>
    </Form>
  );
}
