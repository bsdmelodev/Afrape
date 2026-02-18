"use client";

import { useMemo, useState, useTransition } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteRoom } from "../actions";
import type { RoomRow } from "../types";
import { RoomForm } from "./room-form";

function statusVariant(status: RoomRow["status"]) {
  if (status === "CRITICO") return "destructive" as const;
  if (status === "ATENCAO") return "secondary" as const;
  if (status === "OK") return "default" as const;
  return "outline" as const;
}

function statusLabel(status: RoomRow["status"]) {
  if (status === "SEM_LEITURA") return "Sem leitura";
  if (status === "ATENCAO") return "Atenção";
  if (status === "CRITICO") return "Crítico";
  return "OK";
}

export function RoomTable({
  data,
  canManage,
}: {
  data: RoomRow[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<RoomRow | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const onDelete = (id: number) => {
    if (!confirm("Deseja remover esta sala?")) return;
    startTransition(async () => {
      const result = await deleteRoom(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Sala removida");
    });
  };

  const columns = useMemo<ColumnDef<RoomRow>[]>(() => {
    const base: ColumnDef<RoomRow>[] = [
      {
        accessorKey: "name",
        header: "Sala",
        cell: ({ row }) => (
          <div className="leading-tight">
            <div className="font-semibold">{row.original.name}</div>
            <div className="text-xs text-muted-foreground">{row.original.location || "Sem localização"}</div>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={statusVariant(row.original.status)}>{statusLabel(row.original.status)}</Badge>
        ),
      },
      {
        id: "lastReading",
        header: "Última leitura",
        cell: ({ row }) => {
          if (row.original.lastTemperature === null || row.original.lastHumidity === null) {
            return "Sem leitura";
          }
          return `${row.original.lastTemperature.toFixed(2)} °C · ${row.original.lastHumidity.toFixed(2)} %`;
        },
      },
      {
        id: "lastMeasuredAt",
        header: "Medida em",
        cell: ({ row }) => row.original.lastMeasuredAt ?? "-",
      },
      {
        id: "active",
        header: "Ativa",
        cell: ({ row }) => (row.original.isActive ? "Sim" : "Não"),
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
              onClick={() => onDelete(row.original.id)}
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
          <h2 className="text-lg font-semibold">Salas</h2>
          <p className="text-sm text-muted-foreground">Cadastro e status das salas monitoradas.</p>
        </div>
        {canManage ? (
          <Button
            className="gap-2"
            onClick={() => {
              setSelected(undefined);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nova sala
          </Button>
        ) : null}
      </div>

      <DataTable columns={columns} data={data} emptyMessage="Nenhuma sala cadastrada." />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected ? "Editar sala" : "Nova sala"}</DialogTitle>
            <DialogDescription>
              {selected
                ? "Atualize os dados da sala para monitoramento."
                : "Preencha os dados para cadastrar uma nova sala."}
            </DialogDescription>
          </DialogHeader>
          <RoomForm room={selected} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
