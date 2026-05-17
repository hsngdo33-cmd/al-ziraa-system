"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Customer {
  id: string;
  name: string;
  phone: string;
  balance: number;
  created_at: string;
}

type SortKey = "name" | "balance" | "created_at";
type FilterKey = "all" | "debtors" | "clear";

// ─── Component ────────────────────────────────────────────────────────────────
export default function CustomersListPage() {
  const [customers, setCustomers]         = useState<Customer[]>([]);
  const [loading, setLoading]             = useState(true);
  const [searchTerm, setSearchTerm]       = useState("");
  const [sortBy, setSortBy]               = useState<SortKey>("name");
  const [filter, setFilter]               = useState<FilterKey>("all");
  const [showAddModal, setShowAddModal]   = useState(false);
  const [showPayModal, setShowPayModal]   = useState(false);
  const [showDelConfirm, setShowDelConfirm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer]     = useState({ name: "", phone: "", balance: 0 });
  const [payAmount, setPayAmount]         = useState(0);
  const [payNote, setPayNote]             = useState("");
  const [saving, setSaving]               = useState(false);

  useEffect(() => { fetchCustomers(); }, []);

  async function fetchCustomers() {
    setLoading(true);
    const { data } = await supabase.from("customers").select("*").order("name");
    setCustomers(data || []);
    setLoading(false);
  }

  async function handleAddCustomer() {
    if (!newCustomer.name.trim()) return alert("الاسم مطلوب!");
    setSaving(true);
    await supabase.from("customers").insert([newCustomer]);
    setNewCustomer({ name: "", phone: "", balance: 0 });
    setShowAddModal(false);
    setSaving(false);
    fetchCustomers();
  }

  async function handleCollection() {
    if (payAmount <= 0 || !selectedCustomer) return alert("ادخل مبلغ صحيح");
    setSaving(true);
    try {
      await supabase.from("customer_transactions").insert([{
        customer_id: selectedCustomer.id,
        amount: payAmount,
        type: "تحصيل نقدي",
        description: payNote || "تحصيل نقدي من العميل",
      }]);
      await supabase.from("customers")
        .update({ balance: (selectedCustomer.balance || 0) - payAmount })
        .eq("id", selectedCustomer.id);
      setShowPayModal(false);
      setPayAmount(0);
      setPayNote("");
      fetchCustomers();
    } catch { alert("حدث خطأ"); }
    finally { setSaving(false); }
  }

  // فلترة وترتيب
  const displayed = useMemo(() => {
    let list = [...customers];
    if (searchTerm) list = list.filter(c => c.name.includes(searchTerm) || c.phone?.includes(searchTerm));
    if (filter === "debtors") list = list.filter(c => c.balance > 0);
    if (filter === "clear")   list = list.filter(c => c.balance <= 0);
    list.sort((a, b) => {
      if (sortBy === "balance")    return b.balance - a.balance;
      if (sortBy === "created_at") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return a.name.localeCompare(b.name, "ar");
    });
    return list;
  }, [customers, searchTerm, sortBy, filter]);

  const totalDebt   = customers.reduce((s, c) => s + Math.max(c.balance, 0), 0);
  const debtorCount = customers.filter(c => c.balance > 0).length;
  const clearCount  = customers.filter(c => c.balance <= 0).length;

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-right font-sans text-slate-900 pb-10" dir="rtl">

      {/* ══ Header ══ */}
      <header className="bg-[#0f172a] text-white p-6 shadow-xl mb-8 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-xs font-black transition-all">⬅️ الرئيسية</Link>
            <div>
              <h1 className="text-xl font-black">دليل العملاء 👥</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{customers.length} عميل مسجل</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-500 hover:bg-emerald-400 px-6 py-3 rounded-xl font-black text-sm transition-all active:scale-95 shadow-lg shadow-emerald-900/30"
          >
            ➕ إضافة عميل
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 space-y-5">

        {/* ══ Summary Cards ══ */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#0f172a] text-white p-5 rounded-[2rem] shadow-lg">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">إجمالي الديون</p>
            <p className="text-3xl font-black">{totalDebt.toLocaleString("ar-EG")}</p>
            <p className="text-xs text-slate-500 font-bold mt-1">جنيه مصري</p>
          </div>
          <div
            onClick={() => setFilter(filter === "debtors" ? "all" : "debtors")}
            className={`p-5 rounded-[2rem] shadow-sm cursor-pointer transition-all border-2 ${filter === "debtors" ? "bg-rose-500 text-white border-rose-500" : "bg-white border-slate-200 hover:border-rose-300"}`}
          >
            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${filter === "debtors" ? "text-rose-100" : "text-slate-400"}`}>عملاء مدينون</p>
            <p className="text-3xl font-black">{debtorCount}</p>
            <p className={`text-xs font-bold mt-1 ${filter === "debtors" ? "text-rose-100" : "text-slate-400"}`}>اضغط للتصفية</p>
          </div>
          <div
            onClick={() => setFilter(filter === "clear" ? "all" : "clear")}
            className={`p-5 rounded-[2rem] shadow-sm cursor-pointer transition-all border-2 ${filter === "clear" ? "bg-emerald-500 text-white border-emerald-500" : "bg-white border-slate-200 hover:border-emerald-300"}`}
          >
            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${filter === "clear" ? "text-emerald-100" : "text-slate-400"}`}>حساب سليم</p>
            <p className="text-3xl font-black">{clearCount}</p>
            <p className={`text-xs font-bold mt-1 ${filter === "clear" ? "text-emerald-100" : "text-slate-400"}`}>اضغط للتصفية</p>
          </div>
        </div>

        {/* ══ Search & Sort ══ */}
        <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm flex gap-3 flex-wrap items-center">
          <input
            placeholder="🔍 ابحث بالاسم أو الموبايل..."
            className="flex-1 min-w-[200px] p-3 bg-slate-50 rounded-xl font-bold text-slate-900 outline-none text-sm focus:ring-2 ring-indigo-200 transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <div className="flex gap-2">
            {(["name","balance","created_at"] as SortKey[]).map(k => (
              <button
                key={k}
                onClick={() => setSortBy(k)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${sortBy === k ? "bg-[#0f172a] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
              >
                {k === "name" ? "الاسم" : k === "balance" ? "الدين" : "الأحدث"}
              </button>
            ))}
          </div>
        </div>

        {/* ══ Table ══ */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-20 text-center text-slate-400 font-black animate-pulse">⏳ جاري التحميل...</div>
          ) : displayed.length === 0 ? (
            <div className="p-20 text-center text-slate-300">
              <p className="text-5xl mb-4">🔍</p>
              <p className="font-black">لا توجد نتائج</p>
            </div>
          ) : (
            <table className="w-full text-right">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="p-5">العميل</th>
                  <th className="p-5">الموبايل</th>
                  <th className="p-5">المديونية</th>
                  <th className="p-5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {displayed.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        {/* أفاتار نصي */}
                        <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 font-black text-sm flex items-center justify-center shrink-0">
                          {c.name.charAt(0)}
                        </div>
                        <span className="font-black text-slate-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="p-5 text-slate-400 font-bold text-sm">{c.phone || "—"}</td>
                    <td className="p-5">
                      {c.balance > 0 ? (
                        <span className="text-xl font-black text-rose-600">
                          {c.balance.toLocaleString("ar-EG")} <small className="text-xs font-normal text-slate-400">ج.م</small>
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-black">سدّد ✅</span>
                      )}
                    </td>
                    <td className="p-5">
                      <div className="flex justify-center gap-2 flex-wrap">
                        {c.balance > 0 && (
                          <button
                            onClick={() => { setSelectedCustomer(c); setPayAmount(0); setPayNote(""); setShowPayModal(true); }}
                            className="bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl font-black text-xs transition-all active:scale-95 shadow-md shadow-emerald-500/20"
                          >
                            💰 تحصيل
                          </button>
                        )}
                        <Link
                          href={`/customer/${c.id}`}
                          className="bg-[#0f172a] hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-black text-xs transition-all"
                        >
                          🧾 بيع
                        </Link>
                        <Link
                          href={`/customer/${c.id}/history`}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl font-black text-xs transition-all"
                        >
                          📂 سجل
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 font-bold pb-4">
          يعرض {displayed.length} من {customers.length} عميل
        </p>
      </main>

      {/* ══ Modal: تحصيل نقدي ══ */}
      {showPayModal && selectedCustomer && (
        <Modal onClose={() => setShowPayModal(false)}>
          <div className="border-r-4 border-emerald-500 pr-3 mb-6">
            <h3 className="text-xl font-black text-slate-900">تحصيل من: {selectedCustomer.name}</h3>
            <p className="text-xs text-slate-400 font-bold mt-1">
              المديونية الحالية: <span className="text-rose-600 font-black">{selectedCustomer.balance.toLocaleString("ar-EG")} ج.م</span>
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-black text-slate-400 mb-1 block">المبلغ المدفوع</label>
              <input
                type="number"
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-3xl text-emerald-600 outline-none focus:border-emerald-400 transition-all"
                placeholder="0"
                value={payAmount || ""}
                onChange={e => setPayAmount(Number(e.target.value))}
                autoFocus
              />
              {payAmount > 0 && (
                <p className="text-xs text-slate-400 font-bold mt-2">
                  المتبقي بعد السداد: <span className={`font-black ${selectedCustomer.balance - payAmount > 0 ? "text-rose-500" : "text-emerald-600"}`}>
                    {(selectedCustomer.balance - payAmount).toLocaleString("ar-EG")} ج.م
                  </span>
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-black text-slate-400 mb-1 block">ملاحظة (اختياري)</label>
              <input
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none text-sm"
                placeholder="مثال: دفعة تحت الحساب"
                value={payNote}
                onChange={e => setPayNote(e.target.value)}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCollection}
                disabled={saving || payAmount <= 0}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white py-4 rounded-2xl font-black text-lg transition-all active:scale-95 disabled:opacity-50"
              >
                {saving ? "جاري التحصيل..." : "تأكيد ✅"}
              </button>
              <button onClick={() => setShowPayModal(false)} className="px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-all">إلغاء</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ Modal: إضافة عميل ══ */}
      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)}>
          <div className="border-r-4 border-indigo-500 pr-3 mb-6">
            <h3 className="text-xl font-black text-slate-900">تسجيل عميل جديد</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-black text-slate-400 mb-1 block">الاسم *</label>
              <input
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:border-indigo-400 transition-all"
                placeholder="اسم العميل"
                value={newCustomer.name}
                onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-black text-slate-400 mb-1 block">الموبايل</label>
              <input
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:border-indigo-400 transition-all"
                placeholder="01xxxxxxxxx"
                value={newCustomer.phone}
                onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
              />
            </div>
            <div>
              <label className="text-xs font-black text-slate-400 mb-1 block">مديونية قديمة (لو موجودة)</label>
              <input
                type="number"
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-rose-600 outline-none focus:border-indigo-400 transition-all"
                placeholder="0"
                value={newCustomer.balance || ""}
                onChange={e => setNewCustomer({...newCustomer, balance: Number(e.target.value)})}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleAddCustomer}
                disabled={saving || !newCustomer.name.trim()}
                className="flex-1 bg-[#0f172a] hover:bg-indigo-700 text-white py-4 rounded-2xl font-black transition-all active:scale-95 disabled:opacity-50"
              >
                {saving ? "جاري الحفظ..." : "حفظ العميل ✅"}
              </button>
              <button onClick={() => setShowAddModal(false)} className="px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-all">إلغاء</button>
            </div>
          </div>
        </Modal>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
        body { font-family: 'Cairo', sans-serif; }
      `}</style>
    </div>
  );
}

// ─── Modal Wrapper ────────────────────────────────────────────────────────────
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}