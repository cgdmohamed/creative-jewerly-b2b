import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { CatalogResponse } from '@/lib/types';
import ProductCard from '@/components/ProductCard';
import { Button, CatalogSkeleton, ErrorBox, EmptyState, inputCls } from '@/components/ui';
import { cn } from '@/lib/cn';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-xs font-bold transition',
        active
          ? 'border-brand-600 bg-brand-600 text-white'
          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  );
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-4 first:pt-0">
      <h3 className="mb-2.5 text-xs font-extrabold text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

export default function CatalogSection() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeCategory = params.get('cat');
  const metal = params.get('metal');
  const carat = params.get('carat');
  const status = params.get('status');
  const stockOnly = params.get('stock') === '1';
  const sort = params.get('sort');

  const setParam = (key: string, value?: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!value) next.delete(key);
      else next.set(key, value);
      return next;
    });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['catalog'],
    queryFn: () => api<CatalogResponse>('/api/catalog'),
    staleTime: 60_000,
  });

  const caratOptions = useMemo(() => {
    const set = new Set<string>();
    for (const i of data?.items ?? []) if (i.carat) set.add(i.carat);
    return [...set].sort((a, b) => Number(a) - Number(b));
  }, [data]);

  const items = useMemo(() => {
    if (!data) return [];
    let list = data.items;
    if (activeCategory && activeCategory !== 'all') {
      list = list.filter((i) => String(i.categoryId) === activeCategory);
    }
    if (metal) list = list.filter((i) => i.metalType === metal);
    if (carat) list = list.filter((i) => String(i.carat) === carat);
    if (status) list = list.filter((i) => i.physicalStatus === status);
    if (stockOnly) list = list.filter((i) => (i.availableQty ?? 0) > 0);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.code.toLowerCase().includes(q) ||
          (i.name ?? '').toLowerCase().includes(q) ||
          (i.categoryName ?? '').toLowerCase().includes(q),
      );
    }

    const sorted = [...list];
    if (sort === 'price-asc') {
      sorted.sort((a, b) => (a.priceable ? +a.unitPrice : Infinity) - (b.priceable ? +b.unitPrice : Infinity));
    } else if (sort === 'price-desc') {
      sorted.sort((a, b) => (b.priceable ? +b.unitPrice : -Infinity) - (a.priceable ? +a.unitPrice : -Infinity));
    } else if (sort === 'name-asc') {
      sorted.sort((a, b) => (a.name || a.code).localeCompare(b.name || b.code, 'ar'));
    }
    return sorted;
  }, [data, activeCategory, metal, carat, status, stockOnly, sort, search]);

  const activeCount = [activeCategory && activeCategory !== 'all', metal, carat, status, stockOnly || null, sort]
    .filter(Boolean).length;
  const hasFilters = activeCount > 0;

  useEffect(() => {
    document.body.style.overflow = filtersOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [filtersOpen]);

  const filterSections = (
    <div className="divide-y divide-slate-100">
      <FilterSection title="القسم">
        <div className="flex flex-wrap gap-2">
          <Chip active={!activeCategory} onClick={() => setParam('cat')}>
            الكل
          </Chip>
          {(data?.categories ?? []).map((c) => (
            <Chip key={c.id} active={activeCategory === String(c.id)} onClick={() => setParam('cat', String(c.id))}>
              {c.nameAr}
            </Chip>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="النوع">
        <div className="flex flex-wrap gap-2">
          <Chip active={!metal} onClick={() => setParam('metal')}>
            الكل
          </Chip>
          <Chip active={metal === 'gold'} onClick={() => setParam('metal', 'gold')}>
            ذهب
          </Chip>
          <Chip active={metal === 'silver'} onClick={() => setParam('metal', 'silver')}>
            فضة
          </Chip>
        </div>
      </FilterSection>

      {caratOptions.length > 0 && (
        <FilterSection title="العيار">
          <div className="flex flex-wrap gap-2">
            <Chip active={!carat} onClick={() => setParam('carat')}>
              الكل
            </Chip>
            {caratOptions.map((c) => (
              <Chip key={c} active={carat === c} onClick={() => setParam('carat', c)}>
                {c}
              </Chip>
            ))}
          </div>
        </FilterSection>
      )}

      <FilterSection title="الحالة">
        <div className="flex flex-wrap gap-2">
          <Chip active={!status} onClick={() => setParam('status')}>
            الكل
          </Chip>
          <Chip active={status === 'new'} onClick={() => setParam('status', 'new')}>
            جديد
          </Chip>
          <Chip active={status === 'used'} onClick={() => setParam('status', 'used')}>
            مستعمل
          </Chip>
        </div>
      </FilterSection>

      <FilterSection title="الترتيب">
        <select
          value={sort ?? ''}
          onChange={(e) => setParam('sort', e.target.value || undefined)}
          className={cn(inputCls, 'w-full py-2 text-xs font-bold')}
        >
          <option value="">الترتيب الافتراضي</option>
          <option value="price-asc">السعر: من الأقل إلى الأعلى</option>
          <option value="price-desc">السعر: من الأعلى إلى الأقل</option>
          <option value="name-asc">الاسم: من أ إلى ي</option>
        </select>
      </FilterSection>

      <FilterSection title="التوفر">
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <span className="text-sm font-bold text-slate-700">المتوفر فقط</span>
          <input
            type="checkbox"
            checked={stockOnly}
            onChange={(e) => setParam('stock', e.target.checked ? '1' : undefined)}
            className="peer sr-only"
          />
          <span className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-brand-600 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" />
        </label>
      </FilterSection>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-extrabold text-slate-900">المخزون المتاح</h2>
          {data && <span className="text-sm font-bold text-slate-500">({items.length} قطعة)</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none sm:w-72">
            <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث برمز القطعة أو الاسم…"
              className={cn(inputCls, 'pr-9')}
            />
          </div>
          <button
            onClick={() => setFiltersOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:hidden"
          >
            <SlidersHorizontal className="size-4 text-brand-600" />
            تصفية
            {activeCount > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="hidden rounded-2xl border border-slate-200 bg-white p-4 sm:block">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
            <SlidersHorizontal className="size-4 text-brand-600" />
            تصفية النتائج
          </div>
          {hasFilters && (
            <button
              onClick={() => setParams({})}
              className="flex items-center gap-1 text-xs font-bold text-rose-600 transition hover:text-rose-700"
            >
              <X className="size-3.5" />
              مسح الكل
            </button>
          )}
        </div>
        {filterSections}
      </div>

      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-900/50 transition-opacity sm:hidden',
          filtersOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setFiltersOpen(false)}
        aria-hidden={!filtersOpen}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!filtersOpen}
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-80 max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-300 sm:hidden',
          filtersOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 p-4">
          <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
            <SlidersHorizontal className="size-4 text-brand-600" />
            تصفية النتائج
          </div>
          <div className="flex items-center gap-1">
            {hasFilters && (
              <button
                onClick={() => setParams({})}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 hover:text-rose-700"
              >
                <X className="size-3.5" />
                مسح الكل
              </button>
            )}
            <button
              onClick={() => setFiltersOpen(false)}
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="إغلاق"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">{filterSections}</div>

        <div className="border-t border-slate-200 p-4">
          <Button onClick={() => setFiltersOpen(false)} className="w-full">
            عرض النتائج ({items.length})
          </Button>
        </div>
      </aside>

      {isLoading && <CatalogSkeleton />}
      {error && <ErrorBox message={(error as Error).message} retry={refetch} />}
      {data && items.length === 0 && (
        <EmptyState
          title="لا توجد قطع مطابقة"
          subtitle="جرّب تعديل الفلاتر أو كلمة البحث، أو عُد لاحقًا بعد تحديث المخزون."
        />
      )}
      {data && items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <ProductCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
