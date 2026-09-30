import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  sortable?: boolean;
  isNumeric?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  density?: 'compact' | 'comfortable';
  onRowClick?: (item: T) => void;
  selectedId?: string;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (columnKey: string) => void;
  emptyMessage?: string;
  footerRow?: React.ReactNode;
  stickyHeader?: boolean;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  density = 'compact',
  onRowClick,
  selectedId,
  sortColumn,
  sortDirection,
  onSort,
  emptyMessage = 'No records found.',
  footerRow,
  stickyHeader = true,
  className = '',
}: DataTableProps<T>) {
  const rowHeightClass = density === 'compact' ? 'py-1.5 px-2.5 text-xs' : 'py-2.5 px-3 text-sm';
  const headerHeightClass = density === 'compact' ? 'py-2 px-2.5 text-[11px]' : 'py-2.5 px-3 text-xs';

  return (
    <div
      className={`w-full overflow-x-auto border border-slate-800 rounded bg-slate-900 shadow-xs ${className}`}
    >
      <table className="w-full border-collapse text-left">
        <thead
          className={`bg-slate-950 border-b border-slate-800 font-medium text-slate-400 select-none ${
            stickyHeader ? 'sticky top-0 z-10' : ''
          }`}
        >
          <tr>
            {columns.map((col) => {
              const isSorted = sortColumn === col.key;
              const alignClass =
                col.align === 'right' || col.isNumeric
                  ? 'text-right'
                  : col.align === 'center'
                  ? 'text-center'
                  : 'text-left';

              return (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable && onSort?.(col.key)}
                  className={`${headerHeightClass} ${alignClass} font-semibold uppercase tracking-wider text-slate-400 ${
                    col.sortable ? 'cursor-pointer hover:text-slate-200' : ''
                  }`}
                >
                  <div
                    className={`inline-flex items-center gap-1 ${
                      col.align === 'right' || col.isNumeric ? 'justify-end w-full' : ''
                    }`}
                  >
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="text-slate-500">
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3 h-3 text-indigo-400" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-indigo-400" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40 hover:opacity-100" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 font-sans">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-8 text-center text-xs text-slate-500 font-sans"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, index) => {
              const id = keyExtractor(item);
              const isSelected = selectedId === id;

              return (
                <tr
                  key={id}
                  onClick={() => onRowClick?.(item)}
                  className={`transition-colors select-none ${
                    onRowClick ? 'cursor-pointer' : ''
                  } ${
                    isSelected
                      ? 'bg-indigo-950/40 text-indigo-100'
                      : 'hover:bg-slate-850/60 text-slate-300'
                  }`}
                >
                  {columns.map((col) => {
                    const alignClass =
                      col.align === 'right' || col.isNumeric
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left';

                    const numericFont = col.isNumeric ? 'font-mono tabular-nums' : '';

                    return (
                      <td
                        key={col.key}
                        className={`${rowHeightClass} ${alignClass} ${numericFont} text-slate-300`}
                      >
                        {col.render
                          ? col.render(item, index)
                          : ((item as Record<string, unknown>)[col.key] as React.ReactNode)}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
        {footerRow && (
          <tfoot className="border-t-2 border-slate-700 bg-slate-950 font-mono tabular-nums font-semibold text-xs text-slate-200">
            {footerRow}
          </tfoot>
        )}
      </table>
    </div>
  );
}
