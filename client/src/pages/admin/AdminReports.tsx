import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeDollarSign, PackageOpen, ReceiptText, TrendingUp, Users } from 'lucide-react';
import { adminApi } from '@/lib/api';
import type { SalesReport } from '@/lib/types';
import { money } from '@/lib/format';
import { EmptyState, ErrorBox, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';

export default function AdminReports() {
  const [days, setDays] = useState(30);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-reports', days],
    queryFn: () => adminApi<SalesReport>(`/api/admin/reports?days=${days}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900">تقارير المبيعات</h1>
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
                days === d ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              آخر {d} يوم
            </button>
          ))}
        </div>
      </div>

      {isLoading && <Spinner />}
      {error && <ErrorBox message={(error as Error).message} retry={refetch} />}

      {!isLoading && !error && (!data || data.summary.orders === 0) && (
        <EmptyState
          icon={<ReceiptText className="size-12 text-slate-300" />}
          title="لا مبيعات في هذه الفترة"
          subtitle="تُحتسب المبيعات من الطلبات المكتملة فقط."
        />
      )}

      {data && data.summary.orders > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card icon={<ReceiptText className="size-4" />} label="طلبات مكتملة" value={data.summary.orders} />
            <Card icon={<BadgeDollarSign className="size-4" />} label="قيمة المبيعات" value={money(data.summary.revenue)} />
            <Card icon={<TrendingUp className="size-4" />} label="متوسط قيمة الطلب" value={money(data.summary.avgOrder)} />
            <Card icon={<PackageOpen className="size-4" />} label="العربون المحصل" value={money(data.summary.downPayments)} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-base font-extrabold text-slate-900">المبيعات يوميًا</h2>
            <DailyChart daily={data.daily} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-base font-extrabold text-slate-900">الأكثر مبيعًا</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-right text-xs text-slate-500">
                    <th className="py-2 pr-1">القطعة</th>
                    <th className="py-2">الكمية</th>
                    <th className="py-2 pl-1 text-left">القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topItems.map((it, i) => (
                    <tr key={it.code} className="border-b border-slate-100">
                      <td className="py-2 pr-1">
                        <span className="text-xs font-bold text-brand-600">{i + 1}.</span>{' '}
                        <span className="font-bold text-slate-800">{it.name}</span>
                        <span className="text-xs text-slate-400" dir="ltr"> ({it.code})</span>
                      </td>
                      <td className="py-2 text-slate-600">{it.qty} قطعة</td>
                      <td className="py-2 pl-1 text-left font-bold text-brand-700">{money(it.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-slate-900">
                <Users className="size-4 text-brand-600" />
                أفضل العملاء
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-right text-xs text-slate-500">
                    <th className="py-2 pr-1">العميل</th>
                    <th className="py-2">الطلبات</th>
                    <th className="py-2 pl-1 text-left">القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {data.customers.map((c, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-2 pr-1 font-bold text-slate-800">{c.customerName}</td>
                      <td className="py-2 text-slate-600">{c.orders}</td>
                      <td className="py-2 pl-1 text-left font-bold text-brand-700">{money(c.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Card({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
        <span className="text-brand-600">{icon}</span>
        {label}
      </p>
      <p className="mt-1 text-xl font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

function DailyChart({ daily }: { daily: SalesReport['daily'] }) {
  const W = 720;
  const H = 180;
  const PAD_L = 56;
  const PAD_R = 16;
  const PAD_T = 12;
  const PAD_B = 24;
  const max = Math.max(...daily.map((d) => d.revenue), 1);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="مبيعات يومية">
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <g key={i}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={PAD_T + t * (H - PAD_T - PAD_B)}
              y2={PAD_T + t * (H - PAD_T - PAD_B)}
              className="stroke-slate-200"
              strokeDasharray="3 3"
            />
            <text x={PAD_L - 6} y={PAD_T + t * (H - PAD_T - PAD_B) + 3} textAnchor="end" fontSize="10" className="fill-slate-400">
              {money(max * (1 - t)).split(' ')[0]}
            </text>
          </g>
        ))}
        {daily.map((d, i) => {
          const barW = (W - PAD_L - PAD_R) / daily.length;
          const x = PAD_L + i * barW;
          const h = (d.revenue / max) * (H - PAD_T - PAD_B);
          const y = H - PAD_B - h;
          const showLabel = daily.length <= 16;
          return (
            <g key={d.day}>
              <rect x={x + barW * 0.22} y={y} width={barW * 0.56} height={Math.max(h, 2)} rx={3} className="fill-brand-300" />
              {showLabel && (
                <text x={x + barW / 2} y={H - PAD_B + 12} textAnchor="middle" fontSize="9" className="fill-slate-400">
                  {d.day.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-xs text-slate-400">
        إجمالي: {money(daily.reduce((s, d) => s + d.revenue, 0))} في {daily.length} يوم
      </p>
    </div>
  );
}
