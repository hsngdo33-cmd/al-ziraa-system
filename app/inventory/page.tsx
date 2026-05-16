"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // حالة لمتابعة الصنف اللي بيتم تعديله حالياً
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const [newProduct, setNewProduct] = useState({
    name: "", unit: "كيلو", purchase_price: "", sale_price: "", stock_quantity: ""
  });

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from("products").select("*").order("name", { ascending: true });
    setProducts(data || []);
    setLoading(false);
  };

  // تشغيل وضع التعديل لسطر معين
  const startEdit = (product: any) => {
    setEditingId(product.id);
    setEditForm({ ...product });
  };

  // حفظ التعديلات
  const saveEdit = async () => {
    const { error } = await supabase
      .from("products")
      .update({
        name: editForm.name,
        unit: editForm.unit,
        purchase_price: Number(editForm.purchase_price),
        sale_price: Number(editForm.sale_price),
        stock_quantity: Number(editForm.stock_quantity)
      })
      .eq("id", editingId);

    if (error) {
      alert("خطأ في التحديث: " + error.message);
    } else {
      setEditingId(null);
      fetchProducts();
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.name) return alert("يرجى كتابة اسم الصنف");
    await supabase.from("products").insert([{
      ...newProduct,
      purchase_price: Number(newProduct.purchase_price) || 0,
      sale_price: Number(newProduct.sale_price) || 0,
      stock_quantity: Number(newProduct.stock_quantity) || 0,
    }]);
    setIsModalOpen(false);
    setNewProduct({ name: "", unit: "كيلو", purchase_price: "", sale_price: "", stock_quantity: "" });
    fetchProducts();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-right text-black font-sans" dir="rtl">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8 bg-white p-5 rounded-2xl shadow-sm border-r-8 border-emerald-600">
          <div>
            <h1 className="text-2xl font-bold text-black">إدارة وتحكم المخزن</h1>
            <p className="text-slate-500 text-sm font-bold">تعديل مباشر للأسعار والكميات</p>
          </div>
          <div className="flex gap-3">
             <Link href="/" className="bg-slate-100 text-black px-5 py-2 rounded-xl text-sm font-bold border border-slate-200">🏠 الرئيسية</Link>
             <button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-emerald-700">+ إضافة صنف جديد</button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex gap-4">
          <input 
            type="text" placeholder="ابحث عن صنف..." 
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-black outline-none focus:border-emerald-500"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-900 text-white font-bold">
              <tr>
                <th className="p-4">اسم الصنف</th>
                <th className="p-4 text-center">الوحدة</th>
                <th className="p-4 text-center">الكمية</th>
                <th className="p-4 text-center">سعر الشراء</th>
                <th className="p-4 text-center">سعر البيع</th>
                <th className="p-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-black font-bold">
              {products.filter(p => p.name.includes(searchTerm)).map((p) => (
                <tr key={p.id} className={`${editingId === p.id ? 'bg-blue-50' : 'hover:bg-slate-50'} transition-colors`}>
                  {editingId === p.id ? (
                    <>
                      <td className="p-2"><input className="w-full p-2 border rounded border-blue-400" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></td>
                      <td className="p-2">
                        <select className="w-full p-2 border rounded border-blue-400" value={editForm.unit} onChange={e => setEditForm({...editForm, unit: e.target.value})}>
                          <option>كيلو</option><option>لتر</option><option>مللي</option><option>جرام</option><option>عبوة</option><option>كرتونة</option><option>شكارة</option>
                        </select>
                      </td>
                      <td className="p-2"><input type="number" className="w-full p-2 border rounded border-blue-400 text-center" value={editForm.stock_quantity} onChange={e => setEditForm({...editForm, stock_quantity: e.target.value})} /></td>
                      <td className="p-2"><input type="number" className="w-full p-2 border rounded border-blue-400 text-center text-red-600" value={editForm.purchase_price} onChange={e => setEditForm({...editForm, purchase_price: e.target.value})} /></td>
                      <td className="p-2"><input type="number" className="w-full p-2 border rounded border-blue-400 text-center text-blue-600" value={editForm.sale_price} onChange={e => setEditForm({...editForm, sale_price: e.target.value})} /></td>
                      <td className="p-2 text-center flex gap-1 justify-center">
                        <button onClick={saveEdit} className="bg-emerald-500 text-white px-3 py-1 rounded-lg text-xs">حفظ ✅</button>
                        <button onClick={() => setEditingId(null)} className="bg-slate-400 text-white px-3 py-1 rounded-lg text-xs">إلغاء</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-4">{p.name}</td>
                      <td className="p-4 text-center text-slate-500">{p.unit}</td>
                      <td className={`p-4 text-center ${p.stock_quantity <= 5 ? 'text-red-600' : 'text-emerald-600'}`}>{p.stock_quantity}</td>
                      <td className="p-4 text-center">{p.purchase_price} ج.م</td>
                      <td className="p-4 text-center text-blue-600">{p.sale_price} ج.م</td>
                      <td className="p-4 text-center">
                        <button onClick={() => startEdit(p)} className="text-blue-600 hover:underline">✏️ تعديل</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* مودال الإضافة (نفس القديم) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-3xl w-full max-w-md shadow-2xl text-black">
            <h2 className="text-xl font-bold mb-6 text-center border-b pb-4 italic underline decoration-emerald-500">صنف جديد</h2>
            <div className="space-y-4">
              <input placeholder="الاسم" className="w-full p-3 bg-slate-50 border rounded-xl font-bold" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <select className="p-3 bg-slate-50 border rounded-xl font-bold" value={newProduct.unit} onChange={e => setNewProduct({...newProduct, unit: e.target.value})}>
                  <option>كيلو</option><option>لتر</option><option>مللي</option><option>جرام</option><option>عبوة</option><option>كرتونة</option><option>شكارة</option>
                </select>
                <input placeholder="الكمية" type="number" className="p-3 bg-slate-50 border rounded-xl font-bold" value={newProduct.stock_quantity} onChange={e => setNewProduct({...newProduct, stock_quantity: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="سعر الشراء" type="number" className="p-3 bg-slate-50 border rounded-xl font-bold text-red-600" value={newProduct.purchase_price} onChange={e => setNewProduct({...newProduct, purchase_price: e.target.value})} />
                <input placeholder="سعر البيع" type="number" className="p-3 bg-slate-50 border rounded-xl font-bold text-blue-600" value={newProduct.sale_price} onChange={e => setNewProduct({...newProduct, sale_price: e.target.value})} />
              </div>
              <button onClick={handleAddProduct} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg mt-4 transition-all hover:bg-emerald-700">تأكيد الإضافة ✅</button>
              <button onClick={() => setIsModalOpen(false)} className="w-full text-slate-400 text-xs font-bold mt-2">إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}