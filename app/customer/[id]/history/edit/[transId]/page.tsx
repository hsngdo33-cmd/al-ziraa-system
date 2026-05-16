"use client";
import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function EditInvoicePage({ params }: { params: Promise<any> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const customerId = resolvedParams.id;
  const transId = resolvedParams.transId;

  const [transaction, setTransaction] = useState<any>(null); // لحفظ البيانات الأصلية من الداتا بيز
  const [items, setItems] = useState<any[]>([]); // لتعديل البيانات في الشاشة
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (transId) loadTransaction();
  }, [transId]);

  async function loadTransaction() {
    setLoading(true);
    const { data, error } = await supabase
      .from("customer_transactions")
      .select("*")
      .eq("id", transId)
      .single();

    if (error) {
      alert("مشكلة في تحميل بيانات الفاتورة");
    } else {
      // بنعمل "نسخة عميقة" من البيانات عشان نضمن إن القديم ميتأثرش بتعديلاتك في الشاشة
      setTransaction(JSON.parse(JSON.stringify(data))); 
      setItems(JSON.parse(JSON.stringify(data.items || [])));
    }
    setLoading(false);
  }

  const handleUpdate = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // 1. حساب الإجمالي الجديد من الـ state (الأرقام اللي في الـ inputs حالياً)
      const newTotal = items.reduce((acc, i) => acc + (Number(i.qty) * Number(i.price)), 0);
      const diff = newTotal - transaction.amount;

      console.log("--- بداية عملية تحديث المخزن ---");

      // 2. إرجاع الكميات القديمة (بنجيبها من الـ transaction الأصلي اللي حملناه أول مرة)
      for (const old of transaction.items) {
        if (old.id) {
          console.log(`إرجاع صنف: ${old.name} | الكمية القديمة: ${old.qty}`);
          await supabase.rpc('increment_stock', { 
            row_id: String(old.id), 
            amount: Number(old.qty) 
          });
        }
      }

      // 3. خصم الكميات الجديدة (اللي إنت كتبتها في الـ inputs دلوقتى)
      for (const newItem of items) {
        if (newItem.id) {
          console.log(`خصم صنف: ${newItem.name} | الكمية الجديدة: ${newItem.qty}`);
          await supabase.rpc('decrement_stock', { 
            row_id: String(newItem.id), 
            amount: Number(newItem.qty) 
          });
        }
      }

      // 4. تحديث مديونية العميل
      const { data: currentCust } = await supabase.from("customers").select("balance").eq("id", customerId).single();
      const newBalance = (currentCust?.balance || 0) + diff;
      await supabase.from("customers").update({ balance: newBalance }).eq("id", customerId);

      // 5. تحديث سجل الفاتورة في الجدول
      await supabase.from("customer_transactions").update({
        amount: newTotal,
        items: items, // مصفوفة الأصناف الجديدة بالكامل
        description: `تم تعديل الفاتورة في: ${new Date().toLocaleString('ar-EG')}`
      }).eq("id", transId);

      console.log("--- تمت العملية بنجاح ---");
      alert("تم التعديل وتحديث المخزن بنجاح يا عمدة! ✅");
      router.push(`/customer/${customerId}/history`);
      
    } catch (err: any) {
      console.error("Error Detail:", err);
      alert("حصلت مشكلة أثناء التعديل، راجع الـ Console");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black text-slate-400">جاري تحميل الفاتورة...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 text-right font-sans" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* العنوان */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 flex justify-between items-center">
           <h2 className="text-xl font-black text-slate-900 border-r-4 border-indigo-600 pr-3">تعديل كميات الفاتورة 📝</h2>
           <button onClick={() => router.back()} className="text-slate-400 font-bold text-xs hover:text-rose-500 transition-colors">❌ إلغاء</button>
        </div>

        {/* الجدول */}
        <div className="bg-white rounded-[2rem] shadow-md border border-slate-200 overflow-hidden">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50 text-[11px] font-black text-slate-400 border-b">
              <tr>
                <th className="p-5 text-right">الصنف</th>
                <th className="p-5 text-center">الكمية</th>
                <th className="p-5 text-center">السعر</th>
                <th className="p-5 text-left">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50/50">
                  <td className="p-5">
                    <p className="font-black text-slate-900">{item.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.unit}</p>
                  </td>
                  <td className="p-5 text-center">
                    <input 
                      type="number"
                      value={item.qty}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index].qty = e.target.value;
                        setItems(newItems);
                      }}
                      className="w-20 p-2 border-2 border-slate-100 rounded-xl text-center font-black bg-slate-50 focus:border-indigo-500 outline-none transition-all"
                    />
                  </td>
                  <td className="p-5 text-center font-black text-indigo-600">
                    <input 
                      type="number"
                      value={item.price}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index].price = e.target.value;
                        setItems(newItems);
                      }}
                      className="w-24 p-2 border-2 border-slate-100 rounded-xl text-center font-black text-emerald-600 bg-slate-50 focus:border-emerald-500 outline-none transition-all"
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

        {/* شريط الحساب النهائي */}
        <div className="bg-[#0f172a] p-8 rounded-[2.5rem] text-white flex justify-between items-center shadow-2xl border-4 border-white">
          <div>
            <p className="text-[10px] text-slate-400 font-black mb-1 uppercase tracking-widest">إجمالي الحساب بعد التعديل</p>
            <h3 className="text-5xl font-black italic">
              {items.reduce((acc, i) => acc + (Number(i.qty) * Number(i.price)), 0).toLocaleString()} 
              <small className="text-xs mr-2">ج.م</small>
            </h3>
          </div>
          <button 
            onClick={handleUpdate}
            disabled={isSaving}
            className="bg-emerald-500 hover:bg-emerald-400 text-white px-10 py-5 rounded-2xl font-black text-xl shadow-xl transition-all active:scale-95 disabled:opacity-50"
          >
            {isSaving ? "جاري الحفظ..." : "حفظ التعديلات ✅"}
          </button>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
        body { font-family: 'Cairo', sans-serif; background-color: #f8fafc; }
      `}</style>
    </div>
  );
}