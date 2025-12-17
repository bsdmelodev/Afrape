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
import type {
  AssignmentClassSubjectOption,
  AssignmentRow,
  AssignmentTeacherOption,
} from "../types";
import { createAssignment, updateAssignment } from "../actions";

const ROLE_OPTIONS = [
  { value: 1, label: "1 - Titular" },
  { value: 2, label: "2 - Apoio" },
  { value: 3, label: "3 - Substituto" },
];

const formSchema = z.object({
  classSubjectId: z.string().min(1, "Selecione o componente"),
  teacherId: z.string().min(1, "Selecione o professor"),
  role: z.coerce.number().int().min(1).max(3).default(1),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

type FormValues = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

export function AssignmentForm({
  record,
  classSubjects,
  teachers,
  onSuccess,
}: {
  record?: AssignmentRow;
  classSubjects: AssignmentClassSubjectOption[];
  teachers: AssignmentTeacherOption[];
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      classSubjectId: record ? String(record.classSubjectId) : "",
      teacherId: record ? String(record.teacherId) : "",
      role: record?.role ?? 1,
      startsAt: record?.startsAt ?? "",
      endsAt: record?.endsAt ?? "",
    },
  });

  const handleSubmit = (values: FormOutput) => {
    startTransition(async () => {
      const payload = {
        classSubjectId: Number(values.classSubjectId),
        teacherId: Number(values.teacherId),
        role: Number(values.role || 1),
        startsAt: values.startsAt || undefined,
        endsAt: values.endsAt || undefined,
      };

      const result = record
        ? await updateAssignment(record.id, payload)
        : await createAssignment(payload);

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
          name="classSubjectId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Turma x Disciplina</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => field.onChange(value)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o componente" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {classSubjects.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.label}
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
          name="teacherId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Professor</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => field.onChange(value)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o professor" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={String(teacher.id)}>
                      {teacher.name} — {teacher.email ?? "sem e-mail"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Papel</FormLabel>
                <Select
                  value={field.value ? String(field.value) : undefined}
                  onValueChange={(val) => field.onChange(Number(val))}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o papel" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ROLE_OPTIONS.map((opt) => (
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
        </div>

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

        <Button type="submit" disabled={isPending} className="justify-self-end">
          {isPending ? "Salvando..." : record ? "Atualizar" : "Salvar"}
        </Button>
      </form>
    </Form>
  );
}
