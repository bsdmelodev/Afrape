"use client";

import { useState, useTransition } from "react";
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
import { updateProfile, type ProfileInput } from "./actions";
import { formatCpf } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  cpf: z
    .string()
    .default("")
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 0 || v.length === 11, "CPF deve ter 11 dígitos"),
  password: z
    .string()
    .min(6, "Senha mínima de 6 caracteres")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  avatarUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
});

type FormValues = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

export function ProfileForm({ initial }: { initial: ProfileInput }) {
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: initial,
  });

  const onSubmit = (values: FormOutput) => {
    startTransition(async () => {
      const result = await updateProfile(values);
      if (result?.error) {
        toast.error(result.error);
        form.setError("root", { message: result.error });
        return;
      }
      toast.success("Perfil atualizado");
      form.reset(values);
    });
  };

  return (
    <Form {...form}>
      <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
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
                <Input placeholder="Seu nome" {...field} />
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
                  onChange={(e) => field.onChange(formatCpf(e.target.value))}
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
              <FormLabel>Nova senha (opcional)</FormLabel>
              <FormControl>
                <Input type="password" placeholder="******" {...field} />
              </FormControl>
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
                  <input
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
                        const res = await fetch("/api/upload/avatar", { method: "POST", body: data });
                        const json = await res.json();
                        if (!res.ok) {
                          throw new Error(json.error || "Falha no upload");
                        }
                        field.onChange(json.url);
                      } catch (err) {
                        console.error(err);
                        toast.error("Erro ao enviar avatar");
                      } finally {
                        setIsUploading(false);
                      }
                    }}
                  />
                  {field.value ? (
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={field.value} alt="Avatar" className="h-full w-full object-cover" />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => field.onChange("")}
                        disabled={isPending || isUploading}
                      >
                        Remover
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Opcional. Imagem até 5MB.</p>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending || isUploading} className="justify-self-end">
          {isPending || isUploading ? "Salvando..." : "Salvar"}
        </Button>
      </form>
    </Form>
  );
}
