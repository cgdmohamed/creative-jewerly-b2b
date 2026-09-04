export function money(n: number, currency = 'ج.م'): string {
  const v = Number(n) || 0;
  return `${v.toLocaleString('en-EG', { maximumFractionDigits: 2 })} ${currency}`;
}

export function weight(g: number | string): string {
  return `${Number(g) || 0} جم`;
}

export function metalLabel(metalType: string): string {
  return metalType === 'gold' ? 'ذهب' : 'فضة';
}

export function metalColor(metalType: string): string {
  return metalType === 'gold'
    ? 'bg-amber-100 text-amber-800 border-amber-200'
    : 'bg-slate-200 text-slate-700 border-slate-300';
}

export const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: 'قيد المراجعة', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  confirmed: { label: 'مؤكد', cls: 'bg-sky-100 text-sky-800 border-sky-200' },
  rejected: { label: 'مرفوض', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  completed: { label: 'مكتمل', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cancelled: { label: 'ملغي', cls: 'bg-slate-200 text-slate-700 border-slate-300' },
};

export function statusLabel(status: string): string {
  return STATUS_META[status]?.label ?? status;
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}
