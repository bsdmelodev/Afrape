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
import { createEnrollment, updateEnrollment } from "../actions";
import type { EnrollmentRow, Option } from "../types";

const formSchema = z.object({
  studentId: z.string().min(1, "Selecione o aluno"),
  classGroupId: z.string().min(1, "Selecione a turma"),
  status: z.enum(["active", "transferred", "cancelled", "completed"]),
  enrolledAt: z.string().optional(),
  leftAt: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const STATUS_LABELS: Record<FormValues["status"], string> = {
  active: "Ativa",
  transferred: "Transferida",
  cancelled: "Cancelada",
  completed: "Concluída",
};

export function EnrollmentForm({
  enrollment,
  students,
  classGroups,
  onSuccess,
}: {
  enrollment?: EnrollmentRow;
  students: Option[];
  classGroups: Option[];
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      studentId: enrollment ? String(enrollment.studentId) : "",
      classGroupId: enrollment ? String(enrollment.classGroupId) : "",
      status: (enrollment?.status as FormValues["status"]) ?? "active",
      enrolledAt: enrollment?.enrolledAt ?? "",
      leftAt: enrollment?.leftAt ?? "",
    },
  });

  const handleSubmit = (values: FormValues) => {
    startTransition(async () => {
      const payload = {
        studentId: Number(values.studentId),
        classGroupId: Number(values.classGroupId),
        status: values.status,
        enrolledAt: values.enrolledAt || undefined,
        leftAt: values.leftAt || undefined,
      };
      const result = enrollment
        ? await updateEnrollment(enrollment.id, payload)
        : await createEnrollment(payload);

      if (result?.error) {
        toast.error(result.error);
        form.setError("root", { message: result.error });
        return;
      }

      toast.success(enrollment ? "Matrícula atualizada" : "Matrícula criada");
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
          name="studentId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Aluno</FormLabel>
              <Select
                value={field.value ? String(field.value) : undefined}
                onValueChange={(value) => field.onChange(Number(value))}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o aluno" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={String(student.id)}>
                      {student.label}
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
          name="classGroupId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Turma</FormLabel>
              <Select
                value={field.value ? String(field.value) : undefined}
                onValueChange={(value) => field.onChange(Number(value))}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a turma" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {classGroups.map((group) => (
                    <SelectItem key={group.id} value={String(group.id)}>
                      {group.label}
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
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => field.onChange(value as FormValues["status"])}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="enrolledAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de entrada</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="leftAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Saída (opcional)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={isPending} className="justify-self-end">
          {isPending ? "Salvando..." : enrollment ? "Atualizar" : "Salvar"}
        </Button>
      </form>
    </Form>
  );
}
