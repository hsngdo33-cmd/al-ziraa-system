"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function SupplierInvoiceFinal() {
  const { id } = useParams();
  const router = useRouter();
  const [supplier, setSupplier] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [cashPaid, setCashPaid] = useState<any>(0); // تغيير لـ any لدعم الكسور أثناء الكتابة
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [newProd, setNewProd] = useState({ 
    name: "", 
    unit: "كيلو", 
    purchase_price: "", 
    sale_price: "" 
  });

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    const { data: supp } = await supabase.from("suppliers").select("*").eq("id", id).single();
    setSupplier(supp);
    const { data: prods } = await supabase.from("products").select("*").order("name");
    setProducts(prods || []);
  }

  const addToCart = (p: any) => {
    if (cart.find(item => item.id === p.id)) return alert("الصنف مضاف بالفعل");
    setCart([...cart, { ...p, qty: "1", p_price: p.purchase_price }]); // الكمية نص لسهولة الكتابة
  };

  const updateCartItem = (id: string, field: string, value: any) => {
    setCart(cart.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const totalInvoice = cart.reduce((acc, item) => acc + (Number(item.qty) * Number(item.p_price)), 0);

  const saveInvoice = async () => {
    if (cart.length === 0) return alert("الفاتورة فارغة!");
    setIsSaving(true);
    try {
      await supabase.from("transactions").insert([{
        supplier_id: id, 
        amount: totalInvoice, 
        type: "فاتورة توريد",
        items: cart.map(i => ({ name: i.name, qty: Number(i.qty), price: Number(i.p_price), id: i.id })),
        description: `توريد بضاعة`
      }]);

      if (Number(cashPaid) > 0) {
        await supabase.from("transactions").insert([{
          supplier_id: id, amount: Number(cashPaid), type: "سداد نقدي", description: "دفعة من الفاتورة"
        }]);
      }

      await supabase.from("suppliers").update({ 
        balance: (supplier.balance || 0) + (totalInvoice - Number(cashPaid)) 
      }).eq("id", id);

      for (const item of cart) {
        await supabase.rpc('increment_stock', { row_id: item.id, amount: Number(item.qty) });
      }

      alert("تم الحفظ بنجاح ✅");
      router.push("/suppliers");
    } catch (e) { alert("خطأ في الحفظ"); } finally { setIsSaving(false); }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-right font-sans pb-10 text-slate-900" dir="rtl">
      
      <header className="bg-[#0f172a] text-white p-4 sticky top-0 z-50 shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/suppliers" className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-all">
                ⬅️ رجوع
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xl">📥</span>
              <h1 className="text-md font-black">فاتورة توريد: {supplier?.name}</h1>
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400">منظومة العمدة الذكية</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200">
            <input 
              placeholder="🔍 ابحث في الأصناف..." 
              className="w-full p-2 bg-slate-50 rounded-lg text-sm font-bold outline-none border border-slate-200 text-slate-900"
              onChange={(e)=>setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={()=>setShowAddModal(true)} className="w-full bg-emerald-50 text-emerald-700 py-3 rounded-xl text-xs font-black border border-dashed border-emerald-200 hover:bg-emerald-100 transition-all">
            ➕ صنف جديد مش متسجل
          </button>
          <div className="h-[450px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {products.filter(p => p.name.includes(searchTerm)).map(p => (
              <div key={p.id} onClick={()=>addToCart(p)} className="bg-white p-3 rounded-lg border border-slate-200 flex justify-between items-center cursor-pointer hover:border-emerald-500 transition-all group">
                <div className="flex flex-col">
                  <span className="text-sm font-black text-slate-800">{p.name}</span>
                  <span className="text-[10px] text-slate-400 font-bold">{p.unit}</span>
                </div>
                <span className="text-lg text-emerald-500 group-hover:scale-125 transition-transform">+</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-500 font-black border-b text-[11px] uppercase tracking-widest">
                <tr>
                  <th className="p-4">الصنف</th>
                  <th className="p-4 text-center">الكمية</th>
                  <th className="p-4 text-center">سعر الشراء</th>
                  <th className="p-4 text-center">الإجمالي</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cart.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="p-4">
                       <p className="font-black text-slate-900">{item.name}</p>
                       <p className="text-[10px] text-slate-400 font-bold">{item.unit}</p>
                    </td>
                    <td className="p-4 text-center">
                      <input type="number" step="any" value={item.qty} onChange={(e)=>updateCartItem(item.id, 'qty', e.target.value)} className="w-16 p-1.5 bg-white border border-slate-200 rounded text-center font-black text-slate-900 focus:border-emerald-500 outline-none" />
                    </td>
                    <td className="p-4 text-center">
                      <input type="number" step="any" value={item.p_price} onChange={(e)=>updateCartItem(item.id, 'p_price', e.target.value)} className="w-20 p-1.5 bg-white border border-slate-200 rounded text-center font-black text-rose-600 focus:border-rose-500 outline-none" />
                    </td>
                    <td className="p-4 text-center font-black text-slate-900 text-lg">{(Number(item.qty) * Number(item.p_price)).toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                    <td className="p-4 text-left"><button onClick={()=>setCart(cart.filter(i=>i.id!==item.id))} className="text-rose-300 hover:text-rose-600 text-xl">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-[#0f172a] rounded-2xl p-6 text-white flex flex-wrap justify-between items-center gap-6 shadow-xl">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">إجمالي المبلغ المطلوب</p>
              <h2 className="text-4xl font-black text-white">{totalInvoice.toLocaleString(undefined, {maximumFractionDigits: 2})} <small className="text-sm font-normal opacity-50">ج.م</small></h2>
            </div>
            
            <div className="flex gap-6 items-center">
              <div className="text-center border-r border-white/10 pr-6">
                <p className="text-[10px] font-black text-slate-400 mb-1">دفع نقدي (كاش)</p>
                <input 
                  type="number" 
                  step="any"
                  value={cashPaid} 
                  onChange={(e)=>setCashPaid(e.target.value)} 
                  className="bg-transparent text-2xl font-black text-emerald-400 w-24 text-center border-b-2 border-emerald-500/30 outline-none focus:border-emerald-500" 
                />
              </div>
              <button onClick={saveInvoice} disabled={isSaving || cart.length===0} className="bg-emerald-500 hover:bg-emerald-600 text-white px-10 py-4 rounded-xl font-black text-lg shadow-lg transition-all disabled:opacity-30">
                {isSaving ? "جاري الحفظ..." : "اعتماد وتحديث المخزن ✅"}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* مودال الصنف الجديد */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-6">
            <h3 className="text-xl font-black text-slate-900 border-r-4 border-emerald-500 pr-3">إضافة صنف جديد</h3>
            <div className="space-y-4">
              <input className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" placeholder="اسم الصنف" onChange={(e)=>setNewProd({...newProd, name: e.target.value})} />
              <select className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" value={newProd.unit} onChange={(e)=>setNewProd({...newProd, unit: e.target.value})}>
                <option value="كيلو">كيلو</option>
                <option value="جرام">جرام</option>
                <option value="لتر">لتر</option>
                <option value="ملي">ملي</option>
                <option value="عبوة">عبوة</option>
                <option value="شكارة">شكارة</option>
                <option value="طن">طن</option>
              </select>
              <div className="grid grid-cols-2 gap-4">
                <input type="number" step="any" className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" placeholder="سعر الشراء" onChange={(e)=>setNewProd({...newProd, purchase_price: e.target.value})} />
                <input type="number" step="any" className="p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" placeholder="سعر البيع" onChange={(e)=>setNewProd({...newProd, sale_price: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={async ()=>{
                  if(!newProd.name || !newProd.purchase_price) return alert("اكمل البيانات يا عمدة!");
                  const {data} = await supabase.from("products").insert([newProd]).select().single();
                  if(data) { setProducts([...products, data]); addToCart(data); setShowAddModal(false); }
                }} className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-black">حفظ وإضافة</button>
              <button onClick={()=>setShowAddModal(false)} className="px-6 py-4 bg-slate-100 rounded-xl font-black">إلغاء</button>
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