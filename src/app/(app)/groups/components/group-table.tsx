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
import { toast } from "sonner";
import { Pencil, Plus, Trash } from "lucide-react";
import { deleteGroup } from "../actions";
import { GroupForm } from "./group-form";
import type { GroupRow } from "../types";

interface Props {
  data: GroupRow[];
  canWrite: boolean;
  allPermissions: { id: number; code: string; description: string | null }[];
}

export function GroupTable({ data, canWrite, allPermissions }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<GroupRow | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const handleDelete = (id: number) => {
    if (!confirm("Deseja remover este grupo?")) return;
    startTransition(async () => {
      const result = await deleteGroup(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Grupo removido");
    });
  };

  const columns = useMemo<ColumnDef<GroupRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Nome",
        cell: ({ row }) => row.original.name,
      },
      {
        accessorKey: "description",
        header: "Descrição",
        cell: ({ row }) => row.original.description || "-",
      },
      {
        accessorKey: "createdAt",
        header: "Criado em",
        cell: ({ row }) => row.original.createdAt,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
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
      },
    ],
    [canWrite, isPending]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Grupos</h2>
          <p className="text-sm text-muted-foreground">
            Defina grupos de acesso e permissões.
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
            <Plus className="h-4 w-4" /> Novo grupo
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={data} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected ? "Editar grupo" : "Novo grupo"}</DialogTitle>
            <DialogDescription>
              {selected
                ? "Atualize o nome ou descrição do grupo."
                : "Crie um grupo para organizar permissões."}
            </DialogDescription>
          </DialogHeader>
          <GroupForm
            group={selected}
            permissions={allPermissions}
            onSuccess={() => {
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
