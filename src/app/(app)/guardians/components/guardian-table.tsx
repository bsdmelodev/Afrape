"use client";

import { useMemo, useState, useTransition } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { deleteGuardian } from "../actions";
import { GuardianForm } from "./guardian-form";
import type { GuardianRow } from "../types";
import { toast } from "sonner";
import { Info, Pencil, Plus, Printer, Trash } from "lucide-react";
import { formatPhone } from "@/lib/utils";

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

interface Props {
  data: GuardianRow[];
  canWrite: boolean;
}

export function GuardianTable({ data, canWrite }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<GuardianRow | undefined>(undefined);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportGuardian, setReportGuardian] = useState<GuardianRow | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const handleDelete = (id: number) => {
    if (!confirm("Deseja remover este responsável?")) return;
    startTransition(async () => {
      const result = await deleteGuardian(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Responsável removido");
    });
  };

  const columns = useMemo<ColumnDef<GuardianRow>[]>(
    () => {
      const base: ColumnDef<GuardianRow>[] = [
        {
          accessorKey: "name",
          header: "Nome",
          cell: ({ row }) => (
            <div className="font-medium leading-tight">
              <div>{row.original.name}</div>
              {row.original.email && (
                <div className="text-xs text-muted-foreground">{row.original.email}</div>
              )}
            </div>
          ),
        },
        {
          accessorKey: "cpf",
          header: "CPF",
          cell: ({ row }) => formatCpf(row.original.cpf),
          meta: { className: "whitespace-nowrap" },
        },
        {
          accessorKey: "phone",
          header: "Telefone",
          cell: ({ row }) => formatPhone(row.original.phone),
          meta: { className: "whitespace-nowrap" },
        },
        {
          accessorKey: "email",
          header: "E-mail",
          cell: ({ row }) => row.original.email ?? "-",
          meta: { className: "hidden md:table-cell" },
        },
        {
          accessorKey: "createdAt",
          header: "Criado em",
          cell: ({ row }) => row.original.createdAt,
          meta: { className: "hidden md:table-cell whitespace-nowrap" },
        },
        {
          id: "students",
          header: "Alunos",
          cell: ({ row }) =>
            row.original.students.length > 0 ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Info className="h-4 w-4" />
                    Ver ({row.original.students.length})
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Alunos vinculados</p>
                    <div className="space-y-1 text-sm">
                      {row.original.students.map((student) => (
                        <div
                          key={student.id}
                          className="rounded-md bg-muted/60 px-2 py-1.5"
                        >
                          <p className="font-medium leading-tight">{student.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Matrícula {student.registrationNumber}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <span className="text-xs text-muted-foreground">Sem alunos</span>
            ),
        },
      ];

      if (canWrite) {
        base.push({
          id: "actions",
          header: "Ações",
          cell: ({ row }) => (
            <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 text-right">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Relatório para impressão"
                onClick={() => {
                  setReportGuardian(row.original);
                  setReportOpen(true);
                }}
              >
                <Printer className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setSelected(row.original);
                  setOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                onClick={() => handleDelete(row.original.id)}
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          ),
          meta: { className: "whitespace-nowrap text-right" },
        });
      } else {
        base.push({
          id: "report",
          header: "Relatório",
          cell: ({ row }) => (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Relatório para impressão"
              onClick={() => {
                setReportGuardian(row.original);
                setReportOpen(true);
              }}
            >
              <Printer className="h-4 w-4" />
            </Button>
          ),
          meta: { className: "whitespace-nowrap text-right" },
        });
      }

      return base;
    },
    [canWrite, isPending]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Responsáveis</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre responsáveis e dados de contato.
          </p>
        </div>
        {canWrite && (
          <Button
            className="gap-2"
            onClick={() => {
              setSelected(undefined);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Novo responsável
          </Button>
        )}
      </div>

      {/* Tabela em telas médias e maiores */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <DataTable columns={columns} data={data} />
        </div>
      </div>

      {/* Cards para mobile */}
      <div className="space-y-3 md:hidden">
        {data.map((guardian) => (
          <div key={guardian.id} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="text-lg font-semibold leading-tight">{guardian.name}</p>
                <p className="text-sm text-muted-foreground">CPF: {formatCpf(guardian.cpf)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Relatório para impressão"
                  onClick={() => {
                    setReportGuardian(guardian);
                    setReportOpen(true);
                  }}
                >
                  <Printer className="h-4 w-4" />
                </Button>
                {canWrite && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelected(guardian);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isPending}
                      onClick={() => handleDelete(guardian.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
              <div className="flex flex-col">
                <span className="font-medium text-foreground">Telefone</span>
                <span>{formatPhone(guardian.phone)}</span>
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-foreground">E-mail</span>
                <span>{guardian.email ?? "-"}</span>
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-foreground">Criado em</span>
                <span>{guardian.createdAt}</span>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Info className="h-4 w-4" />
                Alunos vinculados
              </div>
              {guardian.students.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum aluno vinculado.</p>
              ) : (
                <div className="space-y-2">
                  {guardian.students.map((student) => (
                    <div key={student.id} className="rounded-md bg-muted/60 px-3 py-2">
                      <p className="font-medium leading-tight">{student.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Matrícula {student.registrationNumber}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selected ? "Editar responsável" : "Novo responsável"}
            </DialogTitle>
            <DialogDescription>
              {selected
                ? "Atualize as informações do responsável."
                : "Preencha os campos para criar um responsável."}
            </DialogDescription>
          </DialogHeader>
          <GuardianForm guardian={selected} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent
          className="max-w-3xl text-left print:fixed print:inset-0 print:m-0 print:w-full print:max-w-full print:translate-x-0 print:translate-y-0 print:rounded-none print:border-0 print:p-6 print:shadow-none print:overflow-visible"
        >
          <DialogHeader className="items-start text-left sm:text-left print:text-left">
            <DialogTitle className="text-left sm:text-left print:text-left">
              Relatório do responsável
            </DialogTitle>
            <DialogDescription className="text-left sm:text-left print:text-left">
              Informações completas para impressão.
            </DialogDescription>
          </DialogHeader>
          {reportGuardian && (
            <div className="space-y-4 text-left print:space-y-3 print:text-left">
              <div className="flex flex-col gap-4 print:gap-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground print:text-xs">Nome</p>
                  <p className="text-lg font-semibold print:text-base">{reportGuardian.name}</p>
                  <p className="text-sm text-muted-foreground print:text-xs">
                    CPF: {formatCpf(reportGuardian.cpf)}
                  </p>
                  <p className="text-sm text-muted-foreground print:text-xs">
                    Telefone: {formatPhone(reportGuardian.phone)}
                  </p>
                  <p className="text-sm text-muted-foreground print:text-xs">
                    E-mail: {reportGuardian.email || "-"}
                  </p>
                  <p className="text-sm text-muted-foreground print:text-xs">
                    Criado em: {reportGuardian.createdAt}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="gap-2 self-start print:hidden"
                  onClick={() => window.print()}
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold print:text-base">Alunos vinculados</p>
                {reportGuardian.students.length === 0 ? (
                  <p className="text-sm text-muted-foreground print:text-xs">
                    Nenhum aluno vinculado.
                  </p>
                ) : (
                  <div className="space-y-2 print:columns-2 print:gap-4">
                    {reportGuardian.students.map((student) => (
                      <div
                        key={student.id}
                        className="rounded-md border p-3 print:border-0 print:p-0"
                      >
                        <p className="font-semibold leading-tight print:text-sm">
                          {student.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Matrícula {student.registrationNumber}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
