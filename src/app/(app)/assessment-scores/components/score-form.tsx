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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { AssessmentOption, EnrollmentOption, ScoreRow } from "../types";
import { createScore, updateScore } from "../actions";

const formSchema = z.object({
  assessmentId: z.string().min(1, "Selecione a avaliação"),
  enrollmentId: z.string().min(1, "Selecione a matrícula"),
  score: z
    .string()
    .optional()
    .refine(
      (val) => !val || (!Number.isNaN(Number(val)) && Number(val) >= 0),
      "Informe uma nota válida"
    ),
  isAbsent: z.boolean(),
  isExcused: z.boolean(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function ScoreForm({
  record,
  assessments,
  enrollments,
  onSuccess,
}: {
  record?: ScoreRow;
  assessments: AssessmentOption[];
  enrollments: EnrollmentOption[];
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      assessmentId: record ? String(record.assessmentId) : "",
      enrollmentId: record ? String(record.enrollmentId) : "",
      score: record && record.score !== null ? String(record.score) : "",
      isAbsent: record?.isAbsent ?? false,
      isExcused: record?.isExcused ?? false,
      notes: record?.notes ?? "",
    },
  });

  const handleSubmit = (values: FormValues) => {
    const scoreValue = values.score?.trim();
    const scoreNumber =
      scoreValue === undefined || scoreValue === "" ? undefined : Number(scoreValue);

    startTransition(async () => {
      const payload = {
        assessmentId: Number(values.assessmentId),
        enrollmentId: Number(values.enrollmentId),
        score: scoreNumber,
        isAbsent: values.isAbsent,
        isExcused: values.isExcused,
        notes: values.notes,
      };

      const result = record
        ? await updateScore(record.assessmentId, record.enrollmentId, payload)
        : await createScore(payload);

      if (result?.error) {
        toast.error(result.error);
        form.setError("root", { message: result.error });
        return;
      }
      toast.success(record ? "Nota atualizada" : "Nota lançada");
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
          name="assessmentId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Avaliação</FormLabel>
              <Select value={field.value} onValueChange={field.onChange} disabled={!!record}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a avaliação" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {assessments.map((assessment) => (
                    <SelectItem key={assessment.id} value={String(assessment.id)}>
                      {assessment.label}
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
          name="enrollmentId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Matrícula</FormLabel>
              <Select value={field.value} onValueChange={field.onChange} disabled={!!record}>
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

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="score"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nota</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-2 rounded-md border p-3">
            <FormField
              control={form.control}
              name="isAbsent"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between space-y-0">
                  <FormLabel>Faltou</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isExcused"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between space-y-0">
                  <FormLabel>Justificado</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder="Opcional" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} className="justify-self-end">
          {isPending ? "Salvando..." : record ? "Atualizar" : "Lançar nota"}
        </Button>
      </form>
    </Form>
  );
}
