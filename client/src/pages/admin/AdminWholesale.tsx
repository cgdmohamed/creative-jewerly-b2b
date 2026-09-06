import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Banknote, BookOpen, ClipboardList, PackageCheck, Scale, X } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { EmptyState, ErrorBox, Spinner } from '@/components/ui';

interface Trader { id:number; name:string; businessName?:string; phone?:string; cashBalance:number; metalBalanceG:number; openOrders:number; metalBalances?:{metalType:string;carat:string;weightG:number}[] }
interface WeightOrder { id:number; orderNo:string; traderName:string; metalType:string; carat:string; targetWeightG:number; allocatedWeightG:number; deliveredWeightG:number; returnedWeightG:number; status:string; createdAt:string }
interface Ledger { id:number; entryType:string; orderNo?:string; metalDeltaG:number; cashDelta:number; runningCashBalance:number; carat?:string; createdAt:string }
interface Data { summary:{openOrders:number;readyOrders:number;openTargetWeightG:number;cashBalance:number}; traders:Trader[]; orders:WeightOrder[] }

const statusLabel:Record<string,string>={draft:'جديد',preparing:'قيد التجهيز',ready:'جاهز',partial:'تسليم جزئي',completed:'مكتمل',cancelled:'ملغي'};
const entryLabel:Record<string,string>={deposit:'عربون',payment:'دفعة',metal_out:'تسليم وزن',metal_return:'مرتجع وزن',making_charge:'مصنعية',making_refund:'رد مصنعية',adjustment:'تسوية'};
const num=(n:number,d=3)=>Number(n||0).toLocaleString('ar-EG-u-nu-latn',{minimumFractionDigits:d,maximumFractionDigits:d});

export default function AdminWholesale() {
  const [statementId,setStatementId]=useState<number|null>(null);
  const {data,isLoading,error,refetch}=useQuery({queryKey:['admin-wholesale'],queryFn:()=>adminApi<Data>('/api/admin/wholesale')});
  const {data:statement}=useQuery({queryKey:['admin-wholesale-statement',statementId],queryFn:()=>adminApi<{trader:Trader;entries:Ledger[]}>(`/api/admin/wholesale/traders/${statementId}/statement`),enabled:!!statementId});
  if(isLoading) return <Spinner/>;
  if(error) return <ErrorBox message={(error as Error).message} retry={refetch}/>;
  if(!data) return null;
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-extrabold text-slate-900">تجار الجملة</h1><p className="mt-1 text-sm text-slate-500">طلبات الوزن وزيارات المحل ومتجر الجملة في حساب موحد</p></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric icon={<ClipboardList className="size-4"/>} label="طلبات مفتوحة" value={data.summary.openOrders}/>
      <Metric icon={<Scale className="size-4"/>} label="وزن مطلوب" value={`${num(data.summary.openTargetWeightG)} g`}/>
      <Metric icon={<PackageCheck className="size-4"/>} label="جاهز للتسليم" value={data.summary.readyOrders}/>
      <Metric icon={<Banknote className="size-4"/>} label="رصيد المصنعية" value={num(data.summary.cashBalance,2)}/>
    </div>
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white"><h2 className="border-b px-4 py-3 font-extrabold">طلبات الوزن</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-50 text-right text-xs text-slate-500"><th className="p-3">الطلب</th><th className="p-3">التاجر</th><th className="p-3">المطلوب</th><th className="p-3">المجهز</th><th className="p-3">المسلم الصافي</th><th className="p-3">الحالة</th></tr></thead><tbody>{data.orders.map(o=><tr key={o.id} className="border-t"><td className="p-3 font-mono text-xs font-bold">{o.orderNo}</td><td className="p-3 font-bold">{o.traderName}</td><td className="p-3">{num(o.targetWeightG)} g</td><td className="p-3">{num(o.allocatedWeightG)} g</td><td className="p-3">{num(Number(o.deliveredWeightG)-Number(o.returnedWeightG))} g</td><td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{statusLabel[o.status]||o.status}</span></td></tr>)}{!data.orders.length&&<tr><td colSpan={6}><EmptyState icon={<Scale className="size-10 text-slate-300"/>} title="لا توجد طلبات وزن"/></td></tr>}</tbody></table></div></section>
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white"><h2 className="border-b px-4 py-3 font-extrabold">حسابات التجار</h2><table className="w-full text-sm"><thead><tr className="bg-slate-50 text-right text-xs text-slate-500"><th className="p-3">التاجر</th><th className="p-3">طلبات مفتوحة</th><th className="p-3">رصيد الوزن حسب العيار</th><th className="p-3">رصيد المصنعية</th><th className="p-3"></th></tr></thead><tbody>{data.traders.map(t=><tr key={t.id} className="border-t"><td className="p-3"><div className="font-bold">{t.name}</div><div className="text-xs text-slate-400">{t.businessName||t.phone}</div></td><td className="p-3">{t.openOrders}</td><td className="p-3">{t.metalBalances?.length?t.metalBalances.map(b=>`${b.metalType==='gold'?'ذهب':'فضة'} ${b.carat}: ${num(b.weightG)} g`).join(' | '):'0.000 g'}</td><td className="p-3 font-bold">{num(t.cashBalance,2)}</td><td className="p-3"><button onClick={()=>setStatementId(t.id)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-slate-50"><BookOpen className="size-3.5"/> كشف الحساب</button></td></tr>)}</tbody></table></section>
    {statementId&&<div className="fixed inset-0 z-50 flex items-center justify-center p-4"><button aria-label="إغلاق" className="absolute inset-0 bg-slate-900/60" onClick={()=>setStatementId(null)}/><div className="relative z-10 max-h-[85vh] w-full max-w-4xl overflow-auto rounded-lg bg-white shadow-xl"><div className="sticky top-0 flex items-center justify-between border-b bg-white p-4"><div><h2 className="font-extrabold">كشف حساب {statement?.trader.name}</h2><p className="text-xs text-slate-500">الوزن والمصنعية والدفعات</p></div><button onClick={()=>setStatementId(null)} className="rounded-lg p-2 hover:bg-slate-100"><X className="size-4"/></button></div><table className="w-full text-sm"><thead><tr className="bg-slate-50 text-right text-xs text-slate-500"><th className="p-3">التاريخ</th><th className="p-3">الحركة</th><th className="p-3">الطلب</th><th className="p-3">العيار</th><th className="p-3">الوزن</th><th className="p-3">النقدية</th><th className="p-3">الرصيد</th></tr></thead><tbody>{(statement?.entries||[]).map(e=><tr key={e.id} className="border-t"><td className="whitespace-nowrap p-3 text-xs">{new Date(e.createdAt).toLocaleString('ar-EG-u-nu-latn')}</td><td className="p-3">{entryLabel[e.entryType]||e.entryType}</td><td className="p-3 font-mono text-xs">{e.orderNo||'—'}</td><td className="p-3">{e.carat||'—'}</td><td className="p-3">{Number(e.metalDeltaG)?`${num(e.metalDeltaG)} g`:'—'}</td><td className="p-3">{Number(e.cashDelta)?num(e.cashDelta,2):'—'}</td><td className="p-3 font-bold">{num(e.runningCashBalance,2)}</td></tr>)}</tbody></table></div></div>}
  </div>;
}

function Metric({icon,label,value}:{icon:React.ReactNode;label:string;value:React.ReactNode}) { return <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><span className="text-brand-600">{icon}</span>{label}</p><p className="mt-1 text-xl font-extrabold text-slate-900">{value}</p></div>; }
