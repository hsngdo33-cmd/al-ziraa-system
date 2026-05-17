"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function CustomerInvoicePage() {
  const { id } = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [cashPaid, setCashPaid] = useState<any>(0); // تم التغيير لـ any لدعم الكسور أثناء الكتابة
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { if (id) loadData(); }, [id]);

  async function loadData() {
    const { data: cust } = await supabase.from("customers").select("*").eq("id", id).single();
    setCustomer(cust);
    const { data: prods } = await supabase.from("products").select("id, name, unit, sale_price, purchase_price, stock_quantity").order("name");
    setProducts(prods || []);
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (p: any) => {
    if (p.stock_quantity <= 0) return alert("الصنف ده خلصان يا عمدة!");
    if (cart.find(i => i.id === p.id)) return;
    setCart([...cart, { 
      ...p, 
      qty: 1, 
      price: p.sale_price,       // سعر البيع — قابل للتعديل
      cost: p.purchase_price      // سعر الشراء — ثابت دايماً للحساب الصح
    }]);
  };

  // ✅ دالة الحذف من الفاتورة
  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const saveInvoice = async () => {
    if (cart.length === 0) return alert("الفاتورة فاضية!");
    setIsSaving(true);
    try {
      const total = cart.reduce((acc, i) => acc + (Number(i.qty) * Number(i.price)), 0);
      const totalCost = cart.reduce((acc, i) => acc + (Number(i.qty) * Number(i.cost)), 0);
      const profit = total - totalCost;

      const itemsToSave = cart.map(i => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        qty: Number(i.qty),
        price: Number(i.price),
        cost: Number(i.cost),
      }));

      await supabase.from("customer_transactions").insert([{
        customer_id: id,
        amount: total,
        type: "sale",
        items: itemsToSave,
        profit: profit,
        description: `بيع بضاعة لـ ${customer.name}`
      }]);

      if (Number(cashPaid) > 0) {
        await supabase.from("customer_transactions").insert([{
          customer_id: id,
          amount: Number(cashPaid),
          type: "payment",
          description: "سداد من فاتورة"
        }]);
      }

      const newBalance = (customer.balance || 0) + (total - Number(cashPaid));
      await supabase.from("customers").update({ balance: newBalance }).eq("id", id);

      for (const item of cart) {
        await supabase.rpc('decrement_stock', { row_id: item.id, amount: Number(item.qty) });
      }

      alert("تمت العملية بنجاح! ✅");
      router.push(`/customer/${id}/history`);
    } catch (e) {
      alert("خطأ في الحفظ");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-right font-sans text-slate-900 pb-10" dir="rtl">
      
      <header className="bg-[#0f172a] text-white p-5 flex justify-between items-center shadow-xl sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link href="/customer" className="bg-white/10 px-4 py-2 rounded-xl text-xs font-black transition-all hover:bg-white/20">⬅️ رجوع</Link>
          <h1 className="text-lg font-black italic">فاتورة: {customer?.name}</h1>
        </div>
        <div className="bg-rose-600 px-4 py-1 rounded-lg text-[10px] font-black">مديونية: {customer?.balance?.toLocaleString()} ج.م</div>
      </header>

      <main className="max-w-7xl mx-auto p-4 grid grid-cols-12 gap-6 mt-4">
        
        {/* قائمة المنتجات */}
        <div className="col-span-12 lg:col-span-4 bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm h-[82vh] flex flex-col">
          <div className="mb-4 space-y-3">
            <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-widest border-b pb-2">📦 اختيار الأصناف</h3>
            <input
              type="text"
              placeholder="🔍 ابحث عن صنف بالمخزن..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:border-indigo-500 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto flex-1 space-y-2 pr-1">
            {filteredProducts.map(p => (
              <div
                key={p.id}
                onClick={() => addToCart(p)}
                className={`p-4 rounded-2xl border border-slate-50 flex justify-between items-center cursor-pointer transition-all hover:border-indigo-500 hover:bg-slate-50 group ${p.stock_quantity <= 0 ? 'opacity-40 grayscale' : ''}`}
              >
                <div>
                  <p className="font-black text-slate-900 text-sm">{p.name}</p>
                  <p className="text-[10px] font-bold text-emerald-600">السعر: {p.sale_price} ج.م</p>
                </div>
                <div className="text-left bg-slate-100 p-2 rounded-xl min-w-[65px]">
                  <p className="text-xs font-black text-slate-900">{p.stock_quantity}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase">{p.unit || 'وحدة'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* الفاتورة */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden min-h-[450px]">
            <table className="w-full text-right border-collapse">
              <thead className="bg-slate-50 text-slate-400 font-black text-[10px] uppercase border-b border-slate-100">
                <tr>
                  <th className="p-5">الصنف</th>
                  <th className="p-5 text-center">الكمية</th>
                  <th className="p-5 text-center">السعر</th>
                  <th className="p-5 text-center">هامش الربح</th>
                  <th className="p-5 text-left">الإجمالي</th>
                  <th className="p-5 w-10"></th> {/* عمود الحذف */}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cart.map(item => {
                  const lineTotal = Number(item.qty || 0) * Number(item.price || 0);
                  const lineCost  = Number(item.qty || 0) * Number(item.cost || 0);
                  const lineProfit = lineTotal - lineCost;
                  const margin = lineTotal > 0 ? Math.round((lineProfit / lineTotal) * 100) : 0;

                  return (
                    <tr key={item.id} className="text-slate-900 hover:bg-slate-50/50 transition-colors group">
                      <td className="p-5">
                        <p className="font-black text-sm">{item.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold">شراء: {item.cost} ج.م</p>
                      </td>
                      <td className="p-5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <input
                            type="number"
                            step="any"
                            value={item.qty}
                            onChange={(e) => {
                              const raw = e.target.value;
                              setCart(cart.map(c => c.id === item.id ? {...c, qty: raw} : c));
                            }}
                            className="w-20 p-2 border border-slate-200 rounded-xl text-center font-black bg-slate-50 outline-none focus:border-indigo-500 transition-all"
                          />
                        </div>
                      </td>
                      <td className="p-5 text-center">
                        <input
                          type="number"
                          step="any"
                          value={item.price}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setCart(cart.map(c => c.id === item.id ? {...c, price: raw} : c));
                          }}
                          className="w-24 p-2 border border-slate-200 rounded-xl text-center font-black text-indigo-600 bg-slate-50 outline-none focus:border-indigo-500 transition-all"
                        />
                      </td>

                      <td className="p-5 text-center">
                        <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${lineProfit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
                          {lineProfit.toFixed(1)} ج ({margin}%)
                        </span>
                      </td>

                      <td className="p-5 text-left font-black text-lg">
                        {lineTotal.toLocaleString(undefined, {maximumFractionDigits: 2})}
                      </td>

                      {/* ✅ زر الحذف */}
                      <td className="p-5 text-center">
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="text-rose-300 hover:text-rose-600 transition-colors p-2"
                          title="حذف من الفاتورة"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* فوتر الفاتورة */}
          <div className="bg-white p-8 rounded-[3rem] border-2 border-[#0f172a] shadow-xl flex flex-wrap justify-between items-center gap-6">
            <div>
              <p className="text-[10px] text-slate-400 font-black mb-1 uppercase tracking-widest">إجمالي الحساب</p>
              <h2 className="text-5xl font-black text-[#0f172a]">
                {cart.reduce((acc, i) => acc + (Number(i.qty || 0) * Number(i.price || 0)), 0).toLocaleString(undefined, {maximumFractionDigits: 2})}
                <small className="text-sm font-normal"> ج.م</small>
              </h2>
              <p className="text-xs font-black text-emerald-600 mt-1">
                ربح متوقع: {(
                  cart.reduce((acc, i) => acc + (Number(i.qty||0) * Number(i.price||0)), 0) -
                  cart.reduce((acc, i) => acc + (Number(i.qty||0) * Number(i.cost||0)), 0)
                ).toLocaleString(undefined, {maximumFractionDigits: 2})} ج.م
              </p>
            </div>
            <div className="flex gap-6 items-end">
              <div className="text-center">
                <p className="text-[10px] font-black text-emerald-600 mb-2 uppercase italic">دفع كاش</p>
                <input
                  type="number"
                  step="any"
                  value={cashPaid}
                  onChange={(e) => setCashPaid(e.target.value)}
                  className="bg-slate-50 text-3xl font-black w-28 text-center rounded-2xl border border-slate-200 p-3 outline-none text-emerald-600 focus:border-emerald-500"
                />
              </div>
              <button
                onClick={saveInvoice}
                disabled={isSaving || cart.length === 0}
                className="bg-[#0f172a] hover:bg-indigo-600 text-white px-12 py-6 rounded-[2rem] font-black text-xl transition-all active:scale-95 shadow-2xl disabled:opacity-50"
              >
                {isSaving ? "جاري الحفظ..." : "حفظ الفاتورة ✅"}
              </button>
            </div>
          </div>
        </div>
      </main>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
        body { font-family: 'Cairo', sans-serif; background-color: #f1f5f9; }
      `}</style>
    </div>
  );
}