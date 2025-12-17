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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type {
  AttendanceClassSubjectOption,
  AttendanceRow,
  AttendanceTeacherOption,
  AttendanceTermOption,
} from "../types";
import { createSession, updateSession } from "../actions";

const formSchema = z.object({
  classSubjectId: z.string().min(1, "Selecione o componente"),
  termId: z.string().optional(),
  sessionDate: z.string().min(1, "Data é obrigatória"),
  lessonNumber: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  content: z.string().optional(),
  launchedByTeacherId: z.string().min(1, "Selecione o professor"),
});

type FormValues = z.infer<typeof formSchema>;

export function SessionForm({
  record,
  classSubjects,
  terms,
  teachers,
  onSuccess,
}: {
  record?: AttendanceRow;
  classSubjects: AttendanceClassSubjectOption[];
  terms: AttendanceTermOption[];
  teachers: AttendanceTeacherOption[];
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      classSubjectId: record ? String(record.classSubjectId) : "",
      termId: record?.termId ? String(record.termId) : "",
      sessionDate: record?.sessionDate ?? "",
      lessonNumber: record?.lessonNumber ? String(record.lessonNumber) : "",
      startsAt: record?.startsAt ?? "",
      endsAt: record?.endsAt ?? "",
      content: record?.content ?? "",
      launchedByTeacherId: record ? String(record.teacherId) : "",
    },
  });

  const handleSubmit = (values: FormValues) => {
    startTransition(async () => {
      const payload = {
        classSubjectId: Number(values.classSubjectId),
        termId: values.termId ? Number(values.termId) : undefined,
        sessionDate: values.sessionDate,
        lessonNumber: values.lessonNumber ? Number(values.lessonNumber) : undefined,
        startsAt: values.startsAt || undefined,
        endsAt: values.endsAt || undefined,
        content: values.content?.trim() || undefined,
        launchedByTeacherId: Number(values.launchedByTeacherId),
      };

      const result = record ? await updateSession(record.id, payload) : await createSession(payload);
      if (result?.error) {
        toast.error(result.error);
        form.setError("root", { message: result.error });
        return;
      }
      toast.success(record ? "Sessão atualizada" : "Sessão criada");
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
                <FormLabel>Período (opcional)</FormLabel>
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
            name="sessionDate"
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
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="lessonNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Aula nº (opcional)</FormLabel>
                <FormControl>
                  <Input type="number" min={1} {...field} />
                </FormControl>
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
                  <Input type="time" {...field} />
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
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="launchedByTeacherId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Professor responsável</FormLabel>
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
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Conteúdo (opcional)</FormLabel>
              <FormControl>
                <Textarea rows={3} placeholder="Resumo do conteúdo" {...field} />
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
