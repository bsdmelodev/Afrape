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
import { deletePermission } from "../actions";
import { PermissionForm } from "./permission-form";
import type { PermissionRow } from "../types";

interface Props {
  data: PermissionRow[];
  canWrite: boolean;
}

export function PermissionTable({ data, canWrite }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PermissionRow | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const handleDelete = (id: number) => {
    if (!confirm("Deseja remover esta permissão?")) return;
    startTransition(async () => {
      const result = await deletePermission(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Permissão removida");
    });
  };

  const columns = useMemo<ColumnDef<PermissionRow>[]>(
    () => {
      const base: ColumnDef<PermissionRow>[] = [
        {
          accessorKey: "code",
          header: "Código",
          cell: ({ row }) => row.original.code,
        },
        {
          accessorKey: "description",
          header: "Descrição",
          cell: ({ row }) => row.original.description || "-",
        },
      ];

      if (canWrite) {
        base.push({
          id: "actions",
          header: "",
          cell: ({ row }) => (
            <div className="flex justify-end gap-2">
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
          <h2 className="text-lg font-semibold">Permissões</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre códigos de permissão para RBAC.
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
            <Plus className="h-4 w-4" /> Nova permissão
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={data} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected ? "Editar permissão" : "Nova permissão"}</DialogTitle>
            <DialogDescription>
              {selected
                ? "Atualize o código ou descrição da permissão."
                : "Crie um código de permissão para usar no RBAC."}
            </DialogDescription>
          </DialogHeader>
          <PermissionForm
            permission={selected}
            onSuccess={() => {
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
