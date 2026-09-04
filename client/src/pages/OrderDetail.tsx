import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Minus, RotateCcw, Trash2, X, XCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import type { CatalogResponse, Order } from '@/lib/types';
import { useAuth } from '@/stores/auth';
import { useCart } from '@/stores/cart';
import { money } from '@/lib/format';
import { RowsSkeleton, ErrorBox, Button } from '@/components/ui';
import OrderSummary from '@/components/OrderSummary';
import { ProductImage } from '@/components/ProductCard';

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [cancelErr, setCancelErr] = useState<string | null>(null);
  const [reorderMsg, setReorderMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editLines, setEditLines] = useState<{ itemId: number; quantity: number }[]>([]);
  const [editMsg, setEditMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const addToCart = useCart((s) => s.add);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api<{ order: Order }>(`/api/orders/${id}`),
    staleTime: 15_000,
  });

  const { data: catalog } = useQuery({
    queryKey: ['catalog'],
    queryFn: () => api<CatalogResponse>('/api/catalog'),
    staleTime: 60_000,
  });

  const cancel = useMutation({
    mutationFn: () => api(`/api/orders/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e) => setCancelErr((e as ApiError).message || 'تعذر إلغاء الطلب'),
  });

  const saveEdit = useMutation({
    mutationFn: () =>
      api<{ order: Order }>(`/api/orders/${id}/edit`, {
        method: 'POST',
        body: { items: editLines },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      setEditing(false);
      setEditMsg({ ok: true, text: 'تم تعديل الطلب وإعادة حجز القطع' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (e) => setEditMsg({ ok: false, text: (e as ApiError).message || 'فشل تعديل الطلب' }),
  });

  if (!user) return <Navigate to={`/login?next=/orders/${id}`} replace />;

  if (isLoading) return <RowsSkeleton rows={4} />;
  if (error) return <ErrorBox message={(error as Error).message} retry={refetch} />;
  if (!data) return null;

  const order = data.order;
  const cancellable = order.status === 'pending' || order.status === 'confirmed';
  const editable = order.status === 'pending';

  const startEdit = () => {
    setEditLines(order.items.map((it) => ({ itemId: it.itemId, quantity: it.quantity })));
    setEditMsg(null);
    setEditing(true);
  };

  const setQty = (itemId: number, quantity: number) =>
    setEditLines((ls) => ls.map((l) => (l.itemId === itemId ? { ...l, quantity: Math.max(1, quantity) } : l)));

  const removeLine = (itemId: number) => setEditLines((ls) => ls.filter((l) => l.itemId !== itemId));

  const byId = new Map(catalog?.items.map((it) => [it.id, it]) ?? []);
  const est = editLines.reduce(
    (s, l) => {
      const it = byId.get(l.itemId);
      if (!it) return s;
      const metal = (it.unitMetal ?? 0) * l.quantity;
      const craft = (it.unitCraft ?? 0) * l.quantity;
      return { metal: s.metal + metal, craft: s.craft + craft };
    },
    { metal: 0, craft: 0 },
  );
  const estVat = ((est.metal + est.craft) * (catalog?.vatPercent ?? 0)) / 100;
  const estTotal = est.metal + est.craft + estVat;

  const reorder = () => {
    if (!catalog) return;
    let added = 0;
    const skipped: string[] = [];
    for (const it of order.items) {
      const current = byId.get(it.itemId);
      if (!current || !current.priceable || current.unitPrice <= 0) {
        skipped.push(it.code);
        continue;
      }
      addToCart(current, it.quantity);
      added++;
    }
    setReorderMsg(
      skipped.length > 0
        ? `أُضيفت ${added} قطعة إلى السلة. ${skipped.length} غير متاحة حاليًا: ${skipped.join('، ')}`
        : `أُضيفت ${added} قطعة إلى السلة بأسعار اليوم.`,
    );
    navigate('/cart');
  };

  return (
    <div className="space-y-6">
      {editMsg && (
        <p className={`rounded-xl border p-3 text-sm font-bold ${editMsg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {editMsg.text}
        </p>
      )}

      {editing ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">تعديل الطلب {order.orderNo}</h2>
              <p className="text-xs text-slate-500">
                تُحتسب الأسعار بسعر المعدن اليوم، ويُعاد حجز القطع فور الحفظ.
              </p>
            </div>
            <button onClick={() => setEditing(false)} className="flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
              <X className="size-4" />
            </button>
          </div>

          <ul className="divide-y divide-slate-100">
            {editLines.map((l) => {
              const it = byId.get(l.itemId);
              return (
                <li key={l.itemId} className="flex items-center gap-3 py-3">
                  {it?.photoUrl ? (
                    <ProductImage item={it} className="size-14 rounded-lg" />
                  ) : (
                    <div className="flex size-14 items-center justify-center rounded-lg bg-brand-50 text-sm font-extrabold text-brand-300">
                      {(it?.code ?? '؟').slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-slate-800">{it?.name || it?.code || ''}</p>
                    <p className="text-xs text-slate-500">
                      {it?.code} · {it?.carat ?? ''} · {it?.weightG ?? ''} جم
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center rounded-lg border border-slate-300">
                      <button onClick={() => setQty(l.itemId, l.quantity + 1)} className="px-2.5 py-1.5 text-sm font-bold hover:bg-slate-50">
                        <Plus className="size-4" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold">{l.quantity}</span>
                      <button onClick={() => setQty(l.itemId, l.quantity - 1)} className="px-2.5 py-1.5 text-sm font-bold hover:bg-slate-50">
                        <Minus className="size-4" />
                      </button>
                    </div>
                    <button onClick={() => removeLine(l.itemId)} className="text-slate-400 transition hover:text-rose-600" title="حذف">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {editLines.length === 0 && (
            <p className="rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-700">
              لا يمكن حفظ طلب بدون قطع — أضف قطعًا مرة أخرى.
            </p>
          )}

          <dl className="mt-4 space-y-1.5 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between text-slate-500">
              <dt>الإجمالي المقدر (سعر اليوم)</dt>
              <dd className="font-extrabold text-brand-700">{money(estTotal)}</dd>
            </div>
            <div className="flex justify-between text-slate-500">
              <dt>إجمالي الطلب الأصلي</dt>
              <dd>{money(order.totalValue)}</dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => saveEdit.mutate()} loading={saveEdit.isPending} disabled={editLines.length === 0}>
              <Check className="size-4" />
              حفظ التعديلات
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={saveEdit.isPending}>
              إلغاء
            </Button>
          </div>
        </div>
      ) : (
        <OrderSummary order={order} />
      )}

      {reorderMsg && (
        <p className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm font-bold text-brand-800">
          {reorderMsg}
        </p>
      )}

      {!editing && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {editable && (
              <Button variant="outline" onClick={startEdit}>
                <Pencil className="size-4" />
                تعديل الطلب
              </Button>
            )}
            {order.status !== 'pending' && (
              <Button variant="outline" onClick={reorder} disabled={!catalog}>
                <RotateCcw className="size-4" />
                إعادة الطلب
              </Button>
            )}
          </div>

          {cancellable && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div>
                <p className="text-sm font-bold text-slate-800">إلغاء الطلب</p>
                <p className="text-xs text-slate-500">
                  سيتم إلغاء الحجوزات وإعادة القطع للمخزون المتاح.
                </p>
                {cancelErr && <p className="mt-1 text-xs font-bold text-rose-600">{cancelErr}</p>}
              </div>
              <Button variant="danger" onClick={() => cancel.mutate()} loading={cancel.isPending}>
                <XCircle className="size-4" />
                إلغاء الطلب
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
