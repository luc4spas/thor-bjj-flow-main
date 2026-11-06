import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useMemo } from "react";

export function usePagination<T>(items: T[], page: number, pageSize: number) {
  return useMemo(() => {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safe = Math.min(Math.max(1, page), totalPages);
    const start = (safe - 1) * pageSize;
    return {
      total,
      totalPages,
      page: safe,
      pageItems: items.slice(start, start + pageSize),
      from: total === 0 ? 0 : start + 1,
      to: Math.min(start + pageSize, total),
    };
  }, [items, page, pageSize]);
}

interface Props {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange?: (s: number) => void;
  pageSizeOptions?: number[];
}

export function PaginationBar({
  page, totalPages, total, from, to, pageSize,
  onPageChange, onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>{total === 0 ? "Nenhum registro" : `${from}–${to} de ${total}`}</span>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span>Por página</span>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-7 w-[72px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => onPageChange(1)}><ChevronsLeft className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="px-2">Página {page} de {totalPages}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}><ChevronsRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
