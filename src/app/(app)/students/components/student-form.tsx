"use client";

import { useMemo, useState, useTransition } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import Link from "next/link";
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
import { Checkbox } from "@/components/ui/checkbox";
import { createStudent, updateStudent } from "../actions";
import type { StudentRow } from "../types";
import { cn } from "@/lib/utils";

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 9);
  const part4 = digits.slice(9, 11);
  if (digits.length > 9) return `${part1}.${part2}.${part3}-${part4}`;
  if (digits.length > 6) return `${part1}.${part2}.${part3}`;
  if (digits.length > 3) return `${part1}.${part2}`;
  return part1;
}

function formatPhoneBr(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  const ddd = digits.slice(0, 2);
  const first = digits.length > 10 ? digits.slice(2, 7) : digits.slice(2, 6);
  const second = digits.length > 10 ? digits.slice(7, 11) : digits.slice(6, 10);
  if (digits.length <= 2) return ddd ? `(${ddd}` : "";
  if (digits.length <= 6) return `(${ddd}) ${first}`;
  return `(${ddd}) ${first}${second ? `-${second}` : ""}`;
}

const guardianSchema = z.object({
  guardianId: z.number(),
  guardianName: z.string().optional(),
  relationship: z.string().min(1, "Informe o vínculo"),
  isPrimary: z.boolean().default(false),
  isFinancial: z.boolean().default(false),
  livesWithStudent: z.boolean().default(false),
});

const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  birthDate: z.string().optional(),
  cpf: z
    .string()
    .min(1, "CPF é obrigatório")
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 11, "CPF deve ter 11 dígitos"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  isActive: z.boolean().default(true),
  guardians: z.array(guardianSchema).min(1, "Adicione ao menos um responsável"),
});

export type StudentFormValues = z.input<typeof formSchema>;
type StudentFormOutput = z.output<typeof formSchema>;

