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
  AssessmentClassSubjectOption,
  AssessmentRow,
  AssessmentTeacherOption,
  AssessmentTermOption,
} from "../types";
import { createAssessment, updateAssessment } from "../actions";

const formSchema = z.object({
  classSubjectId: z.string().min(1, "Selecione o componente"),
  termId: z.string().min(1, "Selecione o período"),
  title: z.string().min(1, "Título é obrigatório"),
  assessmentType: z.enum(["exam", "quiz", "homework", "project", "other"]),
  assessmentDate: z.string().min(1, "Data é obrigatória"),
  weight: z
    .string()
    .min(1, "Peso é obrigatório")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, "Peso inválido"),
  maxScore: z
    .string()
    .min(1, "Nota máxima é obrigatória")
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, "Nota máxima inválida"),
  isPublished: z.boolean(),
  createdByTeacherId: z.string().min(1, "Selecione o professor"),
});

type FormValues = z.infer<typeof formSchema>;

export function AssessmentForm({
  record,
  classSubjects,
  terms,
  teachers,
  onSuccess,
}: {
  record?: AssessmentRow;
  classSubjects: AssessmentClassSubjectOption[];
  terms: AssessmentTermOption[];
  teachers: AssessmentTeacherOption[];
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      classSubjectId: record ? String(record.classSubjectId) : "",
      termId: record ? String(record.termId) : "",
      title: record?.title ?? "",
      assessmentType: (record?.assessmentType as FormValues["assessmentType"] | undefined) ?? "exam",
      assessmentDate: record?.assessmentDate ?? "",
      weight: record ? String(record.weight) : "1",
      maxScore: record ? String(record.maxScore) : "10",
      isPublished: record?.isPublished ?? false,
      createdByTeacherId: record ? String(record.createdByTeacherId) : "",
    },
  });

  const handleSubmit = (values: FormValues) => {
    startTransition(async () => {
      const weight = Number(values.weight);
      const maxScore = Number(values.maxScore);
      const payload = {
        classSubjectId: Number(values.classSubjectId),
        termId: Number(values.termId),
        title: values.title,
        assessmentType: values.assessmentType,
        assessmentDate: values.assessmentDate,
        weight,
        maxScore,
        isPublished: values.isPublished,
        createdByTeacherId: Number(values.createdByTeacherId),
      };

      const result = record
        ? await updateAssessment(record.id, payload)
        : await createAssessment(payload);

      if (result?.error) {
        toast.error(result.error);
        form.setError("root", { message: result.error });
        return;
      }
      toast.success(record ? "Avaliação atualizada" : "Avaliação criada");
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

        <div className="grid gap-4 md:grid-cols-2">
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
                        {term.schoolYear} — {term.name}
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
            name="assessmentType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="exam">Prova</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                    <SelectItem value="homework">Trabalho</SelectItem>
                    <SelectItem value="project">Projeto</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input placeholder="Ex.: Prova bimestral" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="assessmentDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="weight"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Peso</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min={0.01} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="maxScore"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nota máxima</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" min={0.1} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="createdByTeacherId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Professor criador</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o professor" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={String(teacher.id)}>
                      {teacher.name}
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
          name="isPublished"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Publicada</FormLabel>
              <Select
                value={field.value ? "true" : "false"}
                onValueChange={(value) => field.onChange(value === "true")}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="false">Não</SelectItem>
                  <SelectItem value="true">Sim</SelectItem>
                </SelectContent>
              </Select>
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
