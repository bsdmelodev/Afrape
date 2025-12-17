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
import { toast } from "sonner";
import { Pencil, Plus, Trash } from "lucide-react";
import { deleteUser } from "../actions";
import { UserForm } from "./user-form";
import type { GroupOption, UserRow } from "../types";

interface Props {
  data: UserRow[];
  groups: GroupOption[];
  canWrite: boolean;
}

export function UserTable({ data, groups, canWrite }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<UserRow | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  const handleDelete = (id: number) => {
    if (!confirm("Deseja remover este usuário?")) return;
    startTransition(async () => {
      const result = await deleteUser(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Usuário removido");
    });
  };

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => {
      const base: ColumnDef<UserRow>[] = [
        {
          accessorKey: "name",
          header: "Nome",
          cell: ({ row }) => (
            <div className="font-medium leading-tight">
              <div>{row.original.name}</div>
              <div className="text-xs text-muted-foreground">{row.original.email}</div>
            </div>
          ),
        },
        {
          accessorKey: "groupName",
          header: "Grupo",
          cell: ({ row }) => row.original.groupName,
        },
        {
          accessorKey: "cpf",
          header: "CPF",
          cell: ({ row }) => row.original.cpf || "-",
          meta: { className: "whitespace-nowrap" },
        },
        {
          accessorKey: "phone",
          header: "Telefone",
          cell: ({ row }) => row.original.phone ?? "-",
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
        },
        {
          accessorKey: "lastLoginAt",
          header: "Último acesso",
          cell: ({ row }) => row.original.lastLoginAt || "-",
        },
      ];

      if (canWrite) {
        base.push({
          id: "actions",
          header: "Ações",
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
          meta: { isActions: true, className: "text-right whitespace-nowrap" },
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
          <h2 className="text-lg font-semibold">Usuários</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie acessos e permissões.
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
            <Plus className="h-4 w-4" /> Novo usuário
          </Button>
        )}
      </div>

      <DataTable columns={columns} data={data} cardBreakpoint="sm" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{selected ? "Editar usuário" : "Novo usuário"}</DialogTitle>
            <DialogDescription>
              {selected
                ? "Atualize dados, grupo e senha do usuário."
                : "Crie um novo usuário e defina suas credenciais."}
            </DialogDescription>
          </DialogHeader>
          <UserForm
            user={selected}
            groups={groups}
            onSuccess={() => {
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
