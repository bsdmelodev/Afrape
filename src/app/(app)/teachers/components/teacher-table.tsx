"use client";

import { useMemo, useState, useTransition } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TeacherRow, UserOption } from "../types";
import { TeacherForm } from "./teacher-form";
import { deleteTeacher } from "../actions";
import { toast } from "sonner";
import { Pencil, Plus, Trash } from "lucide-react";
import { formatPhone } from "@/lib/utils";

interface Props {
  data: TeacherRow[];
  canWrite: boolean;
  userOptions: UserOption[];
}

export function TeacherTable({ data, canWrite, userOptions }: Props) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TeacherRow | undefined>(undefined);

  const handleDelete = (id: number) => {
    if (!confirm("Deseja remover este professor?")) return;
    startTransition(async () => {
      const result = await deleteTeacher(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Professor removido");
    });
  };

  const columns = useMemo<ColumnDef<TeacherRow>[]>(
    () => [
      {
        accessorKey: "userName",
        header: "Nome",
        cell: ({ row }) => (
          <div className="font-medium leading-tight">
            <div>{row.original.userName}</div>
            <div className="text-xs text-muted-foreground">{row.original.userEmail}</div>
          </div>
        ),
      },
      {
        accessorKey: "userCpf",
        header: "CPF",
        cell: ({ row }) => row.original.userCpf ?? "-",
        meta: { className: "whitespace-nowrap" },
      },
      {
        accessorKey: "userPhone",
        header: "Contato",
        cell: ({ row }) => formatPhone(row.original.userPhone),
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
          <h2 className="text-lg font-semibold">Professores</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre professores e vincule aos usuários.
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Novo professor
          </Button>
        )}
      </div>

      <TeacherCards
        data={data}
        canWrite={canWrite}
        onEdit={(teacher) => {
          setSelected(teacher);
          setOpen(true);
        }}
        onDelete={(id) => handleDelete(id)}
        isPending={isPending}
      />

      <div className="hidden md:block">
        <DataTable columns={columns} data={data} />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected ? "Editar professor" : "Novo professor"}</DialogTitle>
            <DialogDescription>
              {selected
                ? "Atualize os dados do professor."
                : "Preencha os campos para criar um novo professor."}
            </DialogDescription>
          </DialogHeader>
          <TeacherForm
            teacher={selected}
            userOptions={userOptions}
            onSuccess={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TeacherCards({
  data,
  canWrite,
  onEdit,
  onDelete,
  isPending,
}: {
  data: TeacherRow[];
  canWrite: boolean;
  onEdit: (teacher: TeacherRow) => void;
  onDelete: (id: number) => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-3 md:hidden">
      {data.map((teacher) => (
        <div key={teacher.id} className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Nome</p>
              <p className="text-lg font-semibold leading-tight">{teacher.userName}</p>
              <p className="text-xs text-muted-foreground">{teacher.userEmail}</p>
              <p className="text-xs text-muted-foreground">
                CPF: {teacher.userCpf ?? "-"} • Tel: {formatPhone(teacher.userPhone)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                disabled={!canWrite}
                onClick={() => onEdit(teacher)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={!canWrite || isPending}
                onClick={() => onDelete(teacher.id)}
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <div className="flex flex-col">
              <span className="font-medium text-foreground">Status</span>
              <Badge variant={teacher.isActive ? "default" : "secondary"}>
                {teacher.isActive ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <div className="flex flex-col">
              <span className="font-medium text-foreground">Criado em</span>
              <span>{teacher.createdAt}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
