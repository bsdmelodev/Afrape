"use client";

import { useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { createTeacher, updateTeacher } from "../actions";
import type { TeacherRow, UserOption } from "../types";
import { formatCpf, formatPhone } from "@/lib/utils";

const formSchema = z.object({
  userId: z.string().min(1, "Selecione o usuário"),
  isActive: z.boolean().default(true),
});

type FormValues = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

export function TeacherForm({
  teacher,
  userOptions,
  onSuccess,
}: {
  teacher?: TeacherRow;
  userOptions: UserOption[];
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const options = useMemo(
    () =>
      userOptions.filter(
        (u) => !u.teacherId || (teacher && u.teacherId === teacher.id)
      ),
    [userOptions, teacher]
  );

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userId: teacher ? String(teacher.userId) : "",
      isActive: teacher?.isActive ?? true,
    },
  });

  const selectedUser = options.find((u) => String(u.id) === form.watch("userId"));

  const handleSubmit = (values: FormOutput) => {
    startTransition(async () => {
      const payload = {
        ...values,
        userId: Number(values.userId),
      };

      const result = teacher
        ? await updateTeacher(teacher.id, payload)
        : await createTeacher(payload);

      if (result?.error) {
        // Destaca no campo e no formulário
        form.setError("userId", { message: result.error });
        form.setError("root", { message: result.error });
        return;
      }

      toast.success(teacher ? "Professor atualizado" : "Professor criado");
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
          name="userId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Usuário</FormLabel>
              {teacher ? (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <p className="font-semibold">{selectedUser?.name}</p>
                  <p className="text-muted-foreground">{selectedUser?.email}</p>
                  <p className="text-muted-foreground">
                    CPF: {selectedUser?.cpf ? formatCpf(selectedUser.cpf) : "—"} • Tel:{" "}
                    {selectedUser?.phone ? formatPhone(selectedUser.phone) : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">O usuário não pode ser alterado.</p>
                </div>
              ) : (
                <Select
                  value={field.value}
                  onValueChange={(value) => field.onChange(value)}
                  disabled={!!teacher}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um usuário" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {options.map((user) => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.name} — {user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          {!teacher &&
            (selectedUser ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-semibold">{selectedUser.name}</p>
                <p className="text-muted-foreground">{selectedUser.email}</p>
                <p className="text-muted-foreground">
                  CPF: {selectedUser.cpf ? formatCpf(selectedUser.cpf) : "—"} • Tel:{" "}
                  {selectedUser.phone ? formatPhone(selectedUser.phone) : "—"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione um usuário do grupo Professor.
              </p>
            ))}

          <div className="grid gap-4 md:grid-cols-2">
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
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="true">Ativo</SelectItem>
                      <SelectItem value="false">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Button type="submit" disabled={isPending} className="justify-self-end">
          {isPending ? "Salvando..." : teacher ? "Atualizar" : "Cadastrar"}
        </Button>
      </form>
    </Form>
  );
}