export function StudentForm({
  student,
  guardianOptions,
  onSuccess,
}: {
  student?: StudentRow;
  guardianOptions: { id: number; name: string; cpf: string }[];
  onSuccess?: () => void;
}) {
  const [searchGuardian, setSearchGuardian] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedRelationship, setSelectedRelationship] =
    useState<string>("Responsável");
  const [selectedPrimary, setSelectedPrimary] = useState(false);
  const [selectedFinancial, setSelectedFinancial] = useState(false);
  const [selectedLivesWith, setSelectedLivesWith] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<StudentFormValues, unknown, StudentFormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: student?.name ?? "",
      birthDate: student?.birthDate ?? "",
      cpf: student?.cpf ? formatCpf(student.cpf) : "",
      email: student?.email ?? "",
      phone: student?.phone ? formatPhoneBr(student.phone) : "",
      isActive: student?.isActive ?? true,
      guardians:
        student?.guardians?.map((g) => ({
          guardianId: g.guardianId,
          guardianName: g.guardianName,
          relationship: g.relationship,
          isPrimary: g.isPrimary,
          isFinancial: g.isFinancial,
          livesWithStudent: g.livesWithStudent,
        })) ?? [],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "guardians",
    keyName: "fieldId",
  });
  const cpfDigits = searchGuardian.replace(/\D/g, "");
  const suggestions = useMemo(
    () =>
      guardianOptions.filter((guardian) => {
        const digits = guardian.cpf.replace(/\D/g, "");
        const matchCpf = cpfDigits.length >= 3 && digits.startsWith(cpfDigits);
        const matchName =
          searchGuardian.trim().length >= 3 &&
          guardian.name.toLowerCase().includes(searchGuardian.trim().toLowerCase());
        return matchCpf || matchName;
      }),
    [guardianOptions, cpfDigits, searchGuardian]
  );

  const handleSubmit = (values: StudentFormOutput) => {
    startTransition(async () => {
      const payload = {
        ...values,
        birthDate: values.birthDate || undefined,
      };

      const result = student
        ? await updateStudent(student.id, payload)
        : await createStudent(payload);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(student ? "Aluno atualizado" : "Aluno criado");
      onSuccess?.();
    });
  };

  const addGuardian = () => {
    const digits = searchGuardian.replace(/\D/g, "");
    const normalizedQuery = searchGuardian.trim().toLowerCase();

    const option =
      guardianOptions.find((g) => g.cpf.replace(/\D/g, "") === digits) ||
      guardianOptions.find((g) => g.name.toLowerCase() === normalizedQuery);

    if (!option) {
      toast.error("Responsável não encontrado. Pesquise por CPF ou nome completo.");
      return;
    }

    const exists = form
      .getValues("guardians")
      .some((g) => g.guardianId === option.id);
    if (exists) {
      toast.error("Esse responsável já está vinculado.");
      return;
    }

    append({
      guardianId: option.id,
      guardianName: option.name,
      relationship: selectedRelationship.trim() || "Responsável",
      isPrimary: selectedPrimary,
      isFinancial: selectedFinancial,
      livesWithStudent: selectedLivesWith,
    });

    setSearchGuardian("");
    setSelectedRelationship("Responsável");
    setSelectedPrimary(false);
    setSelectedFinancial(false);
    setSelectedLivesWith(false);
    form.clearErrors("guardians");
    setShowSuggestions(false);
  };

  return (
    <Form {...form}>
      <form className="grid gap-6" onSubmit={form.handleSubmit(handleSubmit)}>
        {form.formState.errors.root?.message && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {form.formState.errors.root.message}
          </div>
        )}
        {student ? (
          <div className="grid gap-2">
            <FormLabel>Matrícula</FormLabel>
            <Input value={student.registrationNumber} readOnly disabled />
            <p className="text-xs text-muted-foreground">
              Gerada automaticamente pelo sistema.
            </p>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            A matrícula será gerada automaticamente ao salvar.
          </div>
        )}

        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <FormLabel>Responsáveis</FormLabel>
              <p className="text-sm text-muted-foreground">
                Vincule ao menos um responsável ao aluno.
              </p>
            </div>
          </div>

          {!guardianOptions.length && (
            <p className="text-sm text-destructive">
              Cadastre um responsável antes de criar o aluno.
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
            <div className="space-y-3">
              <Input
                placeholder="CPF ou nome do responsável"
                inputMode="text"
                value={searchGuardian}
                onChange={(event) => {
                  const value = event.target.value;
                  const digitsOnly = formatCpf(value);
                  setSearchGuardian(digitsOnly.length > value.length ? digitsOnly : value);
                  setShowSuggestions(true);
                }}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="relative">
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow">
                    {suggestions.map((guardian) => (
                      <button
                        type="button"
                        key={guardian.id}
                        className={cn(
                          "flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                          guardian.cpf &&
                            guardian.cpf.replace(/\D/g, "") === cpfDigits &&
                            "bg-muted/70"
                        )}
                        onClick={() => {
                          setSearchGuardian(formatCpf(guardian.cpf));
                          setShowSuggestions(false);
                        }}
                      >
                        <div className="flex-1">
                          <p className="font-medium leading-tight">{guardian.name}</p>
                          <p className="text-xs text-muted-foreground">
                            CPF {formatCpf(guardian.cpf)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {showSuggestions && suggestions.length === 0 && (
                <div className="flex items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    Nenhum responsável encontrado para esta busca.
                  </span>
                  <Link href="/guardians">
                    <Button variant="link" className="px-0 text-sm">
                      Cadastrar responsável
                    </Button>
                  </Link>
                </div>
              )}

              <Input
                placeholder="Relação (ex.: mãe, pai, responsável legal)"
                value={selectedRelationship}
                onChange={(event) => setSelectedRelationship(event.target.value)}
              />

              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedPrimary}
                    onCheckedChange={(checked) => setSelectedPrimary(checked === true)}
                  />
                  Principal
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedFinancial}
                    onCheckedChange={(checked) => setSelectedFinancial(checked === true)}
                  />
                  Financeiro
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedLivesWith}
                    onCheckedChange={(checked) => setSelectedLivesWith(checked === true)}
                  />
                  Mora com o aluno
                </label>
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={addGuardian}
                disabled={!guardianOptions.length}
              >
                Adicionar responsável
              </Button>
            </div>

            <div className="space-y-2">
              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum responsável vinculado ainda.
                </p>
              )}
              {fields.map((field, index) => {
                const guardianName =
                  field.guardianName ||
                  guardianOptions.find((g) => g.id === field.guardianId)?.name ||
                  "Responsável";

                return (
                  <div
                    key={field.fieldId}
                    className="space-y-3 rounded-md border p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold leading-tight">{guardianName}</p>
                        <p className="text-xs text-muted-foreground">
                          ID {field.guardianId}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                      >
                        Remover
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <FormLabel>Vínculo</FormLabel>
                        <Input
                          {...form.register(
                            `guardians.${index}.relationship` as const
                          )}
                        />
                      </div>
                      <div className="flex flex-wrap gap-4 pt-1 text-sm">
                        <label className="flex items-center gap-2">
                          <Controller
                            control={form.control}
                            name={`guardians.${index}.isPrimary` as const}
                            render={({ field }) => (
                              <Checkbox
                                checked={field.value || false}
                                onCheckedChange={(checked) =>
                                  field.onChange(checked === true)
                                }
                              />
                            )}
                          />
                          Principal
                        </label>
                        <label className="flex items-center gap-2">
                          <Controller
                            control={form.control}
                            name={`guardians.${index}.isFinancial` as const}
                            render={({ field }) => (
                              <Checkbox
                                checked={field.value || false}
                                onCheckedChange={(checked) =>
                                  field.onChange(checked === true)
                                }
                              />
                            )}
                          />
                          Financeiro
                        </label>
                        <label className="flex items-center gap-2">
                          <Controller
                            control={form.control}
                            name={`guardians.${index}.livesWithStudent` as const}
                            render={({ field }) => (
                              <Checkbox
                                checked={field.value || false}
                                onCheckedChange={(checked) =>
                                  field.onChange(checked === true)
                                }
                              />
                            )}
                          />
                          Mora com o aluno
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
              {(
                form.formState.errors.guardians as { message?: string } | undefined
              )?.message && (
                <p className="text-sm text-destructive">
                  {(
                    form.formState.errors.guardians as { message?: string }
                  ).message?.toString()}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome completo</FormLabel>
                <FormControl>
                  <Input placeholder="Nome completo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="birthDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de nascimento</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
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
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input placeholder="email@exemplo.com" type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl>
                  <Input
                    placeholder="(00) 00000-0000"
                    inputMode="tel"
                    maxLength={15}
                    value={field.value ?? ""}
                    onChange={(event) =>
                      field.onChange(formatPhoneBr(event.target.value))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
        </div>

        <Button type="submit" disabled={isPending} className="justify-self-end">
          {isPending ? "Salvando..." : student ? "Atualizar" : "Cadastrar"}
        </Button>
      </form>
    </Form>
  );
}
