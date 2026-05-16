import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "نظام العمدة الزراعي",
  description: "إدارة احترافية متكاملة",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="h-full bg-[#f8fafc] text-slate-900 flex flex-col md:flex-row overflow-hidden">
        
        {/* الشريط الجانبي - يظهر فقط في الشاشات المتوسطة والكبيرة (md) */}
        <aside className="hidden md:flex group fixed right-0 top-0 h-full w-20 hover:w-64 bg-slate-900 text-slate-300 transition-all duration-500 z-50 shadow-2xl flex-col border-l border-slate-800">
          <div className="h-20 flex items-center justify-center border-b border-slate-800/50">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-2xl">🚜</div>
          </div>
          <nav className="flex-1 px-3 py-6 space-y-4">
            <SidebarItem href="/" icon="🏠" label="الرئيسية" />
            <SidebarItem href="/suppliers" icon="📦" label="الموردين" />
            <SidebarItem href="/customer" icon="👥" label="العملاء" />
            <SidebarItem href="/inventory" icon="🏗️" label="المخازن" />
          </nav>
        </aside>

        {/* الشريط السفلي للموبايل فقط - يختفي في الشاشات الكبيرة */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <MobileNavItem href="/" icon="🏠" label="الرئيسية" />
          <MobileNavItem href="/suppliers" icon="📦" label="الموردين" />
          <MobileNavItem href="/customer" icon="👥" label="العملاء" />
          <MobileNavItem href="/inventory" icon="🏗️" label="المخازن" />
        </nav>

        {/* المحتوى الرئيسي */}
        <main className="flex-1 md:mr-20 mb-20 md:mb-0 overflow-auto transition-all duration-500">
          <header className="h-16 md:h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-4 md:px-8 flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-bold text-slate-800">نظام العمدة</h2>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">ع</div>
          </header>
          
          <div className="p-4 md:p-8 max-w-6xl mx-auto">
            {children}
          </div>
        </main>

      </body>
    </html>
  );
}

// مكون زرار الكمبيوتر
function SidebarItem({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href} className="flex items-center p-3 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all duration-300 group/item relative overflow-hidden">
      <span className="text-xl min-w-[40px] flex justify-center">{icon}</span>
      <span className="mr-4 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">{label}</span>
    </Link>
  );
}

// مكون زرار الموبايل
function MobileNavItem({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1">
      <span className="text-xl">{icon}</span>
      <span className="text-[10px] font-medium text-slate-500">{label}</span>
    </Link>
  );
}