"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function CustomerHistory() {
  const { id } = useParams();
  const [customer, setCustomer] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null); // لمتابعة الفاتورة المفتوحة

  useEffect(() => { if (id) loadData(); }, [id]);

  async function loadData() {
    setLoading(true);
    // 1. جلب بيانات العميل
    const { data: cust } = await supabase.from("customers").select("*").eq("id", id).single();
    setCustomer(cust);
    
    // 2. جلب المعاملات مرتبة من الأحدث للأقدم
    const { data: trans } = await supabase.from("customer_transactions")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false });
    
    setTransactions(trans || []);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-4 text-right font-sans" dir="rtl">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <header className="bg-white p-6 rounded-[2rem] shadow-sm mb-6 flex justify-between items-center border border-slate-200">
           <div>
              <h1 className="text-2xl font-black text-slate-900">{customer?.name}</h1>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">سجل المعاملات المالي</p>
           </div>
           <Link href={`/customer/${id}`} className="bg-[#0f172a] text-white px-6 py-2 rounded-xl text-xs font-black">➕ فاتورة جديدة</Link>
        </header>

        {loading ? (
          <p className="text-center p-20 font-black text-slate-400 animate-pulse">جاري سحب السجلات...</p>
        ) : (
          <div className="space-y-4">
            {transactions.map((t) => (
              <div key={t.id} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden transition-all">
                
                {/* رأس المعاملة (البيانات الأساسية) */}
                <div 
                  onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                  className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${t.type === 'فاتورة بيع' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {t.type === 'فاتورة بيع' ? '📦' : '💰'}
                    </div>
                    <div>
                      <p className="font-black text-slate-900">{t.type}</p>
                      <p className="text-[10px] font-bold text-slate-400">{new Date(t.created_at).toLocaleString('ar-EG')}</p>
                    </div>
                  </div>
                  
                  <div className="text-left">
                    <p className={`text-lg font-black ${t.type === 'فاتورة بيع' ? 'text-slate-900' : 'text-emerald-600'}`}>
                      {t.type === 'فاتورة بيع' ? '+' : '-'} {t.amount?.toLocaleString()} ج.م
                    </p>
                    <p className="text-[9px] font-black text-slate-400 uppercase italic">{expandedId === t.id ? 'إغلاق التفاصيل ▲' : 'عرض التفاصيل ▼'}</p>
                  </div>
                </div>

                {/* تفاصيل الفاتورة (تظهر عند الضغط فقط) */}
                {expandedId === t.id && t.items && (
                  <div className="bg-slate-50 border-t border-slate-100 p-6 animate-in slide-in-from-top-2 duration-300">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-400 font-black text-[10px] uppercase border-b border-slate-200">
                          <th className="pb-3 text-right">الصنف</th>
                          <th className="pb-3 text-center">الكمية</th>
                          <th className="pb-3 text-center">السعر</th>
                          <th className="pb-3 text-left">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {t.items.map((item: any, idx: number) => (
                          <tr key={idx} className="text-slate-700">
                            <td className="py-3 font-black">{item.name}</td>
                            <td className="py-3 text-center font-bold">
                               {item.qty} <span className="text-[9px] text-slate-400">{item.unit}</span>
                            </td>
                            <td className="py-3 text-center font-bold">{item.price} ج.م</td>
                            <td className="py-3 text-left font-black">{(item.qty * item.price).toLocaleString()} ج.م</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
                       <div className="flex gap-2">
                          <Link 
                            href={`/customer/${id}/history/edit/${t.id}`}
                            className="bg-slate-200 hover:bg-indigo-600 hover:text-white text-slate-600 px-4 py-2 rounded-xl text-[10px] font-black transition-all"
                          >
                            ✏️ تعديل الفاتورة
                          </Link>
                       </div>
                       <p className="text-xs font-black text-slate-400 italic">وصف المعاملة: {t.description || 'لا يوجد'}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {transactions.length === 0 && (
              <div className="bg-white p-20 rounded-[2rem] text-center border-2 border-dashed border-slate-200 text-slate-300">
                <p className="text-5xl mb-4">📜</p>
                <p className="font-black italic">لا توجد معاملات مسجلة لهذا العميل حتى الآن</p>
              </div>
            )}
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