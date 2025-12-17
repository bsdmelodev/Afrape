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
  TermGradeClassSubjectOption,
  TermGradeEnrollmentOption,
  TermGradeRow,
  TermGradeTermOption,
} from "../types";
import { createTermGrade, updateTermGrade } from "../actions";
import { Switch } from "@/components/ui/switch";

const formSchema = z.object({
  enrollmentId: z.string().min(1, "Selecione a matrícula"),
  classSubjectId: z.string().min(1, "Selecione o componente"),
  termId: z.string().min(1, "Selecione o período"),
  grade: z.string().optional(),
  absencesCount: z.string().optional(),
  attendancePercentage: z.string().optional(),
  isClosed: z.boolean().default(false),
});

type FormValues = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

export function TermGradeForm({
  record,
  enrollments,
  classSubjects,
  terms,
  onSuccess,
}: {
  record?: TermGradeRow;
  enrollments: TermGradeEnrollmentOption[];
  classSubjects: TermGradeClassSubjectOption[];
  terms: TermGradeTermOption[];
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      enrollmentId: record ? String(record.enrollmentId) : "",
      classSubjectId: record ? String(record.classSubjectId) : "",
      termId: record ? String(record.termId) : "",
      grade: record?.grade !== null && record?.grade !== undefined ? String(record.grade) : "",
      absencesCount: record ? String(record.absencesCount) : "0",
      attendancePercentage:
        record?.attendancePercentage !== null && record?.attendancePercentage !== undefined
          ? String(record.attendancePercentage)
          : "",
      isClosed: record?.isClosed ?? false,
    },
  });

  const handleSubmit = (values: FormOutput) => {
    startTransition(async () => {
      const payload = {
        enrollmentId: Number(values.enrollmentId),
        classSubjectId: Number(values.classSubjectId),
        termId: Number(values.termId),
        grade: values.grade ? Number(values.grade) : undefined,
        absencesCount: values.absencesCount ? Number(values.absencesCount) : 0,
        attendancePercentage: values.attendancePercentage
          ? Number(values.attendancePercentage)
          : undefined,
        isClosed: values.isClosed,
      };

      const result = record
        ? await updateTermGrade(record.id, payload)
        : await createTermGrade(payload);

      if (result?.error) {
        toast.error(result.error);
        form.setError("root", { message: result.error });
        return;
      }
      toast.success(record ? "Fechamento atualizado" : "Fechamento criado");
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
          name="enrollmentId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Matrícula</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a matrícula" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {enrollments.map((enrollment) => (
                    <SelectItem key={enrollment.id} value={String(enrollment.id)}>
                      {enrollment.label}
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
          name="classSubjectId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Componente</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
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
          name="termId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Período</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {terms.map((term) => (
                    <SelectItem key={term.id} value={String(term.id)}>
                      {term.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="grade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nota</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="absencesCount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Faltas</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="attendancePercentage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Frequência (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min={0} max={100} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="isClosed"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3">
              <FormLabel className="mb-0">Fechado?</FormLabel>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
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
