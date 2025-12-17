"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { saveSchool, type SchoolInput } from "./actions";

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  cnpj: z.string().optional(),
  ie: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  website: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  logoUrl: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => v?.trim() || undefined),
});

type FormValues = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

export function SchoolForm({ initial, canEdit }: { initial: SchoolInput; canEdit: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: initial,
  });

  const onSubmit = (values: FormOutput) => {
    startTransition(async () => {
      const result = await saveSchool(values);
      if (result?.error) {
        toast.error(result.error);
        form.setError("root", { message: result.error });
        return;
      }
      toast.success("Informações da escola salvas.");
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
                <Input placeholder="Nome da escola" {...field} disabled={!canEdit} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="cnpj"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CNPJ</FormLabel>
                <FormControl>
                  <Input placeholder="00.000.000/0000-00" {...field} disabled={!canEdit} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ie"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Inscrição Estadual</FormLabel>
                <FormControl>
                  <Input placeholder="Opcional" {...field} disabled={!canEdit} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Endereço</FormLabel>
              <FormControl>
                <Input placeholder="Rua, número" {...field} disabled={!canEdit} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cidade</FormLabel>
                <FormControl>
                  <Input placeholder="Cidade" {...field} disabled={!canEdit} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado</FormLabel>
                <FormControl>
                  <Input placeholder="UF" maxLength={2} {...field} disabled={!canEdit} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="zip"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CEP</FormLabel>
                <FormControl>
                  <Input placeholder="00000-000" {...field} disabled={!canEdit} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl>
                  <Input placeholder="(00) 00000-0000" {...field} disabled={!canEdit} />
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
                  <Input type="email" placeholder="contato@escola.com" {...field} disabled={!canEdit} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input placeholder="https://..." {...field} disabled={!canEdit} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-2 rounded-md border p-3">
          <FormField
            control={form.control}
            name="logoUrl"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Logo</FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      disabled={!canEdit}
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
                          const res = await fetch("/api/upload/logo", {
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
                          toast.error("Erro ao enviar logo");
                        } finally {
                          setIsUploading(false);
                        }
                      }}
                    />
                    {field.value ? (
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={field.value} alt="Logo" className="h-full w-full object-cover" />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => field.onChange("")}
                          disabled={!canEdit}
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
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button type="submit" disabled={!canEdit || isPending || isUploading}>
            {isPending || isUploading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
