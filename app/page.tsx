"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { X, Loader2, TrendingUp, TrendingDown, Wallet } from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState({
    customersCount: 0,
    suppliersCount: 0,
    totalCustomerDebts: 0,
    totalSupplierDebts: 0,
  });

  // حالات نافذة حسابات الشهر
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    async function fetchStats() {
      const { data: customers } = await supabase.from("customers").select("balance");
      const { data: suppliers } = await supabase.from("suppliers").select("balance");

      setStats({
        customersCount: customers?.length || 0,
        suppliersCount: suppliers?.length || 0,
        totalCustomerDebts: customers?.reduce((acc, c) => acc + (Number(c.balance) || 0), 0) || 0,
        totalSupplierDebts: suppliers?.reduce((acc, s) => acc + (Number(s.balance) || 0), 0) || 0,
      });
    }
    fetchStats();
  }, []);

  // دالة جلب حسابات الشهر - شاملة التحصيلات
  const fetchMonthlyReport = async () => {
    setLoadingReport(true);
    setIsReportOpen(true);
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      // 1. جلب المبيعات والربح (نوع sale)
      const { data: salesTrans } = await supabase
        .from('customer_transactions')
        .select('amount, profit')
        .eq('type', 'sale')
        .gte('created_at', thirtyDaysAgo.toISOString());

      // 2. جلب التحصيلات (نوع payment)
      const { data: paymentsTrans } = await supabase
        .from('customer_transactions')
        .select('amount')
        .eq('type', 'payment')
        .gte('created_at', thirtyDaysAgo.toISOString());

      // 3. جلب المصاريف
      const { data: exps } = await supabase
        .from('expenses')
        .select('amount')
        .gte('expense_date', thirtyDaysAgo.toLocaleDateString('en-CA'));

      const totalSales = salesTrans?.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || 0;
      const totalProfit = salesTrans?.reduce((sum, item) => sum + (Number(item.profit) || 0), 0) || 0;
      const totalPayments = paymentsTrans?.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || 0;
      const totalExpenses = exps?.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) || 0;

      setReportData({
        sales: totalSales,
        profit: totalProfit,
        payments: totalPayments,
        expenses: totalExpenses,
        net: totalProfit - totalExpenses
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReport(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-right font-sans pb-10 text-slate-900" dir="rtl">
      
      <header className="bg-[#0f172a] text-white p-6 shadow-xl mb-8">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black italic text-white">منظومة العمدة  🌾</h1>
            <p className="text-[10px] text-slate-400 mt-1 font-black uppercase tracking-widest">إدارة التجارة والمخازن</p>
          </div>
          <div className="flex gap-3">
             <button 
               onClick={fetchMonthlyReport}
               className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-black text-sm shadow-lg transition-all active:scale-95 border border-indigo-400/20"
             >
               📅 حسابات الشهر
             </button>
             <div className="bg-white/10 px-4 py-2 rounded-xl text-center border border-white/5">
                <p className="text-[9px] text-slate-400 font-black uppercase">اليوم</p>
                <p className="text-sm font-bold text-white">{new Date().toLocaleDateString('ar-EG')}</p>
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-white p-7 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group">
            <p className="text-slate-500 text-[10px] font-black mb-2 uppercase tracking-[0.2em]">إجمالي ديون العملاء</p>
            <h3 className="text-4xl font-black text-slate-900">
                {stats.totalCustomerDebts.toLocaleString()} <small className="text-xs font-normal opacity-50">ج.م</small>
            </h3>
            <div className="w-1 h-12 bg-rose-500 absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"></div>
          </div>

          <div className="bg-white p-7 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group">
            <p className="text-slate-500 text-[10px] font-black mb-2 uppercase tracking-[0.2em]">ديون الموردين</p>
            <h3 className="text-4xl font-black text-slate-900">
                {stats.totalSupplierDebts.toLocaleString()} <small className="text-xs font-normal opacity-50">ج.م</small>
            </h3>
            <div className="w-1 h-12 bg-indigo-500 absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"></div>
          </div>

          <div className="bg-white p-7 rounded-[2rem] border border-slate-200 shadow-sm">
            <p className="text-slate-500 text-[10px] font-black mb-2 uppercase tracking-[0.2em]">عدد العملاء</p>
            <h3 className="text-4xl font-black text-slate-900">{stats.customersCount} <small className="text-xs font-normal opacity-50">عميل</small></h3>
          </div>

          <div className="bg-white p-7 rounded-[2rem] border border-slate-200 shadow-sm">
            <p className="text-slate-500 text-[10px] font-black mb-2 uppercase tracking-[0.2em]">عدد الموردين</p>
            <h3 className="text-4xl font-black text-slate-900">{stats.suppliersCount} <small className="text-xs font-normal opacity-50">مورد</small></h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Link href="/customer" className="group bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm hover:border-emerald-500 transition-all hover:shadow-xl hover:shadow-emerald-500/5">
             <div className="text-5xl mb-6 group-hover:scale-110 transition-transform duration-300">👥</div>
             <h4 className="text-2xl font-black text-slate-900">إدارة العملاء</h4>
             <p className="text-slate-500 text-sm mt-3 font-bold leading-relaxed">تسجيل مبيعات جديدة، تحصيل مبالغ، ومتابعة سجلات البيع.</p>
             <div className="mt-6 flex items-center gap-2 text-emerald-600 font-black text-xs italic">
                افتح الدليل الآن ⬅️
             </div>
          </Link>

          <Link href="/suppliers" className="group bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm hover:border-indigo-500 transition-all hover:shadow-xl hover:shadow-indigo-500/5">
             <div className="text-5xl mb-6 group-hover:scale-110 transition-transform duration-300">📦</div>
             <h4 className="text-2xl font-black text-slate-900">إدارة الموردين</h4>
             <p className="text-slate-500 text-sm mt-3 font-bold leading-relaxed">إضافة مشتريات للمخزن، سداد دفعات، ومراجعة حساب الموردين.</p>
             <div className="mt-6 flex items-center gap-2 text-indigo-600 font-black text-xs italic">
                افتح السجل الآن ⬅️
             </div>
          </Link>

          <Link href="/inventory" className="group bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm hover:border-amber-500 transition-all hover:shadow-xl hover:shadow-amber-500/5">
             <div className="text-5xl mb-6 group-hover:scale-110 transition-transform duration-300">🌾</div>
             <h4 className="text-2xl font-black text-slate-900">المخزن العام</h4>
             <p className="text-slate-500 text-sm mt-3 font-bold leading-relaxed">مراقبة كميات البضاعة، تحديث الأسعار، وحرد المخازن.</p>
             <div className="mt-6 flex items-center gap-2 text-amber-600 font-black text-xs italic">
                جرد البضاعة ⬅️
             </div>
          </Link>
        </div>

      </main>

      {/* نافذة تقرير الشهر المنبثقة */}
      {isReportOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden relative border border-slate-100">
            <button 
              onClick={() => setIsReportOpen(false)}
              className="absolute top-6 left-6 p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                  <Wallet size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">خلاصة حسابات الشهر</h2>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">آخر 30 يوم عمل</p>
                </div>
              </div>

              {loadingReport ? (
                <div className="py-12 flex flex-col items-center gap-4 text-indigo-600">
                  <Loader2 className="animate-spin" size={40} />
                  <p className="font-bold text-sm">جاري مراجعة الدفاتر...</p>
                </div>
              ) : reportData && (
                <div className="space-y-4">
                  {/* إجمالي المبيعات */}
                  <div className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-600 font-bold text-sm">
                      <TrendingUp size={16} className="text-emerald-500" />
                      <span>إجمالي المبيعات</span>
                    </div>
                    <span className="font-black text-slate-900">{reportData.sales.toLocaleString()} ج.م</span>
                  </div>

                  {/* إجمالي التحصيلات (الميزة الجديدة) */}
                  <div className="flex justify-between items-center p-5 bg-blue-50/50 rounded-2xl border border-blue-100">
                    <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                      <Wallet size={16} />
                      <span>إجمالي التحصيلات (كاش)</span>
                    </div>
                    <span className="font-black text-blue-700">{reportData.payments.toLocaleString()} ج.م</span>
                  </div>

                  {/* أرباح المبيعات */}
                  <div className="flex justify-between items-center p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                    <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                      <TrendingUp size={16} />
                      <span>أرباح البضاعة</span>
                    </div>
                    <span className="font-black text-emerald-700">+{reportData.profit.toLocaleString()} ج.م</span>
                  </div>

                  {/* المصاريف العامة */}
                  <div className="flex justify-between items-center p-5 bg-rose-50/50 rounded-2xl border border-rose-100">
                    <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                      <TrendingDown size={16} />
                      <span>المصاريف العامة</span>
                    </div>
                    <span className="font-black text-rose-700">-{reportData.expenses.toLocaleString()} ج.م</span>
                  </div>

                  {/* صافي الربح */}
                  <div className="mt-8 p-6 bg-[#0f172a] text-white rounded-[2rem] shadow-xl relative overflow-hidden">
                    <p className="text-slate-400 text-[10px] font-black uppercase mb-1">صافي الربح الحقيقي</p>
                    <h3 className="text-3xl font-black text-indigo-400">{reportData.net.toLocaleString()} <small className="text-xs text-white/50">ج.م</small></h3>
                    <div className="absolute right-[-10px] bottom-[-10px] opacity-10 text-6xl">🌾</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
        body { font-family: 'Cairo', sans-serif; background-color: #f1f5f9; }
      `}</style>
    </div>
  );
}