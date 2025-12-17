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
  AssignmentClassSubjectOption,
  AssignmentRow,
  AssignmentTeacherOption,
} from "../types";
import { AssignmentForm } from "./assignment-form";
import { deleteAssignment } from "../actions";
import { toast } from "sonner";
import { Pencil, Plus, Trash } from "lucide-react";

interface Props {
  data: AssignmentRow[];
  canWrite: boolean;
  classSubjects: AssignmentClassSubjectOption[];
  teachers: AssignmentTeacherOption[];
}

export function AssignmentTable({ data, canWrite, classSubjects, teachers }: Props) {
  const roleLabel = (role: number) => {
    if (role === 1) return "1 - Titular";
    if (role === 2) return "2 - Apoio";
    if (role === 3) return "3 - Substituto";
    return String(role);
  };

  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AssignmentRow | undefined>(undefined);

  const handleDelete = (id: number) => {
    if (!confirm("Deseja remover este vínculo?")) return;
    startTransition(async () => {
      const result = await deleteAssignment(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Vínculo removido");
    });
  };

  const columns = useMemo<ColumnDef<AssignmentRow>[]>(
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
        accessorKey: "teacherName",
        header: "Professor",
        cell: ({ row }) => (
          <div className="leading-tight">
            <div className="font-semibold">{row.original.teacherName}</div>
            <div className="text-xs text-muted-foreground">{row.original.teacherEmail ?? "-"}</div>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: "Papel",
        cell: ({ row }) => roleLabel(row.original.role),
      },
      {
        accessorKey: "startsAt",
        header: "Início",
        cell: ({ row }) => row.original.startsAt ?? "-",
        meta: { className: "hidden md:table-cell whitespace-nowrap" },
      },
      {
        accessorKey: "endsAt",
        header: "Fim",
        cell: ({ row }) => row.original.endsAt ?? "-",
        meta: { className: "hidden md:table-cell whitespace-nowrap" },
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
          <h2 className="text-lg font-semibold">Prof. x Componente</h2>
          <p className="text-sm text-muted-foreground">
            Vincule professores aos componentes curriculares.
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Novo vínculo
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={data} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected ? "Editar vínculo" : "Novo vínculo"}</DialogTitle>
            <DialogDescription>
              {selected
                ? "Atualize os dados do vínculo."
                : "Preencha os campos para vincular o professor ao componente."}
            </DialogDescription>
          </DialogHeader>
          <AssignmentForm
            record={selected}
            classSubjects={classSubjects}
            teachers={teachers}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
