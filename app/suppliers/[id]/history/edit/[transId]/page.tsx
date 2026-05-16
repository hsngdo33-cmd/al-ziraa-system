"use client";
import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function EditSupplierInvoicePage({ params }: { params: Promise<any> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const supplierId = resolvedParams.id;
  const transId = resolvedParams.transId;

  const [transaction, setTransaction] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (transId) loadTransaction();
  }, [transId]);

  async function loadTransaction() {
    setLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transId)
      .single();

    if (data) {
      setTransaction(JSON.parse(JSON.stringify(data)));
      setItems(JSON.parse(JSON.stringify(data.items || [])));
    }
    setLoading(false);
  }

  const handleUpdate = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // 1. حساب الإجمالي الجديد والفرق
      const newTotal = items.reduce((acc, i) => acc + (Number(i.qty) * Number(i.price)), 0);
      const diff = newTotal - transaction.amount;

      // 2. معالجة المخزن (زي ما عملنا في الواردات بس للعكس)
      // أ- إرجاع المخزن لأصله (خصم الكميات القديمة اللي دخلت من المورد)
      for (const old of transaction.items) {
        if (old.id) {
          await supabase.rpc('decrement_stock', { 
            row_id: String(old.id), 
            amount: Number(old.qty) 
          });
        }
      }

      // ب- إضافة الكميات الجديدة المعدلة للمخزن
      for (const newItem of items) {
        if (newItem.id) {
          await supabase.rpc('increment_stock', { 
            row_id: String(newItem.id), 
            amount: Number(newItem.qty) 
          });
        }
      }

      // 3. تحديث مديونية المورد (Supplier Balance)
      const { data: supplier } = await supabase
        .from("suppliers")
        .select("balance")
        .eq("id", supplierId)
        .single();
      
      const updatedBalance = (supplier?.balance || 0) + diff;
      await supabase.from("suppliers").update({ balance: updatedBalance }).eq("id", supplierId);

      // 4. تحديث سجل الفاتورة نفسه
      const { error: finalError } = await supabase
        .from("transactions")
        .update({
          amount: newTotal,
          items: items,
          description: `تعديل فاتورة توريد - مخزن معدل`
        })
        .eq("id", transId);

      if (finalError) throw finalError;

      alert("تم التعديل وتحديث المخزن والمديونية بنجاح! ✅");
      router.push(`/suppliers/${supplierId}/history`);

    } catch (err: any) {
      console.error(err);
      alert("حدث خطأ أثناء التحديث");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-orange-600">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-[#f3f4f6] p-4 text-right font-sans" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-6">
        
        <div className="bg-white p-6 rounded-[2rem] shadow-sm flex justify-between items-center border border-slate-200">
           <h2 className="text-xl font-black text-slate-800">تعديل أصناف فاتورة المورد 🚚</h2>
           <button onClick={() => router.back()} className="text-slate-400 font-bold hover:text-rose-500 transition-all">إلغاء ❌</button>
        </div>

        <div className="bg-white rounded-[2rem] shadow-md border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 text-[11px] font-black text-slate-400 border-b uppercase tracking-widest">
              <tr>
                <th className="p-5 text-right">الصنف</th>
                <th className="p-5 text-center">الكمية</th>
                <th className="p-5 text-center">السعر</th>
                <th className="p-5 text-left">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50 transition-colors">
                  <td className="p-5 font-black text-slate-900">{item.name}</td>
                  <td className="p-5 text-center">
                    <input 
                      type="number"
                      value={item.qty}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index].qty = e.target.value;
                        setItems(newItems);
                      }}
                      className="w-20 p-2 border-2 border-slate-100 rounded-xl text-center font-black focus:border-orange-500 outline-none transition-all"
                    />
                  </td>
                  <td className="p-5 text-center font-black">
                    <input 
                      type="number"
                      value={item.price}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index].price = e.target.value;
                        setItems(newItems);
                      }}
                      className="w-24 p-2 border-2 border-slate-100 rounded-xl text-center font-black text-orange-600 focus:border-orange-500 outline-none transition-all"
                    />
                  </td>
                  <td className="p-5 text-left font-black text-slate-900">
                    {(Number(item.qty) * Number(item.price)).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex justify-between items-center shadow-2xl border-4 border-white">
          <div>
            <p className="text-[10px] text-slate-400 font-black mb-1 uppercase tracking-widest">إجمالي الحساب الجديد</p>
            <h3 className="text-4xl font-black italic">
              {items.reduce((acc, i) => acc + (Number(i.qty) * Number(i.price)), 0).toLocaleString()} 
              <small className="text-xs mr-2 opacity-50">ج.م</small>
            </h3>
          </div>
          <button 
            onClick={handleUpdate}
            disabled={isSaving}
            className="bg-orange-500 hover:bg-orange-400 text-white px-10 py-5 rounded-2xl font-black text-xl shadow-xl transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? "جاري الحفظ..." : "حفظ التعديلات ✅"}
          </button>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
        body { font-family: 'Cairo', sans-serif; }
      `}</style>
    </div>
  );
}