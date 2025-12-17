"use client";

import { useMemo, useState, useTransition } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteStudent } from "../actions";
import { StudentForm } from "./student-form";
import type { StudentRow } from "../types";
import { toast } from "sonner";
import { Info, Pencil, Plus, Trash } from "lucide-react";
import { formatPhone } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Props {
  data: StudentRow[];
  canWrite: boolean;
  guardianOptions: { id: number; name: string; cpf: string }[];
}

export function StudentTable({ data, canWrite, guardianOptions }: Props) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<StudentRow | undefined>(undefined);

  const handleDelete = (id: number) => {
    if (!confirm("Deseja remover este aluno?")) return;
    startTransition(async () => {
      const result = await deleteStudent(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Aluno removido");
    });
  };

  const columns = useMemo<ColumnDef<StudentRow>[]>(
    () => {
      const base: ColumnDef<StudentRow>[] = [
        {
          accessorKey: "registrationNumber",
          header: "Matrícula",
          cell: ({ row }) => row.original.registrationNumber,
          meta: { className: "whitespace-nowrap" },
        },
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
          accessorKey: "phone",
          header: "Contato",
          cell: ({ row }) => formatPhone(row.original.phone),
          meta: { className: "whitespace-nowrap" },
        },
        {
          accessorKey: "isActive",
          header: "Status",
          cell: ({ row }) => (
            <Badge variant={row.original.isActive ? "default" : "secondary"}>
              {row.original.isActive ? "Ativo" : "Inativo"}
            </Badge>
          ),
        },
        {
          accessorKey: "createdAt",
          header: "Criado em",
          cell: ({ row }) => row.original.createdAt,
          meta: { className: "hidden md:table-cell" },
        },
        {
          id: "guardians",
          header: "Responsáveis",
          cell: ({ row }) =>
            row.original.guardians.length > 0 ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Info className="h-4 w-4" />
                    Ver ({row.original.guardians.length})
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Responsáveis vinculados</p>
                    <div className="space-y-1 text-sm">
                      {row.original.guardians.map((g) => (
                        <div key={g.guardianId} className="rounded-md bg-muted/60 px-2 py-1.5">
                          <p className="font-medium leading-tight">{g.guardianName}</p>
                          <p className="text-xs text-muted-foreground">
                            CPF {g.guardianCpf ?? "-"} • {formatPhone(g.guardianPhone)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Vínculo: {g.relationship}
                            {g.isPrimary ? " • Principal" : ""}
                            {g.isFinancial ? " • Financeiro" : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <span className="text-xs text-muted-foreground">Sem responsáveis</span>
            ),
          meta: { className: "text-right whitespace-nowrap" },
        },
      ];

      if (canWrite) {
        base.push({
          id: "actions",
          header: "Ações",
          cell: ({ row }) => (
            <div className="flex items-center justify-end gap-1.5 sm:gap-2">
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
          meta: { className: "text-right whitespace-nowrap" },
        });
      }

      return base;
    },
    [canWrite, isPending]
  );

  const openCreate = () => {
    setSelected(undefined);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Alunos</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre estudantes e acompanhe seus dados.
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Novo aluno
          </Button>
        )}
      </div>

      {/* Tabela em telas médias e maiores */}
      <div className="hidden md:block">
        <DataTable columns={columns} data={data} />
      </div>

      {/* Cards para mobile */}
      <div className="space-y-3 md:hidden">
        {data.map((student) => (
          <div key={student.id} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Matrícula</p>
                <p className="text-lg font-semibold leading-tight">
                  {student.registrationNumber}
                </p>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="text-base font-medium leading-tight">{student.name}</p>
                {student.email && (
                  <p className="text-xs text-muted-foreground">{student.email}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {student.guardians.length > 0 ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" className="shrink-0">
                        <Info className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">Responsáveis vinculados</p>
                        <div className="space-y-1 text-sm">
                          {student.guardians.map((g) => (
                            <div
                              key={g.guardianId}
                              className="rounded-md bg-muted/60 px-2 py-1.5"
                            >
                              <p className="font-medium leading-tight">{g.guardianName}</p>
                              <p className="text-xs text-muted-foreground">
                                CPF {g.guardianCpf ?? "-"} • {formatPhone(g.guardianPhone)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Vínculo: {g.relationship}
                                {g.isPrimary ? " • Principal" : ""}
                                {g.isFinancial ? " • Financeiro" : ""}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : null}
                {canWrite && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelected(student);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isPending}
                      onClick={() => handleDelete(student.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
              <div className="flex flex-col">
                <span className="font-medium text-foreground">Contato</span>
                <span>{formatPhone(student.phone)}</span>
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-foreground">Status</span>
                <Badge variant={student.isActive ? "default" : "secondary"}>
                  {student.isActive ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-foreground">Criado em</span>
                <span>{student.createdAt}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selected ? "Editar aluno" : "Novo aluno"}
            </DialogTitle>
            <DialogDescription>
              {selected
                ? "Atualize os dados do aluno."
                : "Preencha os campos para criar um novo aluno."}
            </DialogDescription>
          </DialogHeader>
          <StudentForm
            student={selected}
            guardianOptions={guardianOptions}
            onSuccess={() => {
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
