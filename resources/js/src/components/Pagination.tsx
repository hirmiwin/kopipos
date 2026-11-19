import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  lastPage: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, lastPage, onPage }: PaginationProps) {
  if (lastPage <= 1) return null;
  return (
    <div className="pagination">
      <div className="pagination__controls">
        <button
          type="button"
          className="button button--ghost button--small"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <span>Halaman {page} dari {lastPage}</span>
        <button
          type="button"
          className="button button--ghost button--small"
          disabled={page >= lastPage}
          onClick={() => onPage(page + 1)}
          aria-label="Halaman berikutnya"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
