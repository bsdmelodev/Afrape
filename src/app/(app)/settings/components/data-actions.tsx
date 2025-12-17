"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  populateDemoData,
  resetDatabase,
  generateSampleStudents,
  generateSampleProfessors,
} from "../actions";

export function DataActions() {
  const [isPopulating, startPopulate] = useTransition();
  const [isResetting, startReset] = useTransition();
  const [isGeneratingStudents, startGenStudents] = useTransition();
  const [isGeneratingProfessors, startGenProf] = useTransition();

  const handlePopulate = () => {
    startPopulate(async () => {
      try {
        const result = await populateDemoData();
        const errorMsg = (result as { error?: string })?.error;
        if (result?.success) {
          toast.success("Banco populado com dados de exemplo");
        } else {
          toast.error(errorMsg ?? "Falha ao popular dados");
        }
      } catch (err) {
        console.error(err);
        toast.error("Erro ao popular dados");
      }
    });
  };

  const handleGenerateStudents = () => {
    startGenStudents(async () => {
      try {
        const result = await generateSampleStudents();
        const errorMsg = (result as { error?: string })?.error;
        if (result?.success) {
          toast.success("Alunos e responsáveis gerados");
        } else {
          toast.error(errorMsg ?? "Falha ao gerar alunos");
        }
      } catch (err) {
        console.error(err);
        toast.error("Erro ao gerar alunos");
      }
    });
  };

  const handleGenerateProfessors = () => {
    startGenProf(async () => {
      try {
        const result = await generateSampleProfessors();
        const errorMsg = (result as { error?: string })?.error;
        if (result?.success) {
          toast.success("Professores gerados e vinculados");
        } else {
          toast.error(errorMsg ?? "Falha ao gerar professores");
        }
      } catch (err) {
        console.error(err);
        toast.error("Erro ao gerar professores");
      }
    });
  };

  const handleReset = () => {
    startReset(async () => {
      try {
        const result = await resetDatabase();
        const errorMsg = (result as { error?: string })?.error;
        if (result?.success) {
          toast.success("Banco resetado e admin recriado");
        } else {
          toast.error(errorMsg ?? "Falha ao resetar banco");
        }
      } catch (err) {
        console.error(err);
        toast.error("Erro ao resetar banco");
      }
    });
  };

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button type="button" onClick={handlePopulate} disabled={isPopulating}>
          {isPopulating ? "Populando..." : "Popular banco"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleGenerateStudents}
          disabled={isGeneratingStudents}
        >
          {isGeneratingStudents ? "Gerando..." : "Gerar aluno"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleGenerateProfessors}
          disabled={isGeneratingProfessors}
        >
          {isGeneratingProfessors ? "Gerando..." : "Gerar professores"}
        </Button>
      </div>
      <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        <p>
          Precisa limpar tudo? Este botão apaga todos os dados e recria apenas o admin padrão
          (usa as variáveis SEED_ADMIN_*). Operação destrutiva.
        </p>
        <Button type="button" variant="destructive" onClick={handleReset} disabled={isResetting}>
          {isResetting ? "Resetando..." : "Resetar banco e recriar admin"}
        </Button>
      </div>
    </>
  );
}
