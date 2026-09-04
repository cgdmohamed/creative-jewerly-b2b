import PrefetchLink from '@/components/PrefetchLink';
import { ShieldCheck, BadgePercent, Truck, Coins } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import CatalogSection from '@/components/CatalogSection';
import { useAuth } from '@/stores/auth';
import { api } from '@/lib/api';
import type { ShopConfig } from '@/lib/types';
import { money, metalLabel } from '@/lib/format';

const PERKS = [
  { icon: BadgePercent, title: 'أسعار سجلية يومية', desc: 'سعر المعدن المحدّث يوميًا + المصنعية' },
  { icon: ShieldCheck, title: 'حجز فوري', desc: 'نحجز المخزون لطلبك فور تأكيد الطلب' },
  { icon: Truck, title: 'تأكيد من الفريق', desc: 'فريق المتجر يؤكد ويجهز طلبك للتحصيل' },
];

export default function Home() {
  const { user } = useAuth();
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => api<ShopConfig>('/api/config'),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl bg-brand-800 p-8 text-white sm:p-12">
        <div className="relative z-10 max-w-2xl space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
            متجر البيع بالجملة الرسمي
          </p>
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
            سبائك ومشغولات ذهبية وفضية للشركات والمحلات
          </h1>
          <p className="text-sm leading-relaxed text-brand-100 sm:text-base">
            تصفح المخزون المتاح، ضع طلبك بجزء من المبلغ كعربون، ويتولى فريق المتجر
            حجز القطع وتأكيد الطلب للتحصيل والتسليم.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href="#catalog"
              className="rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-brand-800 transition hover:bg-brand-50"
            >
              تصفح المخزون
            </a>
            {!user && (
              <PrefetchLink
                to="/register"
                className="rounded-xl border border-white/40 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-white/10"
              >
                سجّل كعميل جملة
              </PrefetchLink>
            )}
          </div>
        </div>
        <div className="pointer-events-none absolute -left-10 -top-10 size-52 rounded-full bg-brand-500/30 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-24 size-64 rounded-full bg-brand-400/20 blur-3xl" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-500">
          <Coins className="size-4 text-brand-600" />
          أسعار المعدن اليوم — {metalLabel('gold')} / {metalLabel('silver')}
          {config?.ratesFetchedAt && (
            <span className="text-[11px] text-slate-400">
              آخر تحديث {new Date(config.ratesFetchedAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(config?.rates ?? []).map((r, i) => (
            <span key={i} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-700">
              {metalLabel(r.metalType)} {r.carat ? `${r.carat} ` : ''}
              <span className="text-brand-700">{r.pricePerGram != null ? money(r.pricePerGram) : '—'}</span>
              <span className="text-[11px] font-medium text-slate-400"> / جم</span>
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {PERKS.map((p) => (
          <div key={p.title} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <p.icon className="size-5" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">{p.title}</h3>
              <p className="text-xs text-slate-500">{p.desc}</p>
            </div>
          </div>
        ))}
      </section>

      <section id="catalog" className="scroll-mt-24">
        <CatalogSection />
      </section>
    </div>
  );
}
