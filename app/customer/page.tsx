"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function CustomersListPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", balance: 0 });
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payNote, setPayNote] = useState("");

  useEffect(() => { fetchCustomers(); }, []);

  async function fetchCustomers() {
    setLoading(true);
    const { data } = await supabase.from("customers").select("*").order("name");
    setCustomers(data || []);
    setLoading(false);
  }

  // وظيفة إضافة عميل جديد
  async function handleAddCustomer() {
    if (!newCustomer.name) return alert("الاسم مطلوب!");
    await supabase.from("customers").insert([newCustomer]);
    setShowAddModal(false);
    fetchCustomers();
  }

  // وظيفة التحصيل النقدي
  async function handleCollection() {
    if (payAmount <= 0) return alert("ادخل مبلغ صحيح");
    
    try {
      // 1. تسجيل العملية في جدول المعاملات
      await supabase.from("customer_transactions").insert([{
        customer_id: selectedCustomer.id,
        amount: payAmount,
        type: "تحصيل نقدي",
        description: payNote || "تحصيل نقدي من العميل"
      }]);

      // 2. تحديث مديونية العميل (خصم المبلغ من الحساب)
      const { error } = await supabase.from("customers")
        .update({ balance: (selectedCustomer.balance || 0) - payAmount })
        .eq("id", selectedCustomer.id);

      if (!error) {
        alert(`تم تحصيل ${payAmount} ج.م من ${selectedCustomer.name} ✅`);
        setShowPayModal(false);
        setPayAmount(0);
        setPayNote("");
        fetchCustomers();
      }
    } catch (e) { alert("حدث خطأ في التحصيل"); }
  }

  const filtered = customers.filter(c => c.name.includes(searchTerm));

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-right font-sans text-slate-900 pb-10" dir="rtl">
      
      <header className="bg-[#0f172a] text-white p-6 shadow-lg mb-8">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/" className="bg-white/10 px-4 py-2 rounded-xl text-xs font-black">⬅️ الرئيسية</Link>
            <h1 className="text-xl font-black">دليل العملاء 👥</h1>
          </div>
          <button onClick={() => setShowAddModal(true)} className="bg-emerald-500 px-6 py-3 rounded-xl font-black text-sm">➕ إضافة عميل</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm mb-6 border border-slate-200">
          <input 
            placeholder="🔍 ابحث عن عميل..." 
            className="w-full p-4 bg-slate-50 rounded-xl font-black text-slate-900 outline-none"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-right">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
              <tr>
                <th className="p-6">العميل</th>
                <th className="p-6">المديونية</th>
                <th className="p-6 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50 transition-all">
                  <td className="p-6 font-black text-lg text-slate-900">{c.name}</td>
                  <td className="p-6 text-2xl font-black text-rose-600">{c.balance?.toLocaleString()} <small className="text-xs font-normal text-slate-400">ج.م</small></td>
                  <td className="p-6">
                    <div className="flex justify-center gap-2">
                      {/* زرار التحصيل الجديد */}
                      <button 
                        onClick={() => { setSelectedCustomer(c); setShowPayModal(true); }}
                        className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-black text-xs shadow-md hover:bg-emerald-600"
                      >
                        💰 تحصيل نقدي
                      </button>
                      <Link href={`/customer/${c.id}`} className="bg-[#0f172a] text-white px-4 py-2 rounded-xl font-black text-xs hover:bg-indigo-600">🧾 بيع</Link>
                      <Link href={`/customer/${c.id}/history`} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-black text-xs hover:bg-slate-200">📂 سجل</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* مودال التحصيل النقدي */}
      {showPayModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-black text-slate-900 mb-6 border-r-4 border-emerald-500 pr-3">تحصيل مبلغ من: {selectedCustomer?.name}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-400">المبلغ المدفوع</label>
                <input 
                  type="number"
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-2xl text-emerald-600 outline-none"
                  placeholder="0.00"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-400">ملاحظة (اختياري)</label>
                <input 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-900 outline-none"
                  placeholder="مثال: دفعة تحت الحساب"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={handleCollection} className="flex-1 bg-emerald-500 text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-emerald-600">تأكيد التحصيل ✅</button>
                <button onClick={() => setShowPayModal(false)} className="px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black">إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مودال إضافة عميل (نفسه القديم) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl space-y-6">
            <h3 className="text-xl font-black text-slate-900 border-r-4 border-indigo-500 pr-3">تسجيل عميل جديد</h3>
            <div className="space-y-4">
              <input className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-slate-900 outline-none" placeholder="الاسم" onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})} />
              <input className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-slate-900 outline-none" placeholder="الموبايل" onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})} />
              <input type="number" className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-rose-600 outline-none" placeholder="مديونية قديمة" onChange={(e) => setNewCustomer({...newCustomer, balance: Number(e.target.value)})} />
            </div>
            <div className="flex gap-3">
              <button onClick={handleAddCustomer} className="flex-1 bg-[#0f172a] text-white py-4 rounded-2xl font-black">حفظ ✅</button>
              <button onClick={() => setShowAddModal(false)} className="px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
        body { font-family: 'Cairo', sans-serif; }
      `}</style>
    </div>
  );
}