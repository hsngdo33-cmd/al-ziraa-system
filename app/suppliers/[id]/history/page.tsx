"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function SupplierHistoryCards() {
  const { id } = useParams();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [supplier, setSupplier] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTrans, setSelectedTrans] = useState<any>(null);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { fetchHistory(); }, [id]);

  async function fetchHistory() {
    if (!id) return;
    setLoading(true);
    try {
      const { data: supp } = await supabase.from("suppliers").select("*").eq("id", id).single();
      setSupplier(supp);
      const { data: trans } = await supabase.from("transactions").select("*").eq("supplier_id", id).order("created_at", { ascending: false });
      setTransactions(trans || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  // دالة لفتح التعديل وجلب وحدات القياس للأصناف
  const openEditModal = async (trans: any) => {
    const itemsWithUnits = [...(trans.items || [])];
    
    // جلب وحدة القياس لكل صنف من جدول المنتجات
    for (let i = 0; i < itemsWithUnits.length; i++) {
      const { data: p } = await supabase.from("products").select("unit").eq("name", itemsWithUnits[i].name).maybeSingle();
      itemsWithUnits[i].unit = p?.unit || "وحدة";
    }

    setSelectedTrans(JSON.parse(JSON.stringify(trans)));
    setEditItems(itemsWithUnits);
    setIsModalOpen(true);
  };

  const handleModalSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const newTotal = editItems.reduce((acc, i) => acc + (Number(i.qty) * Number(i.price)), 0);
      const diff = newTotal - (selectedTrans.amount || 0);

      // 1. تحديث المخزن باستخدام RPC
      for (const old of selectedTrans.items) {
        const { data: prod } = await supabase.from("products").select("id").eq("name", old.name).maybeSingle();
        if (prod) await supabase.rpc('increment_stock', { row_id: prod.id, amount: -Number(old.qty) });
      }
      for (const newItem of editItems) {
        const { data: prod } = await supabase.from("products").select("id").eq("name", newItem.name).maybeSingle();
        if (prod) await supabase.rpc('increment_stock', { row_id: prod.id, amount: Number(newItem.qty) });
      }

      // 2. تحديث مديونية المورد
      const { data: currSupp } = await supabase.from("suppliers").select("balance").eq("id", id).single();
      await supabase.from("suppliers").update({ balance: (currSupp?.balance || 0) + diff }).eq("id", id);

      // 3. تحديث الفاتورة
      await supabase.from("transactions").update({
        amount: newTotal,
        items: editItems.map(({unit, ...rest}) => rest), // بنشيل الوحدة قبل الحفظ عشان نحافظ على شكل الداتا القديم
        description: `تعديل فاتورة - تحديث مخزن (${new Date().toLocaleDateString('ar-EG')})`
      }).eq("id", selectedTrans.id);

      alert("تم الحفظ بنجاح! ✅");
      setIsModalOpen(false);
      fetchHistory();
    } catch (err) { alert("حدث خطأ"); }
    finally { setIsSaving(false); }
  };

  if (loading) return <div className="h-screen flex items-center justify-center font-black text-blue-600 animate-pulse text-2xl">جاري تحميل السجل...</div>;

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-right font-sans pb-10" dir="rtl">
      <nav className="bg-white border-b px-6 py-5 mb-10 shadow-sm flex justify-between items-center sticky top-0 z-40">
        <Link href={`/suppliers/${id}`} className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg">⬅️</Link>
        <h1 className="text-2xl font-black text-slate-800 italic">سجل حساب: {supplier?.name}</h1>
        <div className="w-12"></div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {transactions.map((t) => (
          <div key={t.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 relative group hover:border-amber-200 transition-all">
            
            {(t.type?.includes('فاتورة') || t.type?.includes('توريد')) && t.items?.length > 0 && (
              <button onClick={() => openEditModal(t)} className="absolute top-6 left-6 bg-amber-50 text-amber-600 px-5 py-2 rounded-xl text-[10px] font-black hover:bg-amber-500 hover:text-white transition-all border border-amber-100 shadow-sm">
                ✏️ تعديل الفاتورة
              </button>
            )}

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${t.type?.includes('فاتورة') ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {t.type?.includes('فاتورة') ? '📦' : '💸'}
                </div>
                <div>
                  <div className="flex gap-3 mb-1 text-[10px] font-bold uppercase italic">
                     <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500">{t.type}</span>
                     <span className="text-slate-300">{new Date(t.created_at).toLocaleDateString('ar-EG')}</span>
                  </div>
                  <h4 className="font-black text-slate-800 text-lg leading-tight">{t.description || "معاملة تجارية"}</h4>
                </div>
              </div>
              <div className="text-left border-r pr-6 border-slate-50 min-w-[140px]">
                <p className="text-[10px] font-black text-slate-400 mb-1">المبلغ</p>
                <p className={`text-3xl font-black tracking-tighter ${t.type?.includes('فاتورة') ? 'text-slate-900' : 'text-emerald-600'}`}>
                  {t.amount?.toLocaleString()} <small className="text-xs mr-1">ج.م</small>
                </p>
              </div>
            </div>

            {t.items && (
              <div className="mt-6 pt-4 border-t border-dashed border-slate-100 flex flex-wrap gap-2">
                {t.items.map((item: any, i: number) => (
                  <span key={i} className="text-[11px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                    {item.name} <span className="text-amber-500 mx-1">x{item.qty}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-black text-slate-800 italic font-black">تعديل كميات الفاتورة 🚚</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 text-2xl hover:text-rose-500 transition-colors">✕</button>
            </div>
            
            <div className="p-8 max-h-[50vh] overflow-y-auto space-y-4">
              {editItems.map((item, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-4 bg-slate-50 p-5 rounded-3xl border border-slate-100 shadow-sm hover:bg-white transition-all">
                  <div className="flex-grow">
                    <p className="font-black text-slate-700 italic">{item.name}</p>
                    <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-lg mt-1">الوحدة: {item.unit}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase italic">الكمية:</label>
                    <input type="number" value={item.qty} onChange={(e) => {
                        const next = [...editItems]; next[idx].qty = e.target.value; setEditItems(next);
                    }} className="w-20 p-2 border-2 rounded-xl text-center font-black focus:border-amber-500 outline-none shadow-inner" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase italic">السعر:</label>
                    <input type="number" value={item.price} onChange={(e) => {
                        const next = [...editItems]; next[idx].price = e.target.value; setEditItems(next);
                    }} className="w-24 p-2 border-2 rounded-xl text-center font-black text-amber-600 focus:border-amber-500 outline-none shadow-inner" />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-8 bg-slate-900 text-white flex justify-between items-center border-t-8 border-amber-500 shadow-2xl">
              <div>
                <p className="text-[10px] text-slate-400 font-black mb-1 uppercase tracking-widest">إجمالي الفاتورة الجديد</p>
                <p className="text-4xl font-black text-amber-400 italic tracking-tighter">
                  {editItems.reduce((acc, i) => acc + (Number(i.qty) * Number(i.price)), 0).toLocaleString()} <small className="text-xs text-white/50 font-bold ml-1">ج.م</small>
                </p>
              </div>
              <button onClick={handleModalSave} disabled={isSaving} className="bg-amber-500 hover:bg-amber-400 px-12 py-5 rounded-2xl font-black text-xl shadow-xl transition-all active:scale-95 disabled:opacity-50">
                {isSaving ? "جاري الحفظ..." : "حفظ التعديلات ✅"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}