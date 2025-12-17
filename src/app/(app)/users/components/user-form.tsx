"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
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
import { createUser, updateUser, type CreateUserInput, type UpdateUserInput } from "../actions";
import type { GroupOption, UserRow } from "../types";
import { formatPhone, formatCpf } from "@/lib/utils";

const baseSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().optional(),
  groupId: z.coerce.number().int().positive("Selecione o grupo"),
  phone: z
    .string()
    .min(1, "Telefone é obrigatório")
    .transform((v) => v?.replace(/\D/g, "") || "")
    .refine((v) => v.length >= 10 && v.length <= 11, "Telefone deve ter 10 ou 11 dígitos"),
  cpf: z
    .string()
    .min(1, "CPF é obrigatório")
    .transform((v) => v?.replace(/\D/g, "") || "")
    .refine((v) => v.length === 11, "CPF deve ter 11 dígitos"),
  isActive: z.boolean().default(true),
  avatarUrl: z.string().optional(),
});

type FormValues = z.input<typeof baseSchema>;
type FormOutput = z.output<typeof baseSchema>;

export function UserForm({
  user,
  groups,
  onSuccess,
}: {
  user?: UserRow;
  groups: GroupOption[];
  onSuccess?: () => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      password: "",
      groupId: user?.groupId,
      cpf: user?.cpf ?? "",
      phone: user?.phone ?? "",
      isActive: user?.isActive ?? true,
      avatarUrl: user?.avatarUrl ?? "",
    },
  });

  const handleSubmit = (values: FormOutput) => {
    if (!user) {
      if (!values.password) {
        const message = "Senha é obrigatória para criar um usuário";
        toast.error(message);
        form.setError("password", { message });
        form.setError("root", { message });
        return;
      }
      if (values.password.length < 6) {
        const message = "Senha mínima de 6 caracteres";
        toast.error(message);
        form.setError("password", { message });
        form.setError("root", { message });
        return;
      }
    }

    startTransition(async () => {
      const basePayload = {
        name: values.name,
        email: values.email,
        groupId: Number(values.groupId),
        cpf: values.cpf,
        phone: values.phone,
        isActive: values.isActive,
        avatarUrl: values.avatarUrl?.trim() || undefined,
      };

      const result = user
        ? await updateUser(user.id, {
            ...basePayload,
            password: values.password || undefined,
          } satisfies UpdateUserInput)
        : await createUser({
            ...basePayload,
            password: values.password || "",
          } satisfies CreateUserInput);

      if (result?.error) {
        // Espelha o erro no formulário para destaque visual
        const msg = result.error.toLowerCase();
        if (msg.includes("senha")) form.setError("password", { message: result.error });
        if (msg.includes("cpf")) form.setError("cpf", { message: result.error });
        if (msg.includes("e-mail") || msg.includes("email"))
          form.setError("email", { message: result.error });
        if (msg.includes("grupo")) form.setError("groupId", { message: result.error });
        form.setError("root", { message: result.error });
        return;
      }

      toast.success(user ? "Usuário atualizado" : "Usuário criado");
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl>
                <Input placeholder="Nome completo" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone</FormLabel>
              <FormControl>
                <Input
                  placeholder="(11) 99999-9999"
                  inputMode="numeric"
                  maxLength={15}
                  value={field.value ?? ""}
                  onChange={(event) => field.onChange(formatPhone(event.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Senha {user && <span className="text-muted-foreground">(deixe em branco para manter)</span>}
              </FormLabel>
              <FormControl>
                <Input type="password" placeholder="******" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="groupId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Grupo</FormLabel>
              <Select
                value={field.value ? String(field.value) : undefined}
                onValueChange={(value) => field.onChange(Number(value))}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o grupo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={String(group.id)}>
                      {group.name}
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
            name="isActive"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select
                  value={field.value ? "true" : "false"}
                  onValueChange={(value) => field.onChange(value === "true")}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
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

          <FormField
            control={form.control}
            name="avatarUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Avatar</FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const MAX_SIZE = 5 * 1024 * 1024;
                        const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
                        if (!ALLOWED_TYPES.includes(file.type)) {
                          toast.error("Envie uma imagem JPEG, PNG, WEBP ou GIF.");
                          return;
                        }
                        if (file.size > MAX_SIZE) {
                          toast.error("A imagem deve ter no máximo 5MB.");
                          return;
                        }
                        try {
                          setIsUploading(true);
                          const data = new FormData();
                          data.append("file", file);
                          if (field.value) {
                            data.append("currentUrl", field.value);
                          }
                          const res = await fetch("/api/upload/avatar", {
                            method: "POST",
                            body: data,
                          });
                          const json = await res.json();
                          if (!res.ok) {
                            throw new Error(json.error || "Falha no upload");
                          }
                          field.onChange(json.url);
                        } catch (err) {
                          console.error(err);
                          toast.error("Erro ao enviar imagem");
                        } finally {
                          setIsUploading(false);
                        }
                      }}
                    />
                    {field.value ? (
                      <p className="text-xs text-muted-foreground break-all">
                        Avatar enviado
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Opcional. Envie JPG, PNG, WEBP ou GIF até 5MB.
                      </p>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button
          type="submit"
          disabled={isPending || isUploading}
          className="justify-self-end"
        >
          {isPending || isUploading ? "Salvando..." : "Salvar"}
        </Button>
      </form>
    </Form>
  );
}
