"use client";

import { useMemo, useState, useTransition } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash } from "lucide-react";
import { toast } from "sonner";
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
import type { DeviceRow } from "../types";
import { deleteDevice } from "../actions";
import { PortariaForm } from "./portaria-form";

export function PortariaTable({
  data,
  canManage,
}: {
  data: DeviceRow[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DeviceRow | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const remove = (id: number) => {
    if (!confirm("Deseja remover este device de portaria?")) return;
    startTransition(async () => {
      const result = await deleteDevice(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Device removido");
    });
  };

  const columns = useMemo<ColumnDef<DeviceRow>[]>(() => {
    const base: ColumnDef<DeviceRow>[] = [
      {
        accessorKey: "name",
        header: "Device",
        cell: ({ row }) => row.original.name,
      },
      {
        id: "status",
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
      },
    ];

    if (canManage) {
      base.push({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
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
              onClick={() => remove(row.original.id)}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        ),
        meta: { className: "text-right", isActions: true },
      });
    }

    return base;
  }, [canManage, isPending]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Portarias (RFID)</h2>
          <p className="text-sm text-muted-foreground">Dispositivos de controle de acesso por RFID.</p>
        </div>
        {canManage ? (
          <Button
            className="gap-2"
            onClick={() => {
              setSelected(undefined);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nova portaria
          </Button>
        ) : null}
      </div>

      <DataTable columns={columns} data={data} emptyMessage="Nenhum device PORTARIA cadastrado." />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected ? "Editar portaria" : "Nova portaria"}</DialogTitle>
            <DialogDescription>
              {selected
                ? "Atualize o status, nome ou regenere o token."
                : "Cadastre um novo device para a portaria RFID."}
            </DialogDescription>
          </DialogHeader>
          <PortariaForm device={selected} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
