"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthlyRow {
  month: string;
  total_revenue: number;
  total_profit: number;
  new_debt: number;
  collected: number;
  net_debt: number;
  expenses: number;
}

interface CustomerDebt {
  id: string;
  name: string;
  phone: string;
  balance: number;
  total_purchases: number;
  total_profit: number;
  last_tx: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS_AR = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

const SALE_TYPES    = ["sale", "بيع"];
const PAYMENT_TYPES = ["payment", "دفع", "تحصيل نقدي", "تحصيل"];

function fmt(n: number) {
  return n.toLocaleString("ar-EG", { maximumFractionDigits: 0 });
}
function monthLabel(iso: string) {
  const d = new Date(iso);
  return MONTHS_AR[d.getMonth()] + " " + d.getFullYear();
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ar-EG");
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function fetchMonthlyData(year: number): Promise<MonthlyRow[]> {
  const { data, error } = await supabase
    .from("customer_transactions")
    .select("created_at, amount, profit, type")
    .gte("created_at", `${year}-01-01`)
    .lte("created_at", `${year}-12-31`);

  if (error) throw error;

  const map = new Map<string, MonthlyRow>();
  for (const row of data ?? []) {
    const d   = new Date(row.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    if (!map.has(key)) map.set(key, { month: key, total_revenue: 0, total_profit: 0, new_debt: 0, collected: 0, net_debt: 0, expenses: 0 });
    const m = map.get(key)!;
    const t = row.type as string;
    if (SALE_TYPES.includes(t)) {
      m.total_revenue += Number(row.amount) || 0;
      m.total_profit  += Number(row.profit)  || 0;
    } else if (PAYMENT_TYPES.includes(t)) {
      m.collected += Number(row.amount) || 0;
    } else {
      m.new_debt  += Number(row.amount) || 0;
    }
  }
  for (const m of map.values()) {
    m.net_debt = m.new_debt - m.collected;
    m.expenses = m.total_revenue - m.total_profit;
  }
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

async function fetchCustomers(): Promise<CustomerDebt[]> {
  const { data: customers, error } = await supabase
    .from("customers").select("id, name, phone, balance").order("balance", { ascending: false });
  if (error) throw error;

  const { data: txAgg } = await supabase
    .from("customer_transactions").select("customer_id, amount, profit, type, created_at");

  const agg = new Map<string, { purchases: number; profit: number; last: string | null }>();
  for (const tx of txAgg ?? []) {
    const cid = tx.customer_id;
    if (!agg.has(cid)) agg.set(cid, { purchases: 0, profit: 0, last: null });
    const a = agg.get(cid)!;
    if (SALE_TYPES.includes(tx.type)) {
      a.purchases += Number(tx.amount) || 0;
      a.profit    += Number(tx.profit) || 0;
    }
    if (!a.last || tx.created_at > a.last) a.last = tx.created_at;
  }

  return (customers ?? []).map((c) => {
    const a = agg.get(c.id) ?? { purchases: 0, profit: 0, last: null };
    return { id: c.id, name: c.name, phone: c.phone, balance: Number(c.balance) || 0, total_purchases: a.purchases, total_profit: a.profit, last_tx: a.last };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [year, setYear]           = useState(new Date().getFullYear());
  const [monthly, setMonthly]     = useState<MonthlyRow[]>([]);
  const [customers, setCustomers] = useState<CustomerDebt[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"monthly" | "customers" | "insights">("monthly");
  const [searchCust, setSearchCust] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [m, c] = await Promise.all([fetchMonthlyData(year), fetchCustomers()]);
      setMonthly(m); setCustomers(c);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطأ في تحميل البيانات");
    } finally { setLoading(false); }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  // ─── Aggregates ───────────────────────────────────────────────────────────
  const totalRevenue   = monthly.reduce((s, r) => s + r.total_revenue, 0);
  const totalProfit    = monthly.reduce((s, r) => s + r.total_profit, 0);
  const totalCollected = monthly.reduce((s, r) => s + r.collected, 0);
  const totalNewDebt   = monthly.reduce((s, r) => s + r.new_debt, 0);
  const totalDebt      = customers.reduce((s, c) => s + Math.max(c.balance, 0), 0);
  const debtorCount    = customers.filter(c => c.balance > 0).length;
  const profitMargin   = totalRevenue ? Math.round((totalProfit / totalRevenue) * 100) : 0;
  const collectRate    = totalNewDebt > 0 ? Math.min(Math.round((totalCollected / totalNewDebt) * 100), 100) : 0;

  const bestMonth  = monthly.length ? monthly.reduce((a, b) => b.total_profit > a.total_profit ? b : a) : null;
  const topDebtor  = customers.filter(c => c.balance > 0).sort((a, b) => b.balance - a.balance)[0] || null;
  const topCustomer = [...customers].sort((a, b) => b.total_profit - a.total_profit)[0] || null;

  const years = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);
  const filteredCustomers = customers.filter(c => c.name.includes(searchCust) || c.phone.includes(searchCust));

  const tabs = [
    { key: "monthly",   label: "📅 الشهري" },
    { key: "customers", label: "👥 العملاء" },
    { key: "insights",  label: "💡 تحليلات" },
  ] as const;

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-right font-sans text-slate-900 pb-16" dir="rtl">

      {/* ══ Header ══ */}
      <header className="bg-[#0f172a] text-white p-6 shadow-xl mb-8 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-xs font-black transition-all">
              ⬅️ الرئيسية
            </Link>
            <div>
              <h1 className="text-xl font-black">📊 مراقبة الأرباح والديون</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">التقارير المالية الشهرية</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="bg-white/10 border border-white/20 text-white px-4 py-2 rounded-xl font-black text-sm outline-none cursor-pointer"
            >
              {years.map(y => <option key={y} value={y} className="bg-[#0f172a]">{y}</option>)}
            </select>
            <button
              onClick={load}
              className="bg-emerald-500 hover:bg-emerald-400 px-5 py-2 rounded-xl font-black text-sm transition-all active:scale-95"
            >
              🔄 تحديث
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 space-y-6">

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-4 font-bold text-sm">
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-[2.5rem] p-20 text-center border border-slate-200 shadow-sm">
            <p className="text-slate-400 font-black text-lg animate-pulse">⏳ جاري تحميل البيانات...</p>
          </div>
        ) : (
          <>
            {/* ══ KPI Cards ══ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard emoji="💰" label="إجمالي الإيرادات"  value={fmt(totalRevenue)}   sub="ج.م" color="slate" />
              <KpiCard emoji="📈" label="صافي الربح"        value={fmt(totalProfit)}    sub={`هامش ${profitMargin}%`} color="emerald" />
              <KpiCard emoji="🔴" label="إجمالي الديون"     value={fmt(totalDebt)}      sub={`${debtorCount} عميل مدين`} color="rose" />
              <KpiCard emoji="✅" label="إجمالي التحصيل"   value={fmt(totalCollected)} sub={`نسبة ${collectRate}% من الديون`} color="indigo" />
            </div>

            {/* ══ Highlight Cards ══ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-[#0f172a] to-indigo-900 text-white p-6 rounded-[2rem] shadow-lg">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-2">🏆 أفضل شهر</p>
                <p className="text-2xl font-black">{bestMonth ? monthLabel(bestMonth.month) : "—"}</p>
                <p className="text-emerald-400 font-black text-lg mt-1">
                  {bestMonth ? `ربح: ${fmt(bestMonth.total_profit)} ج.م` : "لا بيانات"}
                </p>
              </div>
              <div className="bg-gradient-to-br from-rose-600 to-rose-800 text-white p-6 rounded-[2rem] shadow-lg">
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-200 mb-2">⚠️ أعلى مدين</p>
                <p className="text-2xl font-black truncate">{topDebtor ? topDebtor.name : "لا يوجد"}</p>
                <p className="text-rose-200 font-black text-lg mt-1">
                  {topDebtor ? `${fmt(topDebtor.balance)} ج.م` : "الكل سدّد ✅"}
                </p>
              </div>
              <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-6 rounded-[2rem] shadow-lg">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200 mb-2">⭐ أكثر عميل ربحية</p>
                <p className="text-2xl font-black truncate">{topCustomer ? topCustomer.name : "—"}</p>
                <p className="text-emerald-200 font-black text-lg mt-1">
                  {topCustomer ? `ربح: ${fmt(topCustomer.total_profit)} ج.م` : ""}
                </p>
              </div>
            </div>

            {/* ══ Progress Bar تحصيل ══ */}
            {totalNewDebt > 0 && (
              <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6">
                <div className="flex justify-between items-center mb-3">
                  <p className="font-black text-slate-900">نسبة التحصيل من الديون الجديدة</p>
                  <p className="font-black text-indigo-600 text-xl">{collectRate}%</p>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-4 rounded-full transition-all duration-700"
                    style={{ width: `${collectRate}%`, background: collectRate >= 100 ? '#10b981' : '#6366f1' }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-black text-slate-400 mt-2">
                  <span>تم تحصيل {fmt(totalCollected)} ج.م</span>
                  <span>من أصل {fmt(totalNewDebt)} ج.م</span>
                </div>
              </div>
            )}

            {/* ══ Tabs ══ */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm p-2 flex gap-2">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex-1 py-3 rounded-xl font-black text-sm transition-all ${
                    activeTab === t.key
                      ? "bg-[#0f172a] text-white shadow-md"
                      : "text-slate-400 hover:bg-slate-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* ══════════════ TAB: الشهري ══════════════ */}
            {activeTab === "monthly" && (
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h2 className="font-black text-slate-900 text-lg">الملخص الشهري التفصيلي — {year}</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">كل الأرقام بالجنيه المصري</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                      <tr>
                        {["الشهر","الإيرادات","تكلفة البضاعة","صافي الربح","ديون جديدة","تحصيلات","صافي الديون","الحالة"].map(h => (
                          <th key={h} className="p-5 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {monthly.length === 0 && (
                        <tr><td colSpan={8} className="p-16 text-center text-slate-300 font-black">📭 لا توجد بيانات لهذه السنة</td></tr>
                      )}
                      {monthly.map((r) => {
                        const margin      = r.total_revenue > 0 ? Math.round((r.total_profit / r.total_revenue) * 100) : 0;
                        const isGoodMonth = r.total_profit > 15000;
                        const isMidMonth  = r.total_profit > 6000;
                        return (
                          <tr key={r.month} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-5 font-black text-slate-900 whitespace-nowrap">{monthLabel(r.month)}</td>
                            <td className="p-5 font-bold text-slate-700 whitespace-nowrap">{fmt(r.total_revenue)} ج</td>
                            <td className="p-5 font-bold text-rose-500 whitespace-nowrap">{fmt(r.expenses)} ج</td>
                            <td className="p-5 whitespace-nowrap">
                              <span className="font-black text-emerald-600">{fmt(r.total_profit)} ج</span>
                              <span className="text-[9px] text-slate-400 font-black block">{margin}% هامش</span>
                            </td>
                            <td className="p-5 font-bold text-slate-700 whitespace-nowrap">{fmt(r.new_debt)} ج</td>
                            <td className="p-5 font-bold text-emerald-600 whitespace-nowrap">{fmt(r.collected)} ج</td>
                            <td className={`p-5 font-black whitespace-nowrap ${r.net_debt > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                              {r.net_debt > 0 ? "+" : ""}{fmt(r.net_debt)} ج
                            </td>
                            <td className="p-5">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                                isGoodMonth ? "bg-emerald-100 text-emerald-700" :
                                isMidMonth  ? "bg-amber-100 text-amber-700"    :
                                              "bg-rose-100 text-rose-600"
                              }`}>
                                {isGoodMonth ? "ممتاز 🌟" : isMidMonth ? "جيد 👍" : "ضعيف ⚠️"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {monthly.length > 0 && (
                      <tfoot className="bg-[#0f172a] text-white text-sm">
                        <tr>
                          <td className="p-5 font-black">الإجمالي السنوي</td>
                          <td className="p-5 font-black">{fmt(totalRevenue)} ج</td>
                          <td className="p-5 font-black text-rose-300">{fmt(monthly.reduce((s,r)=>s+r.expenses,0))} ج</td>
                          <td className="p-5 font-black text-emerald-400">{fmt(totalProfit)} ج</td>
                          <td className="p-5 font-black">{fmt(totalNewDebt)} ج</td>
                          <td className="p-5 font-black text-emerald-400">{fmt(totalCollected)} ج</td>
                          <td className={`p-5 font-black ${totalNewDebt > totalCollected ? "text-rose-400" : "text-emerald-400"}`}>
                            {fmt(totalNewDebt - totalCollected)} ج
                          </td>
                          <td className="p-5 font-black text-slate-400">—</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* ══════════════ TAB: العملاء ══════════════ */}
            {activeTab === "customers" && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm">
                  <input
                    placeholder="🔍 ابحث عن عميل بالاسم أو الموبايل..."
                    className="w-full p-4 bg-slate-50 rounded-xl font-bold text-slate-900 outline-none text-sm"
                    value={searchCust}
                    onChange={e => setSearchCust(e.target.value)}
                  />
                </div>
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="font-black text-slate-900 text-lg">تفاصيل العملاء — الديون والأرباح</h2>
                    <span className="text-xs font-black text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
                      {filteredCustomers.length} عميل
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                        <tr>
                          {["العميل","الموبايل","إجمالي المشتريات","إجمالي الأرباح","الدين الحالي","آخر معاملة","الحالة",""].map(h => (
                            <th key={h} className="p-5 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredCustomers.length === 0 && (
                          <tr><td colSpan={8} className="p-16 text-center text-slate-300 font-black">لا توجد نتائج</td></tr>
                        )}
                        {filteredCustomers.sort((a,b) => b.balance - a.balance).map((c) => {
                          const debt = Math.max(c.balance, 0);
                          return (
                            <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-5 font-black text-slate-900 whitespace-nowrap">{c.name}</td>
                              <td className="p-5 text-slate-400 font-bold text-sm whitespace-nowrap">{c.phone || "—"}</td>
                              <td className="p-5 font-bold text-slate-700 whitespace-nowrap">{fmt(c.total_purchases)} ج</td>
                              <td className="p-5 font-black text-emerald-600 whitespace-nowrap">{fmt(c.total_profit)} ج</td>
                              <td className={`p-5 font-black whitespace-nowrap text-2xl ${debt > 0 ? "text-rose-600" : "text-slate-200"}`}>
                                {debt > 0 ? `${fmt(debt)} ج` : "—"}
                              </td>
                              <td className="p-5 text-slate-400 font-bold text-sm whitespace-nowrap">{fmtDate(c.last_tx)}</td>
                              <td className="p-5 whitespace-nowrap">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                                  debt === 0   ? "bg-emerald-100 text-emerald-700" :
                                  debt > 10000 ? "bg-rose-100 text-rose-600"       :
                                                 "bg-amber-100 text-amber-700"
                                }`}>
                                  {debt === 0 ? "سدّد ✅" : debt > 10000 ? "دين مرتفع 🔴" : "دين متوسط 🟡"}
                                </span>
                              </td>
                              <td className="p-5">
                                <Link
                                  href={`/customer/${c.id}/history`}
                                  className="bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-600 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all"
                                >
                                  📂 السجل
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════ TAB: تحليلات ══════════════ */}
            {activeTab === "insights" && (
              <div className="space-y-4">

                {/* توزيع الديون */}
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-6">
                  <h3 className="font-black text-slate-900 text-lg mb-1">🔴 توزيع الديون على العملاء</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-5">مرتّب من الأعلى للأقل</p>
                  <div className="space-y-4">
                    {customers.filter(c => c.balance > 0).sort((a,b) => b.balance - a.balance).slice(0,8).map((c, i) => {
                      const pct = totalDebt > 0 ? (c.balance / totalDebt) * 100 : 0;
                      return (
                        <div key={c.id}>
                          <div className="flex justify-between items-center mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-300 w-5">#{i+1}</span>
                              <span className="font-black text-slate-900">{c.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black text-slate-400">{Math.round(pct)}%</span>
                              <span className="font-black text-rose-600">{fmt(c.balance)} ج</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                            <div className="h-3 rounded-full bg-rose-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {customers.filter(c => c.balance > 0).length === 0 && (
                      <p className="text-center text-slate-300 font-black py-8 text-2xl">🎉 لا يوجد عملاء مدينون!</p>
                    )}
                  </div>
                </div>

                {/* أفضل 5 عملاء */}
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-6">
                  <h3 className="font-black text-slate-900 text-lg mb-1">⭐ أفضل 5 عملاء ربحية</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-5">إجمالي الأرباح المحققة</p>
                  <div className="space-y-4">
                    {[...customers].sort((a,b) => b.total_profit - a.total_profit).slice(0,5).map((c, i) => {
                      const medals = ["🥇","🥈","🥉","4️⃣","5️⃣"];
                      const maxProfit = Math.max(...customers.map(x => x.total_profit), 1);
                      const pct = (c.total_profit / maxProfit) * 100;
                      return (
                        <div key={c.id} className="flex items-center gap-4">
                          <span className="text-2xl w-8 text-center">{medals[i]}</span>
                          <div className="flex-1">
                            <div className="flex justify-between mb-1.5">
                              <span className="font-black text-slate-900">{c.name}</span>
                              <span className="font-black text-emerald-600">{fmt(c.total_profit)} ج</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                              <div className="h-2.5 rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ملاحظات ذكية */}
                <div className="bg-[#0f172a] rounded-[2.5rem] p-6 text-white">
                  <h3 className="font-black text-xl mb-5">🤖 ملاحظات مالية تلقائية</h3>
                  <div className="space-y-3">
                    {profitMargin < 10 && (
                      <Alert type="warn" text={`هامش الربح ${profitMargin}% منخفض — راجع أسعار البيع أو تكلفة الشراء.`} />
                    )}
                    {profitMargin >= 20 && (
                      <Alert type="good" text={`ممتاز! هامش الربح ${profitMargin}% — الأسعار متوازنة وصحية.`} />
                    )}
                    {debtorCount > 5 && (
                      <Alert type="warn" text={`عندك ${debtorCount} عملاء مدينين — فكّر في جدولة التحصيل.`} />
                    )}
                    {collectRate >= 80 && (
                      <Alert type="good" text={`نسبة التحصيل ${collectRate}% — أداء تحصيل قوي! 💪`} />
                    )}
                    {collectRate < 50 && totalNewDebt > 0 && (
                      <Alert type="warn" text={`نسبة التحصيل ${collectRate}% فقط — الديون بتتراكم، اتحرك الأول!`} />
                    )}
                    {bestMonth && (
                      <Alert type="info" text={`أفضل شهر: ${monthLabel(bestMonth.month)} بربح ${fmt(bestMonth.total_profit)} ج — حاول تكرر نفس النشاط.`} />
                    )}
                    {topDebtor && topDebtor.balance > 20000 && (
                      <Alert type="warn" text={`${topDebtor.name} عنده دين ${fmt(topDebtor.balance)} ج — يستاهل متابعة عاجلة.`} />
                    )}
                    {monthly.length === 0 && (
                      <Alert type="info" text="لا توجد بيانات كافية لتوليد ملاحظات." />
                    )}
                  </div>
                </div>

              </div>
            )}
          </>
        )}
      </main>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
        body { font-family: 'Cairo', sans-serif; }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ emoji, label, value, sub, color }: {
  emoji: string; label: string; value: string; sub: string;
  color: "slate" | "emerald" | "rose" | "indigo";
}) {
  const colors = {
    slate:   "bg-[#0f172a] text-white",
    emerald: "bg-emerald-500 text-white",
    rose:    "bg-rose-500 text-white",
    indigo:  "bg-indigo-600 text-white",
  };
  return (
    <div className={`${colors[color]} rounded-[2rem] p-6 shadow-lg`}>
      <p className="text-2xl mb-2">{emoji}</p>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-black">{value} <small className="text-sm font-normal opacity-60">ج.م</small></p>
      <p className="text-[10px] font-bold opacity-60 mt-1">{sub}</p>
    </div>
  );
}

function Alert({ type, text }: { type: "warn" | "good" | "info"; text: string }) {
  const styles = {
    warn: "bg-amber-500/20 border-amber-400/50 text-amber-300",
    good: "bg-emerald-500/20 border-emerald-400/50 text-emerald-300",
    info: "bg-indigo-500/20 border-indigo-400/50 text-indigo-300",
  };
  const icons = { warn: "⚠️", good: "✅", info: "💡" };
  return (
    <div className={`${styles[type]} border rounded-2xl p-4 text-sm font-bold flex items-start gap-3`}>
      <span className="text-base mt-0.5 shrink-0">{icons[type]}</span>
      <span>{text}</span>
    </div>
  );
}