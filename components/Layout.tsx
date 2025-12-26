
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 glass border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              {/* Nuova Icona Compressione */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 14h6m0 0v6m0-6l-7 7m17-7h-6m0 0v6m0-6l7 7M4 10h6m0 0V4m0 6l-7-7m17 7h-6m0 0V4m0 6l7-7" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight text-slate-900 leading-none">
                FLEXI <span className="text-indigo-600">COMPRESS</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-1">By Mirko Piazza</span>
            </div>
          </div>
          
          <div className="hidden sm:block">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">Professional Edition</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
        {children}
      </main>

      <footer className="py-12 border-t border-slate-100 bg-white mt-auto">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
             <span className="text-sm font-bold text-slate-900 tracking-tight">FLEXI COMPRESS</span>
             <span className="text-slate-300 mx-2">|</span>
             <span className="text-sm font-medium text-slate-500">Creato con passione da <span className="text-indigo-600 font-bold">Mirko Piazza</span></span>
          </div>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
            Processing Locale al 100% • Sicurezza Garantita
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
