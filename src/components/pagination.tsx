import Link from "next/link";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  perPage: number;
  total: number;
  basePath: string;
  query?: Record<string, string | undefined>;
}

export function Pagination({ page, perPage, total, basePath, query = {} }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const prevPage = Math.max(page - 1, 1);
  const nextPage = Math.min(page + 1, totalPages);

  const buildHref = (target: number) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    params.set("page", target.toString());
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      {page > 1 ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={buildHref(prevPage)}>Anterior</Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Anterior
        </Button>
      )}
      <span className="text-muted-foreground">
        Página {page} de {totalPages}
      </span>
      {page < totalPages ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={buildHref(nextPage)}>Próxima</Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Próxima
        </Button>
      )}
    </div>
  );
}
