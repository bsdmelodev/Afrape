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
import type {
  AttendanceClassSubjectOption,
  AttendanceRow,
  AttendanceTeacherOption,
  AttendanceTermOption,
} from "../types";
import { SessionForm } from "./session-form";
import { deleteSession } from "../actions";
import { toast } from "sonner";
import { Pencil, Plus, Trash } from "lucide-react";

interface Props {
  data: AttendanceRow[];
  canWrite: boolean;
  classSubjects: AttendanceClassSubjectOption[];
  terms: AttendanceTermOption[];
  teachers: AttendanceTeacherOption[];
}

export function SessionTable({ data, canWrite, classSubjects, terms, teachers }: Props) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AttendanceRow | undefined>(undefined);

  const handleDelete = (id: number) => {
    if (!confirm("Deseja remover esta sessão?")) return;
    startTransition(async () => {
      const result = await deleteSession(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Sessão removida");
    });
  };

  const columns = useMemo<ColumnDef<AttendanceRow>[]>(
    () => [
      {
        accessorKey: "classSubjectName",
        header: "Componente",
        cell: ({ row }) => (
          <div className="leading-tight">
            <div className="font-semibold">{row.original.classSubjectName}</div>
            <div className="text-xs text-muted-foreground">
              Turma {row.original.classGroupYear} — {row.original.classGroupName}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "sessionDate",
        header: "Data",
        cell: ({ row }) => row.original.sessionDate,
        meta: { className: "whitespace-nowrap" },
      },
      {
        accessorKey: "lessonNumber",
        header: "Aula",
        cell: ({ row }) => row.original.lessonNumber ?? "-",
        meta: { className: "hidden md:table-cell whitespace-nowrap" },
      },
      {
        accessorKey: "termName",
        header: "Período",
        cell: ({ row }) => row.original.termName ?? "-",
        meta: { className: "hidden md:table-cell" },
      },
      {
        accessorKey: "teacherName",
        header: "Professor",
        cell: ({ row }) => (
          <div className="leading-tight space-y-0.5">
            <div className="font-medium">{row.original.teacherName}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.teacherCpf ? `CPF: ${row.original.teacherCpf}` : "CPF: —"}
            </div>
            <div className="text-xs text-muted-foreground">
              {row.original.teacherPhone ? `Tel: ${row.original.teacherPhone}` : "Tel: —"}
            </div>
            {row.original.teacherEmail && (
              <div className="text-xs text-muted-foreground">{row.original.teacherEmail}</div>
            )}
          </div>
        ),
      },
      {
        id: "details",
        header: "Detalhes",
        cell: ({ row }) => {
          const hasTime = row.original.startsAt || row.original.endsAt;
          const hasContent = !!row.original.content;
          return (
            <div className="space-y-2 text-sm leading-tight">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border bg-muted/50 px-2 py-0.5">
                  {row.original.termName ?? "Período não informado"}
                </span>
                <span className="rounded-full border bg-muted/50 px-2 py-0.5">
                  Aula {row.original.lessonNumber ?? "—"}
                </span>
              </div>
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <div className="text-xs font-medium text-muted-foreground">Horário</div>
                <div className="text-sm">
                  {hasTime
                    ? `${row.original.startsAt ?? "—"} · ${row.original.endsAt ?? "—"}`
                    : "Não informado"}
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <div className="text-xs font-medium text-muted-foreground">Conteúdo</div>
                <div className="text-sm text-muted-foreground">
                  {hasContent ? row.original.content : "Nenhum conteúdo informado"}
                </div>
              </div>
            </div>
          );
        },
        meta: { className: "hidden xl:table-cell" },
      },
      {
        id: "actions",
        header: "Ações",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1.5 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              disabled={!canWrite}
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
              disabled={!canWrite || isPending}
              onClick={() => handleDelete(row.original.id)}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        ),
        meta: { className: "text-right whitespace-nowrap", isActions: true },
      },
    ],
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
          <h2 className="text-lg font-semibold">Frequência (sessões)</h2>
          <p className="text-sm text-muted-foreground">
            Registre sessões de aula para controle de frequência.
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Nova sessão
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={data} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected ? "Editar sessão" : "Nova sessão"}</DialogTitle>
            <DialogDescription>
              {selected
                ? "Atualize os dados da sessão."
                : "Preencha os campos para registrar uma sessão de aula."}
            </DialogDescription>
          </DialogHeader>
          <SessionForm
            record={selected}
            classSubjects={classSubjects}
            terms={terms}
            teachers={teachers}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
