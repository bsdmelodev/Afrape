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
import type { ClassGroupOption, ClassSubjectRow, SubjectOption } from "../types";
import { createClassSubject, updateClassSubject } from "../actions";

const formSchema = z.object({
  classGroupId: z.string().min(1, "Selecione a turma"),
  subjectId: z.string().min(1, "Selecione a disciplina"),
  workloadMinutes: z
    .string()
    .optional()
    .refine(
      (v) => !v || (!Number.isNaN(Number(v)) && Number(v) > 0),
      "Informe um número positivo"
    ),
});

type FormValues = z.infer<typeof formSchema>;

export function ClassSubjectForm({
  record,
  classGroups,
  subjects,
  onSuccess,
}: {
  record?: ClassSubjectRow;
  classGroups: ClassGroupOption[];
  subjects: SubjectOption[];
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      classGroupId: record ? String(record.classGroupId) : "",
      subjectId: record ? String(record.subjectId) : "",
      workloadMinutes: record?.workloadMinutes ? String(record.workloadMinutes) : "",
    },
  });

  const handleSubmit = (values: FormValues) => {
    const workload = values.workloadMinutes
      ? Number(values.workloadMinutes)
      : undefined;

    startTransition(async () => {
      const payload = {
        classGroupId: Number(values.classGroupId),
        subjectId: Number(values.subjectId),
        workloadMinutes: workload,
      };

      const result = record
        ? await updateClassSubject(record.id, payload)
        : await createClassSubject(payload);

      if (result?.error) {
        toast.error(result.error);
        form.setError("root", { message: result.error });
        return;
      }

      toast.success(record ? "Vínculo atualizado" : "Vínculo criado");
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
        <FormField
          control={form.control}
          name="classGroupId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Turma</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => field.onChange(value)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a turma" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {classGroups.map((group) => (
                    <SelectItem key={group.id} value={String(group.id)}>
                      {group.schoolYear} — {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="subjectId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Disciplina</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => field.onChange(value)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a disciplina" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={String(subject.id)}>
                      {subject.name}
                      {subject.code ? ` — ${subject.code}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="workloadMinutes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Carga horária (minutos)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  placeholder="Opcional"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} className="justify-self-end">
          {isPending ? "Salvando..." : record ? "Atualizar" : "Salvar"}
        </Button>
      </form>
    </Form>
  );
}
