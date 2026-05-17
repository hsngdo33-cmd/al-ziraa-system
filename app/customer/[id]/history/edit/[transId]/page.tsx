"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function EditInvoicePage({ params }: { params: Promise<any> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const customerId = resolvedParams.id;
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
      .from("customer_transactions")
      .select("*")
      .eq("id", transId)
      .single();

    if (error) {
      alert("مشكلة في تحميل بيانات الفاتورة");
    } else {
      setTransaction(JSON.parse(JSON.stringify(data)));
      setItems(JSON.parse(JSON.stringify(data.items || [])));
    }
    setLoading(false);
  }

  const handleUpdate = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const newTotal = items.reduce((acc, i) => acc + (Number(i.qty) * Number(i.price)), 0);
      const diff = newTotal - transaction.amount;

      // ✅ إعادة حساب الربح بالأسعار الجديدة
      // cost محفوظ في كل item من وقت إنشاء الفاتورة الأصلية
      // لو الـ item القديم مالوش cost (فواتير قديمة قبل التعديل)، بنرجع لسعر الشراء من products
      const newTotalCost = await (async () => {
        let total = 0;
        for (const item of items) {
          if (item.cost !== undefined && item.cost !== null) {
            // ✅ استخدم الـ cost المحفوظ في الفاتورة
            total += Number(item.qty) * Number(item.cost);
          } else {
            // fallback: اجيب سعر الشراء من جدول products
            const { data: prod } = await supabase
              .from("products")
              .select("purchase_price")
              .eq("id", item.id)
              .single();
            total += Number(item.qty) * Number(prod?.purchase_price || 0);
          }
        }
        return total;
      })();

      const newProfit = newTotal - newTotalCost;

      // إرجاع الكميات القديمة
      for (const old of transaction.items) {
        if (old.id) {
          await supabase.rpc('increment_stock', {
            row_id: String(old.id),
            amount: Number(old.qty)
          });
        }
      }

      // خصم الكميات الجديدة
      for (const newItem of items) {
        if (newItem.id) {
          await supabase.rpc('decrement_stock', {
            row_id: String(newItem.id),
            amount: Number(newItem.qty)
          });
        }
      }

      // تحديث مديونية العميل
      const { data: currentCust } = await supabase.from("customers").select("balance").eq("id", customerId).single();
      const newBalance = (currentCust?.balance || 0) + diff;
      await supabase.from("customers").update({ balance: newBalance }).eq("id", customerId);

      // ✅ تحديث الفاتورة مع الـ profit الجديد
      await supabase.from("customer_transactions").update({
        amount: newTotal,
        items: items,
        profit: newProfit,   // ✅ ده كان ناقص في الكود القديم
        description: `تم تعديل الفاتورة في: ${new Date().toLocaleString('ar-EG')}`
      }).eq("id", transId);

      alert("تم التعديل بنجاح! ✅");
      router.push(`/customer/${customerId}/history`);

    } catch (err: any) {
      console.error("Error Detail:", err);
      alert("حصلت مشكلة أثناء التعديل، راجع الـ Console");
    } finally {
      setIsSaving(false);
    }
  };

  // حساب الربح المتوقع live في الشاشة
  const liveProfit = items.reduce((acc, i) => {
    const lineRevenue = Number(i.qty) * Number(i.price);
    const lineCost    = Number(i.qty) * Number(i.cost ?? 0);
    return acc + (lineRevenue - lineCost);
  }, 0);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center font-black text-slate-400">
      جاري تحميل الفاتورة...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 text-right font-sans" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* العنوان */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 flex justify-between items-center">
          <h2 className="text-xl font-black text-slate-900 border-r-4 border-indigo-600 pr-3">تعديل الفاتورة 📝</h2>
          <button onClick={() => router.back()} className="text-slate-400 font-bold text-xs hover:text-rose-500 transition-colors">❌ إلغاء</button>
        </div>

        {/* الجدول */}
        <div className="bg-white rounded-[2rem] shadow-md border border-slate-200 overflow-hidden">
          <table className="w-full border-collapse">
            <thead className="bg-slate-50 text-[11px] font-black text-slate-400 border-b">
              <tr>
                <th className="p-5 text-right">الصنف</th>
                <th className="p-5 text-center">الكمية</th>
                <th className="p-5 text-center">
                  السعر
                  <span className="text-[8px] text-indigo-400 block normal-case">قابل للتعديل</span>
                </th>
                <th className="p-5 text-center">ربح السطر</th>
                <th className="p-5 text-left">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => {
                const lineRevenue = Number(item.qty) * Number(item.price);
                const lineCost    = Number(item.qty) * Number(item.cost ?? 0);
                const lineProfit  = lineRevenue - lineCost;
                const margin      = lineRevenue > 0 ? Math.round((lineProfit / lineRevenue) * 100) : 0;

                return (
                  <tr key={index} className="hover:bg-slate-50/50">
                    <td className="p-5">
                      <p className="font-black text-slate-900">{item.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        {item.unit}
                        {item.cost != null && (
                          <span className="mr-2 text-slate-300">| تكلفة: {item.cost} ج</span>
                        )}
                      </p>
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
                    <td className="p-5 text-center">
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => {
                          const newItems = [...items];
                          // ✅ بس price بيتغير — cost بيفضل زي ما هو
                          newItems[index].price = e.target.value;
                          setItems(newItems);
                        }}
                        className="w-24 p-2 border-2 border-slate-100 rounded-xl text-center font-black text-emerald-600 bg-slate-50 focus:border-emerald-500 outline-none transition-all"
                      />
                    </td>

                    {/* ✅ ربح السطر بيتحدث لحظياً */}
                    <td className="p-5 text-center">
                      <span className={`text-xs font-black px-2 py-1 rounded-lg ${lineProfit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
                        {lineProfit >= 0 ? '+' : ''}{lineProfit.toLocaleString()} ج
                        <span className="text-[9px] block opacity-70">{margin}%</span>
                      </span>
                    </td>

                    <td className="p-5 text-left font-black text-slate-900">
                      {lineRevenue.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
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
            {/* ✅ إجمالي الربح المتوقع */}
            <p className={`text-sm font-black mt-2 ${liveProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ربح متوقع: {liveProfit >= 0 ? '+' : ''}{liveProfit.toLocaleString()} ج.م
            </p>
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