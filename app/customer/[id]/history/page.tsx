"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import Link from "next/link";

type TxType = "all" | "sale" | "payment" | "تحصيل نقدي";

const SALE_TYPES    = ["sale", "بيع"];
const PAYMENT_TYPES = ["payment", "تحصيل نقدي"];

function txIcon(type: string) {
  if (SALE_TYPES.includes(type))    return { icon: "📦", bg: "bg-indigo-100", color: "text-indigo-600" };
  if (type === "تحصيل نقدي")        return { icon: "💵", bg: "bg-emerald-100", color: "text-emerald-600" };
  if (type === "payment")           return { icon: "💳", bg: "bg-blue-100",    color: "text-blue-600" };
  return { icon: "📄", bg: "bg-slate-100", color: "text-slate-600" };
}

function txLabel(type: string) {
  if (type === "sale")          return "فاتورة بيع";
  if (type === "payment")       return "سداد مع فاتورة";
  if (type === "تحصيل نقدي")   return "تحصيل نقدي";
  return type;
}

export default function CustomerHistory() {
  const { id } = useParams();
  const [customer, setCustomer]         = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [filterType, setFilterType]     = useState<TxType>("all");
  const [searchTerm, setSearchTerm]     = useState("");

  useEffect(() => { if (id) loadData(); }, [id]);

  async function loadData() {
    setLoading(true);
    const [{ data: cust }, { data: trans }] = await Promise.all([
      supabase.from("customers").select("*").eq("id", id).single(),
      supabase.from("customer_transactions").select("*").eq("customer_id", id).order("created_at", { ascending: false }),
    ]);
    setCustomer(cust);
    setTransactions(trans || []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    let list = [...transactions];
    if (filterType !== "all") list = list.filter(t => t.type === filterType);
    if (searchTerm) list = list.filter(t => t.description?.includes(searchTerm) || t.amount?.toString().includes(searchTerm));
    return list;
  }, [transactions, filterType, searchTerm]);

  // ── إحصائيات سريعة ──
  const totalSales    = transactions.filter(t => SALE_TYPES.includes(t.type)).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalPaid     = transactions.filter(t => PAYMENT_TYPES.includes(t.type)).reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalProfit   = transactions.filter(t => SALE_TYPES.includes(t.type)).reduce((s, t) => s + (Number(t.profit) || 0), 0);

  const filterTabs: { key: TxType; label: string }[] = [
    { key: "all",          label: `الكل (${transactions.length})` },
    { key: "sale",         label: `فواتير (${transactions.filter(t=>t.type==="sale").length})` },
    { key: "payment",      label: `سداد (${transactions.filter(t=>t.type==="payment").length})` },
    { key: "تحصيل نقدي",  label: `تحصيل (${transactions.filter(t=>t.type==="تحصيل نقدي").length})` },
  ];

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-right font-sans pb-10" dir="rtl">
      <div className="max-w-4xl mx-auto p-4 space-y-5">

        {/* ══ Header ══ */}
        <header className="bg-[#0f172a] text-white p-6 rounded-[2rem] shadow-xl flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link href="/customer" className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-xs font-black transition-all">⬅️ رجوع</Link>
            <div>
              <h1 className="text-xl font-black">{customer?.name}</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">سجل المعاملات المالي</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-xl text-sm font-black ${customer?.balance > 0 ? "bg-rose-600" : "bg-emerald-600"}`}>
              {customer?.balance > 0 ? `دين: ${customer?.balance?.toLocaleString("ar-EG")} ج.م` : "حساب سليم ✅"}
            </div>
            <Link
              href={`/customer/${id}`}
              className="bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-2.5 rounded-xl font-black text-sm transition-all active:scale-95"
            >
              ➕ فاتورة جديدة
            </Link>
          </div>
        </header>

        {/* ══ Summary Cards ══ */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">إجمالي المشتريات</p>
            <p className="text-2xl font-black text-slate-900">{totalSales.toLocaleString("ar-EG")}</p>
            <p className="text-[10px] text-slate-400 font-bold mt-1">ج.م</p>
          </div>
          <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">إجمالي المدفوع</p>
            <p className="text-2xl font-black text-emerald-600">{totalPaid.toLocaleString("ar-EG")}</p>
            <p className="text-[10px] text-slate-400 font-bold mt-1">ج.م</p>
          </div>
          <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">الربح المحقق</p>
            <p className="text-2xl font-black text-indigo-600">{totalProfit.toLocaleString("ar-EG")}</p>
            <p className="text-[10px] text-slate-400 font-bold mt-1">ج.م</p>
          </div>
        </div>

        {/* ══ Filters ══ */}
        <div className="bg-white p-3 rounded-[2rem] border border-slate-200 shadow-sm space-y-3">
          <div className="flex gap-2 flex-wrap">
            {filterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterType(tab.key)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${filterType === tab.key ? "bg-[#0f172a] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <input
            placeholder="🔍 ابحث في المعاملات..."
            className="w-full p-3 bg-slate-50 rounded-xl font-bold text-slate-900 outline-none text-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* ══ Transactions ══ */}
        {loading ? (
          <div className="bg-white p-20 rounded-[2rem] text-center text-slate-400 font-black animate-pulse">⏳ جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-20 rounded-[2rem] border-2 border-dashed border-slate-200 text-center text-slate-300">
            <p className="text-5xl mb-4">📜</p>
            <p className="font-black">لا توجد معاملات</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => {
              const { icon, bg, color } = txIcon(t.type);
              const isSale = SALE_TYPES.includes(t.type);
              const isOpen = expandedId === t.id;
              return (
                <div key={t.id} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden transition-all">
                  {/* رأس المعاملة */}
                  <div
                    onClick={() => setExpandedId(isOpen ? null : t.id)}
                    className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${bg}`}>
                        {icon}
                      </div>
                      <div>
                        <p className={`font-black text-sm ${color}`}>{txLabel(t.type)}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                          {new Date(t.created_at).toLocaleString("ar-EG", { day:"numeric", month:"long", year:"numeric", hour:"2-digit", minute:"2-digit" })}
                        </p>
                      </div>
                    </div>
                    <div className="text-left flex items-center gap-4">
                      <div>
                        <p className={`text-xl font-black ${isSale ? "text-slate-900" : "text-emerald-600"}`}>
                          {isSale ? "+" : "−"} {t.amount?.toLocaleString("ar-EG")} ج.م
                        </p>
                        {isSale && t.profit != null && (
                          <p className="text-[10px] text-emerald-600 font-black text-left">ربح: {Number(t.profit).toFixed(1)} ج</p>
                        )}
                      </div>
                      <span className="text-slate-300 text-lg">{isOpen ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* تفاصيل الفاتورة */}
                  {isOpen && (
                    <div className="bg-slate-50 border-t border-slate-100 p-5">
                      {t.items && t.items.length > 0 ? (
                        <>
                          <table className="w-full text-sm mb-4">
                            <thead>
                              <tr className="text-slate-400 font-black text-[10px] uppercase border-b border-slate-200">
                                <th className="pb-3 text-right">الصنف</th>
                                <th className="pb-3 text-center">الكمية</th>
                                <th className="pb-3 text-center">السعر</th>
                                <th className="pb-3 text-left">الإجمالي</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {t.items.map((item: any, idx: number) => (
                                <tr key={idx}>
                                  <td className="py-3 font-black text-slate-900">{item.name}</td>
                                  <td className="py-3 text-center font-bold text-slate-600">
                                    {item.qty} <span className="text-[9px] text-slate-400">{item.unit}</span>
                                  </td>
                                  <td className="py-3 text-center font-bold text-slate-600">{Number(item.price).toLocaleString("ar-EG")} ج</td>
                                  <td className="py-3 text-left font-black">{(item.qty * item.price).toLocaleString("ar-EG")} ج</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="flex justify-between items-center border-t border-slate-200 pt-4">
                            <Link
                              href={`/customer/${id}/history/edit/${t.id}`}
                              className="bg-slate-200 hover:bg-indigo-600 hover:text-white text-slate-600 px-4 py-2 rounded-xl text-[10px] font-black transition-all"
                            >
                              ✏️ تعديل الفاتورة
                            </Link>
                            {t.description && (
                              <p className="text-xs text-slate-400 font-bold italic">{t.description}</p>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-slate-400 font-bold text-sm text-center py-4">
                          {t.description || "لا تفاصيل إضافية"}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
        body { font-family: 'Cairo', sans-serif; }
      `}</style>
    </div>
  );
}