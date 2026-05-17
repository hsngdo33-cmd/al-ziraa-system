"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Product {
  id: string; name: string; unit: string;
  purchase_price: number; sale_price: number; stock_quantity: number;
}
interface CartItem extends Product {
  qty: number | string;
  p_price: number | string;
}

const UNITS = ["كيلو","جرام","لتر","ملي","عبوة","شكارة","طن","وحدة"];

export default function SupplierInvoicePage() {
  const { id } = useParams();
  const router  = useRouter();

  const [supplier, setSupplier]     = useState<any>(null);
  const [products, setProducts]     = useState<Product[]>([]);
  const [cart, setCart]             = useState<CartItem[]>([]);
  const [cashPaid, setCashPaid]     = useState<number | string>(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving]     = useState(false);
  const [note, setNote]             = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProd, setNewProd]       = useState({ name: "", unit: "كيلو", purchase_price: "", sale_price: "" });
  const [addingSaving, setAddingSaving] = useState(false);

  useEffect(() => { if (id) loadData(); }, [id]);

  async function loadData() {
    const [{ data: supp }, { data: prods }] = await Promise.all([
      supabase.from("suppliers").select("*").eq("id", id).single(),
      supabase.from("products").select("*").order("name"),
    ]);
    setSupplier(supp);
    setProducts(prods || []);
  }

  const filteredProducts = useMemo(() =>
    products.filter(p => p.name.includes(searchTerm)),
    [products, searchTerm]
  );

  const addToCart = (p: Product) => {
    if (cart.find(i => i.id === p.id)) return;
    setCart(prev => [...prev, { ...p, qty: 1, p_price: p.purchase_price }]);
  };

  const removeFromCart = (pid: string) => setCart(prev => prev.filter(i => i.id !== pid));

  const updateCart = (pid: string, field: "qty" | "p_price", val: string) =>
    setCart(prev => prev.map(i => i.id === pid ? { ...i, [field]: val } : i));

  const totalInvoice = cart.reduce((s, i) => s + Number(i.qty || 0) * Number(i.p_price || 0), 0);
  const cash         = Number(cashPaid) || 0;
  const remaining    = totalInvoice - cash;

  async function handleAddNewProduct() {
    if (!newProd.name.trim() || !newProd.purchase_price) return alert("اكمل البيانات!");
    setAddingSaving(true);
    const { data } = await supabase.from("products").insert([{
      name: newProd.name, unit: newProd.unit,
      purchase_price: Number(newProd.purchase_price),
      sale_price: Number(newProd.sale_price) || Number(newProd.purchase_price),
      stock_quantity: 0,
    }]).select().single();
    if (data) {
      setProducts(prev => [...prev, data]);
      addToCart(data);
      setShowAddModal(false);
      setNewProd({ name: "", unit: "كيلو", purchase_price: "", sale_price: "" });
    }
    setAddingSaving(false);
  }

  async function saveInvoice() {
    if (cart.length === 0) return alert("الفاتورة فارغة!");
    setIsSaving(true);
    try {
      await supabase.from("transactions").insert([{
        supplier_id: id,
        amount: totalInvoice,
        type: "فاتورة توريد",
        items: cart.map(i => ({ id: i.id, name: i.name, unit: i.unit, qty: Number(i.qty), price: Number(i.p_price) })),
        description: note || `توريد بضاعة من ${supplier?.name}`,
      }]);

      if (cash > 0) {
        await supabase.from("transactions").insert([{
          supplier_id: id, amount: cash, type: "سداد نقدي", description: "دفعة من الفاتورة",
        }]);
      }

      await supabase.from("suppliers")
        .update({ balance: (supplier.balance || 0) + remaining })
        .eq("id", id);

      for (const item of cart)
        await supabase.rpc("increment_stock", { row_id: item.id, amount: Number(item.qty) });

      router.push("/suppliers");
    } catch { alert("خطأ في الحفظ"); }
    finally { setIsSaving(false); }
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-right font-sans text-slate-900 pb-10" dir="rtl">

      {/* ══ Header ══ */}
      <header className="bg-[#0f172a] text-white p-5 flex justify-between items-center shadow-xl sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link href="/suppliers" className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-xs font-black transition-all">⬅️ رجوع</Link>
          <div>
            <h1 className="text-lg font-black">📥 فاتورة توريد: {supplier?.name}</h1>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
              {new Date().toLocaleDateString("ar-EG", { weekday:"long", day:"numeric", month:"long" })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {cart.length > 0 && (
            <span className="bg-amber-500 px-3 py-1 rounded-lg text-[10px] font-black">{cart.length} صنف</span>
          )}
          <div className={`px-4 py-1.5 rounded-lg text-[10px] font-black ${supplier?.balance > 0 ? "bg-rose-600" : "bg-emerald-600"}`}>
            مديونية: {supplier?.balance?.toLocaleString("ar-EG")} ج.م
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 grid grid-cols-12 gap-5 mt-4">

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
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full bg-amber-50 hover:bg-amber-100 text-amber-700 border border-dashed border-amber-300 py-2.5 rounded-xl text-xs font-black transition-all"
            >
              ➕ صنف جديد مش متسجل
            </button>
          </div>
          <div className="overflow-y-auto flex-1 p-3 space-y-2">
            {filteredProducts.map(p => {
              const inCart = !!cart.find(i => i.id === p.id);
              return (
                <div
                  key={p.id}
                  onClick={() => !inCart && addToCart(p)}
                  className={`p-4 rounded-2xl border flex justify-between items-center transition-all
                    ${inCart
                      ? "border-amber-300 bg-amber-50 cursor-default"
                      : "border-slate-100 hover:border-amber-400 hover:bg-slate-50 cursor-pointer"}`}
                >
                  <div>
                    <p className="font-black text-slate-900 text-sm">{p.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                      شراء: {p.purchase_price} ج — مخزن: {p.stock_quantity} {p.unit}
                    </p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl text-center ${p.stock_quantity <= 5 ? "bg-rose-100" : "bg-slate-100"}`}>
                    <p className={`text-xs font-black ${p.stock_quantity <= 5 ? "text-rose-600" : "text-slate-700"}`}>{p.stock_quantity}</p>
                    <p className="text-[8px] font-black text-slate-400 uppercase">{p.unit}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ══ الفاتورة ══ */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden" style={{ minHeight: 380 }}>
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-300 space-y-3">
                <span className="text-5xl">📥</span>
                <p className="font-black">اختار أصناف من الجانب</p>
              </div>
            ) : (
              <table className="w-full text-right border-collapse">
                <thead className="bg-slate-50 text-slate-400 font-black text-[10px] uppercase border-b border-slate-100">
                  <tr>
                    <th className="p-4">الصنف</th>
                    <th className="p-4 text-center">الكمية</th>
                    <th className="p-4 text-center">سعر الشراء <span className="text-amber-400 normal-case font-normal">(قابل للتعديل)</span></th>
                    <th className="p-4 text-left">الإجمالي</th>
                    <th className="p-4 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {cart.map(item => {
                    const lineTotal = Number(item.qty || 0) * Number(item.p_price || 0);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <p className="font-black text-sm">{item.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold">{item.unit}</p>
                        </td>
                        <td className="p-4 text-center">
                          <input
                            type="number" step="any"
                            value={item.qty}
                            onChange={e => updateCart(item.id, "qty", e.target.value)}
                            className="w-20 p-2 border border-slate-200 rounded-xl text-center font-black bg-slate-50 outline-none focus:border-amber-400 transition-all"
                          />
                        </td>
                        <td className="p-4 text-center">
                          <input
                            type="number" step="any"
                            value={item.p_price}
                            onChange={e => updateCart(item.id, "p_price", e.target.value)}
                            className="w-24 p-2 border border-slate-200 rounded-xl text-center font-black text-amber-600 bg-slate-50 outline-none focus:border-amber-400 transition-all"
                          />
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
          <div className="bg-[#0f172a] p-7 rounded-[2.5rem] shadow-2xl">
            <div className="grid grid-cols-3 gap-4 mb-6 text-white">
              <div>
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">إجمالي الفاتورة</p>
                <p className="text-2xl font-black">{totalInvoice.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} <small className="text-xs opacity-50">ج</small></p>
              </div>
              <div>
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">دفع كاش</p>
                <input
                  type="number" step="any"
                  value={cashPaid}
                  onChange={e => setCashPaid(e.target.value)}
                  className="bg-white/10 border border-white/20 text-white text-2xl font-black w-full rounded-2xl px-3 py-1.5 outline-none focus:border-amber-400 transition-all text-center"
                  placeholder="0"
                />
              </div>
              <div>
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">المتبقي (دين للمورد)</p>
                <p className={`text-2xl font-black ${remaining > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                  {remaining.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} <small className="text-xs opacity-70">ج</small>
                </p>
              </div>
            </div>
            <button
              onClick={saveInvoice}
              disabled={isSaving || cart.length === 0}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white py-5 rounded-2xl font-black text-xl transition-all active:scale-[0.99] shadow-xl shadow-amber-900/20"
            >
              {isSaving ? "⏳ جاري الحفظ..." : "اعتماد وتحديث المخزن ✅"}
            </button>
          </div>
        </div>
      </main>

      {/* ══ Modal: صنف جديد ══ */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl space-y-5" onClick={e => e.stopPropagation()}>
            <div className="border-r-4 border-amber-500 pr-3">
              <h3 className="text-xl font-black text-slate-900">إضافة صنف جديد</h3>
              <p className="text-xs text-slate-400 font-bold mt-0.5">هيتضاف للمخزن وللفاتورة فوراً</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black text-slate-400 mb-1 block">اسم الصنف *</label>
                <input
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:border-amber-400 transition-all"
                  placeholder="مثال: أرز بسمتي"
                  value={newProd.name}
                  onChange={e => setNewProd({...newProd, name: e.target.value})}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 mb-1 block">وحدة القياس</label>
                <select
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:border-amber-400 transition-all"
                  value={newProd.unit}
                  onChange={e => setNewProd({...newProd, unit: e.target.value})}
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-slate-400 mb-1 block">سعر الشراء *</label>
                  <input
                    type="number" step="any"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-rose-600 outline-none focus:border-amber-400 transition-all"
                    placeholder="0"
                    value={newProd.purchase_price}
                    onChange={e => setNewProd({...newProd, purchase_price: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 mb-1 block">سعر البيع</label>
                  <input
                    type="number" step="any"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-emerald-600 outline-none focus:border-amber-400 transition-all"
                    placeholder="0"
                    value={newProd.sale_price}
                    onChange={e => setNewProd({...newProd, sale_price: e.target.value})}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleAddNewProduct}
                disabled={addingSaving || !newProd.name.trim() || !newProd.purchase_price}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white py-4 rounded-2xl font-black transition-all active:scale-95"
              >
                {addingSaving ? "جاري الإضافة..." : "حفظ وإضافة للفاتورة ✅"}
              </button>
              <button onClick={() => setShowAddModal(false)} className="px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-all">إلغاء</button>
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