"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Product {
  id: string; name: string; unit: string;
  sale_price: number; purchase_price: number; stock_quantity: number;
}
interface CartItem extends Product {
  qty: number | string;
  price: number | string;
  cost: number;
}

export default function CustomerInvoicePage() {
  const { id } = useParams();
  const router  = useRouter();

  const [customer, setCustomer]       = useState<any>(null);
  const [products, setProducts]       = useState<Product[]>([]);
  const [searchTerm, setSearchTerm]   = useState("");
  const [cart, setCart]               = useState<CartItem[]>([]);
  const [cashPaid, setCashPaid]       = useState<number | string>(0);
  const [isSaving, setIsSaving]       = useState(false);
  const [note, setNote]               = useState("");

  useEffect(() => { if (id) loadData(); }, [id]);

  async function loadData() {
    const [{ data: cust }, { data: prods }] = await Promise.all([
      supabase.from("customers").select("*").eq("id", id).single(),
      supabase.from("products").select("id,name,unit,sale_price,purchase_price,stock_quantity").order("name"),
    ]);
    setCustomer(cust);
    setProducts(prods || []);
  }

  const filteredProducts = useMemo(() =>
    products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [products, searchTerm]
  );

  const addToCart = (p: Product) => {
    if (p.stock_quantity <= 0) return alert("الصنف ده خلصان يا عمدة!");
    if (cart.find(i => i.id === p.id)) return;
    setCart(prev => [...prev, { ...p, qty: 1, price: p.sale_price, cost: p.purchase_price }]);
  };

  const removeFromCart = (pid: string) => setCart(prev => prev.filter(i => i.id !== pid));

  const updateCart = (id: string, field: "qty" | "price", val: string) =>
    setCart(prev => prev.map(i => i.id === id ? { ...i, [field]: val } : i));

  // ── Totals ──
  const total      = cart.reduce((s, i) => s + Number(i.qty || 0) * Number(i.price || 0), 0);
  const totalCost  = cart.reduce((s, i) => s + Number(i.qty || 0) * Number(i.cost || 0), 0);
  const profit     = total - totalCost;
  const cash       = Number(cashPaid) || 0;
  const remaining  = total - cash;
  const margin     = total > 0 ? Math.round((profit / total) * 100) : 0;

  const saveInvoice = async () => {
    if (cart.length === 0) return alert("الفاتورة فاضية!");
    setIsSaving(true);
    try {
      const itemsToSave = cart.map(i => ({
        id: i.id, name: i.name, unit: i.unit,
        qty: Number(i.qty), price: Number(i.price), cost: Number(i.cost),
      }));

      await supabase.from("customer_transactions").insert([{
        customer_id: id, amount: total, type: "sale",
        items: itemsToSave, profit,
        description: note || `بيع بضاعة لـ ${customer.name}`,
      }]);

      if (cash > 0) {
        await supabase.from("customer_transactions").insert([{
          customer_id: id, amount: cash, type: "payment", description: "سداد من فاتورة",
        }]);
      }

      await supabase.from("customers")
        .update({ balance: (customer.balance || 0) + remaining })
        .eq("id", id);

      for (const item of cart)
        await supabase.rpc("decrement_stock", { row_id: item.id, amount: Number(item.qty) });

      router.push(`/customer/${id}/history`);
    } catch { alert("خطأ في الحفظ"); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-right font-sans text-slate-900 pb-10" dir="rtl">

      {/* ══ Header ══ */}
      <header className="bg-[#0f172a] text-white p-5 flex justify-between items-center shadow-xl sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link href="/customer" className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-xs font-black transition-all">⬅️ رجوع</Link>
          <div>
            <h1 className="text-lg font-black">فاتورة: {customer?.name}</h1>
            <p className="text-[10px] text-slate-400 font-bold">{new Date().toLocaleDateString("ar-EG", { weekday:"long", day:"numeric", month:"long" })}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {cart.length > 0 && (
            <span className="bg-indigo-600 px-3 py-1 rounded-lg text-[10px] font-black">{cart.length} صنف</span>
          )}
          <div className={`px-4 py-1.5 rounded-lg text-[10px] font-black ${customer?.balance > 0 ? "bg-rose-600" : "bg-emerald-600"}`}>
            مديونية: {customer?.balance?.toLocaleString("ar-EG")} ج.م
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 grid grid-cols-12 gap-5 mt-4">

        {/* ══ قائمة المنتجات ══ */}
        <aside className="col-span-12 lg:col-span-4 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col" style={{ height: "82vh" }}>
          <div className="p-5 border-b border-slate-100 space-y-3">
            <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-widest">📦 اختيار الأصناف</h3>
            <input
              type="text"
              placeholder="🔍 ابحث..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:border-indigo-400 transition-all text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto flex-1 p-3 space-y-2">
            {filteredProducts.map(p => {
              const inCart = !!cart.find(i => i.id === p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => !inCart && addToCart(p)}
                  className={`p-4 rounded-2xl border flex justify-between items-center transition-all
                    ${p.stock_quantity <= 0 ? "opacity-40 grayscale cursor-not-allowed border-slate-100" :
                      inCart ? "border-indigo-300 bg-indigo-50 cursor-default" :
                               "border-slate-100 hover:border-indigo-400 hover:bg-slate-50 cursor-pointer"}`}
                >
                  <div>
                    <p className="font-black text-slate-900 text-sm">{p.name}</p>
                    <p className="text-[10px] font-bold text-emerald-600 mt-0.5">{p.sale_price} ج.م</p>
                  </div>
                  <div className="text-left">
                    <div className={`px-3 py-1.5 rounded-xl text-center ${p.stock_quantity <= 5 ? "bg-rose-100" : "bg-slate-100"}`}>
                      <p className={`text-xs font-black ${p.stock_quantity <= 5 ? "text-rose-600" : "text-slate-700"}`}>{p.stock_quantity}</p>
                      <p className="text-[8px] font-black text-slate-400 uppercase">{p.unit}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ══ الفاتورة ══ */}
        <div className="col-span-12 lg:col-span-8 space-y-4">

          {/* جدول الأصناف */}
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden" style={{ minHeight: 380 }}>
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-300 space-y-3">
                <span className="text-5xl">🧾</span>
                <p className="font-black">اختار أصناف من الجانب</p>
              </div>
            ) : (
              <table className="w-full text-right border-collapse">
                <thead className="bg-slate-50 text-slate-400 font-black text-[10px] uppercase border-b border-slate-100">
                  <tr>
                    <th className="p-4">الصنف</th>
                    <th className="p-4 text-center">الكمية</th>
                    <th className="p-4 text-center">السعر <span className="text-indigo-400 normal-case font-normal">(قابل للتعديل)</span></th>
                    <th className="p-4 text-center">الربح</th>
                    <th className="p-4 text-left">الإجمالي</th>
                    <th className="p-4 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {cart.map(item => {
                    const lineTotal  = Number(item.qty || 0) * Number(item.price || 0);
                    const lineCost   = Number(item.qty || 0) * Number(item.cost || 0);
                    const lineProfit = lineTotal - lineCost;
                    const m = lineTotal > 0 ? Math.round((lineProfit / lineTotal) * 100) : 0;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <p className="font-black text-sm">{item.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold">تكلفة: {item.cost} ج.م</p>
                        </td>
                        <td className="p-4 text-center">
                          <input
                            type="number" step="any"
                            value={item.qty}
                            onChange={e => updateCart(item.id, "qty", e.target.value)}
                            className="w-20 p-2 border border-slate-200 rounded-xl text-center font-black bg-slate-50 outline-none focus:border-indigo-400 transition-all"
                          />
                        </td>
                        <td className="p-4 text-center">
                          <input
                            type="number" step="any"
                            value={item.price}
                            onChange={e => updateCart(item.id, "price", e.target.value)}
                            className="w-24 p-2 border border-slate-200 rounded-xl text-center font-black text-indigo-600 bg-slate-50 outline-none focus:border-indigo-400 transition-all"
                          />
                        </td>
                        <td className="p-4 text-center">
                          <span className={`text-[10px] font-black px-2 py-1 rounded-lg block text-center ${lineProfit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                            {lineProfit.toFixed(1)} ج<br/>
                            <span className="text-[8px] opacity-70">{m}%</span>
                          </span>
                        </td>
                        <td className="p-4 text-left font-black">{lineTotal.toLocaleString("ar-EG", { maximumFractionDigits: 2 })}</td>
                        <td className="p-4">
                          <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-rose-500 transition-colors text-lg font-black">✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ملاحظة */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-3">
            <input
              placeholder="📝 ملاحظة على الفاتورة (اختياري)..."
              className="w-full bg-transparent font-bold text-slate-700 outline-none text-sm placeholder:text-slate-300"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {/* ══ فوتر الفاتورة ══ */}
          <div className="bg-[#0f172a] p-7 rounded-[2.5rem] border-2 border-slate-700 shadow-2xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-white">
              <div>
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">الإجمالي</p>
                <p className="text-2xl font-black">{total.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} <small className="text-xs opacity-50">ج</small></p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">الربح المتوقع</p>
                <p className={`text-2xl font-black ${profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {profit.toFixed(1)} <small className="text-xs opacity-70">ج ({margin}%)</small>
                </p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">دفع كاش</p>
                <input
                  type="number" step="any"
                  value={cashPaid}
                  onChange={e => setCashPaid(e.target.value)}
                  className="bg-white/10 border border-white/20 text-white text-2xl font-black w-full rounded-2xl px-3 py-1.5 outline-none focus:border-emerald-400 transition-all text-center"
                  placeholder="0"
                />
              </div>
              <div>
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">المتبقي (دين)</p>
                <p className={`text-2xl font-black ${remaining > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                  {remaining.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} <small className="text-xs opacity-70">ج</small>
                </p>
              </div>
            </div>
            <button
              onClick={saveInvoice}
              disabled={isSaving || cart.length === 0}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white py-5 rounded-2xl font-black text-xl transition-all active:scale-[0.99] shadow-xl shadow-emerald-900/30"
            >
              {isSaving ? "⏳ جاري الحفظ..." : "حفظ الفاتورة ✅"}
            </button>
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