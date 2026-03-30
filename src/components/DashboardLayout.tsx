import React, { useState, useEffect } from 'react';
import { Shield, LayoutDashboard, Package, FileText, Users, Settings, LogOut, Menu, X, Moon, Sun, Globe, MessageSquare, Wallet, PieChart, Truck, Search, Bell, ChevronLeft, ChevronRight, ShoppingCart, BarChart as BarChartNavIcon, CreditCard, RotateCcw, UserCheck, ShieldAlert, Plus } from 'lucide-react';
import { translations } from '../translations';
import { UserProfile } from '../types';
import DashboardHome from '../pages/DashboardHome';
import Inventory from '../pages/Inventory';
import Accounting from '../pages/Accounting';
import Invoices from '../pages/Invoices';
import Purchases from '../pages/Purchases';
import AIAssistant from '../pages/AIAssistant';
import FloatingAIAssistant from './FloatingAIAssistant';
import Reports from '../pages/Reports';
import Cheques from '../pages/Cheques';
import Returns from '../pages/Returns';
import Treasury from '../pages/Treasury';
import Customers from '../pages/Customers';
import Suppliers from '../pages/Suppliers';
import SettingsPage from '../pages/Settings';
import UserManagement from '../pages/UserManagement';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import Button from './Button';

interface Props {
  lang: 'ar' | 'en';
  setLang: (l: 'ar' | 'en') => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  compactMode: boolean;
  setCompactMode: (c: boolean) => void;
  browserMode: boolean;
  setBrowserMode: (b: boolean) => void;
  profile: UserProfile | null;
  onSignOut: () => void;
}

export default function DashboardLayout({ 
  lang, setLang, theme, setTheme, 
  compactMode, setCompactMode, 
  browserMode, setBrowserMode, 
  profile, onSignOut 
}: Props) {
  const { isImpersonating, stopImpersonating, originalProfile, hasPermission, loading } = useAuth();
  const t = translations[lang];
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('makhzanak-sidebar-open');
    if (saved !== null) return saved === 'true';
    return window.innerWidth >= 1024;
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isFabOpen, setIsFabOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('makhzanak-sidebar-open', isSidebarOpen.toString());
  }, [isSidebarOpen]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);

  useEffect(() => {
    const handleResize = () => {
      const isLargeScreen = window.innerWidth >= 1024;
      setIsMobile(!isLargeScreen);
      if (!isLargeScreen) {
        setIsSidebarOpen(false);
      } else {
        const saved = localStorage.getItem('makhzanak-sidebar-open');
        setIsSidebarOpen(saved === null ? true : saved === 'true');
      }
    };
    
    // Initial check
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading || !profile) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-zinc-950">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-2xl font-black text-primary font-sans"
        >
          {lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}
        </motion.div>
      </div>
    );
  }

  const menuItems = [
    { id: 'dashboard', icon: <LayoutDashboard />, label: t.dashboard, permission: 'view_dashboard' },
    { id: 'inventory', icon: <Package />, label: t.inventory, permission: 'view_products' },
    { id: 'accounting', icon: <PieChart />, label: t.chartOfAccounts, permission: 'view_reports' },
    { id: 'invoices', icon: <FileText />, label: t.latestInvoices, permission: 'create_invoices' },
    { id: 'purchases', icon: <ShoppingCart />, label: lang === 'ar' ? 'المشتريات' : 'Purchases', permission: 'create_invoices' },
    { id: 'treasury', icon: <Wallet />, label: t.treasury, permission: 'access_treasury' },
    { id: 'customers', icon: <Users />, label: t.customers, permission: 'view_customers' },
    { id: 'suppliers', icon: <Truck />, label: t.suppliers, permission: 'access_suppliers' },
    { id: 'cheques', icon: <CreditCard />, label: lang === 'ar' ? 'الشيكات' : 'Cheques', permission: 'view_reports' },
    { id: 'returns', icon: <RotateCcw />, label: lang === 'ar' ? 'المرتجعات' : 'Returns', permission: 'create_invoices' },
    { id: 'reports', icon: <BarChartNavIcon />, label: t.reportsSystem, permission: 'view_reports' },
    { id: 'users', icon: <Shield />, label: t.userManagement, roles: ['admin'] },
    { id: 'settings', icon: <Settings />, label: t.settings, permission: 'access_settings' },
  ].filter(item => {
    if (item.roles) return item.roles.includes(profile?.role || 'cashier');
    if (item.permission) return hasPermission(item.permission as any);
    return true;
  });

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardHome lang={lang} profile={profile} setActiveTab={setActiveTab} />;
      case 'inventory': return <Inventory lang={lang} profile={profile} />;
      case 'accounting': return <Accounting lang={lang} profile={profile} />;
      case 'invoices': return <Invoices lang={lang} profile={profile} />;
      case 'purchases': return <Purchases lang={lang} profile={profile} />;
      case 'treasury': return <Treasury lang={lang} profile={profile} />;
      case 'customers': return <Customers lang={lang} profile={profile} />;
      case 'suppliers': return <Suppliers lang={lang} profile={profile} />;
      case 'cheques': return <Cheques lang={lang} profile={profile} />;
      case 'returns': return <Returns lang={lang} profile={profile} />;
      case 'reports': return <Reports lang={lang} profile={profile} />;
      case 'users': return <UserManagement lang={lang} profile={profile} />;
      case 'settings': return (
        <SettingsPage 
          lang={lang} 
          profile={profile} 
          setLang={setLang} 
          setTheme={setTheme} 
          theme={theme}
          compactMode={compactMode}
          setCompactMode={setCompactMode}
          browserMode={browserMode}
          setBrowserMode={setBrowserMode}
        />
      );
      default: return <div className="p-8 text-center opacity-50">Coming Soon: {activeTab}</div>;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]">
      {/* Impersonation Banner */}
      <AnimatePresence>
        {isImpersonating && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-white px-4 py-2 flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
              <span className="text-sm font-black tracking-tight">
                {t.impersonationWarning.replace('{name}', profile?.name || profile?.displayName || '')}
              </span>
            </div>
            <Button 
              onClick={stopImpersonating}
              variant="secondary"
              size="sm"
              className="bg-white text-amber-600 hover:bg-amber-50"
              leftIcon={<UserCheck className="w-4 h-4" />}
            >
              {t.exitImpersonation}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button - Moved above AI Assistant on the same side */}
      <div className={`fixed bottom-24 ${lang === 'ar' ? 'left-6' : 'right-6'} z-[160]`}>
        <div className="relative group">
          <AnimatePresence>
            {isFabOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 20 }}
                className={`absolute bottom-20 ${lang === 'ar' ? 'left-0' : 'right-0'} flex flex-col gap-3 items-start`}
              >
                <Button 
                  onClick={() => { setActiveTab('invoices'); setIsFabOpen(false); }}
                  variant="secondary"
                  className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl shadow-xl border border-zinc-100 dark:border-zinc-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 whitespace-nowrap group/item"
                >
                  <span className="font-bold text-sm">{lang === 'ar' ? 'فاتورة مبيعات' : 'Sales Invoice'}</span>
                  <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl flex items-center justify-center group-hover/item:scale-110 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                </Button>
                <Button 
                  onClick={() => { setActiveTab('inventory'); setIsFabOpen(false); }}
                  variant="secondary"
                  className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl shadow-xl border border-zinc-100 dark:border-zinc-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 whitespace-nowrap group/item"
                >
                  <span className="font-bold text-sm">{lang === 'ar' ? 'إضافة منتج' : 'Add Product'}</span>
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl flex items-center justify-center group-hover/item:scale-110 transition-transform">
                    <Package className="w-5 h-5" />
                  </div>
                </Button>
                <Button 
                  onClick={() => { setActiveTab('treasury'); setIsFabOpen(false); }}
                  variant="secondary"
                  className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl shadow-xl border border-zinc-100 dark:border-zinc-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 whitespace-nowrap group/item"
                >
                  <span className="font-bold text-sm">{lang === 'ar' ? 'تسجيل مصروف' : 'Add Expense'}</span>
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-xl flex items-center justify-center group-hover/item:scale-110 transition-transform">
                    <Wallet className="w-5 h-5" />
                  </div>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          
          <Button
            onClick={() => setIsFabOpen(!isFabOpen)}
            className={`w-16 h-16 rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center transition-all duration-500 hover:scale-110 active:scale-95 z-[70] ${isFabOpen ? 'rotate-45 bg-zinc-900' : 'bg-primary text-white'}`}
          >
            <Plus className="w-8 h-8" />
          </Button>
        </div>
      </div>

      <FloatingAIAssistant lang={lang} profile={profile} />

      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-[140] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 280 : 88,
          x: isMobile ? (isSidebarOpen ? 0 : (lang === 'ar' ? 280 : -280)) : 0,
          marginTop: isImpersonating ? 48 : 0
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={`fixed lg:relative bg-[var(--color-card-light)] dark:bg-[var(--color-card-dark)] border-r border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] flex flex-col z-[150] lg:z-50 transition-colors duration-300 h-full ${lang === 'ar' ? 'right-0' : 'left-0'}`}
      >
        <div className="h-20 flex items-center px-6 gap-4">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20 flex-shrink-0 group-hover:rotate-12 transition-transform duration-500">
            <Package className="w-6 h-6" />
          </div>
          {isSidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col leading-none"
            >
              <span className="text-xl font-black text-[var(--color-text-primary-light)] dark:text-[var(--color-text-primary-dark)] tracking-tighter">
                {lang === 'ar' ? 'مخزنك' : 'Makhzanak'}
              </span>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                SaaS Platform
              </span>
            </motion.div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5 custom-scrollbar">
          {menuItems.map((item) => (
            <Button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              variant={activeTab === item.id ? 'primary' : 'secondary'}
              className={`w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-300 group ${
                activeTab === item.id 
                  ? 'shadow-xl shadow-primary/20' 
                  : 'bg-transparent text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)] hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-[var(--color-text-primary-light)] dark:hover:text-[var(--color-text-primary-dark)]'
              }`}
            >
              <div className={`w-6 h-6 flex items-center justify-center transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'}`}>
                {item.icon}
              </div>
              {isSidebarOpen && (
                <motion.span 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="font-bold text-sm tracking-tight"
                >
                  {item.label}
                </motion.span>
              )}
            </Button>
          ))}
        </nav>

        <div className="p-4 border-t border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] space-y-1">
          <Button 
            onClick={onSignOut}
            variant="secondary"
            className="w-full flex items-center gap-4 p-3.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl bg-transparent group"
          >
            <div className="w-6 h-6 flex items-center justify-center group-hover:-translate-x-1 transition-transform">
              <LogOut className="w-5 h-5" />
            </div>
            {isSidebarOpen && <span className="text-sm font-bold">{t.logout}</span>}
          </Button>
        </div>

        {/* Toggle Button */}
        <Button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          variant="secondary"
          size="icon"
          className="absolute -right-3 top-24 w-6 h-6 bg-white dark:bg-zinc-800 border border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] rounded-full flex items-center justify-center shadow-md hover:scale-110 z-40 hidden lg:flex"
        >
          {isSidebarOpen ? (
            lang === 'ar' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
          ) : (
            lang === 'ar' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          )}
        </Button>
      </motion.aside>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col overflow-hidden ${isImpersonating ? 'pt-12' : ''}`}>
        <header className="h-20 bg-white/80 dark:bg-[var(--color-card-dark)]/80 backdrop-blur-xl border-b border-[var(--color-border-light)] dark:border-[var(--color-border-dark)] flex items-center justify-between px-4 md:px-8 z-[130]">
          <div className="flex items-center gap-4 md:gap-8 flex-1">
            <Button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              variant="secondary"
              size="icon"
              className="lg:hidden p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl bg-transparent"
            >
              <Menu className="w-6 h-6" />
            </Button>
            <h2 className="text-lg md:text-xl font-black text-[var(--color-text-primary-light)] dark:text-[var(--color-text-primary-dark)] tracking-tight truncate">
              {menuItems.find(i => i.id === activeTab)?.label}
            </h2>
            
            <div className="relative max-w-md w-full hidden xl:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="text" 
                placeholder={t.searchProduct}
                className="w-full pl-11 pr-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
              <Button 
                onClick={() => setLang('ar')}
                variant={lang === 'ar' ? 'primary' : 'secondary'}
                size="sm"
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${lang === 'ar' ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm' : 'bg-transparent text-zinc-500'}`}
              >
                العربية
              </Button>
              <Button 
                onClick={() => setLang('en')}
                variant={lang === 'en' ? 'primary' : 'secondary'}
                size="sm"
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${lang === 'en' ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm' : 'bg-transparent text-zinc-500'}`}
              >
                English
              </Button>
            </div>

            <Button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              variant="secondary"
              size="icon"
              className="p-2.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl bg-transparent"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </Button>

            <Button 
              variant="secondary"
              size="icon"
              className="relative p-2.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl bg-transparent"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-[var(--color-bg-dark)]" />
            </Button>
            
            <div className="h-8 w-px bg-[var(--color-border-light)] dark:bg-[var(--color-border-dark)] hidden md:block" />

            <div className="flex items-center gap-2 md:gap-4 group cursor-pointer">
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-sm font-black text-[var(--color-text-primary-light)] dark:text-[var(--color-text-primary-dark)] group-hover:text-primary transition-colors">{profile?.name || profile?.displayName}</span>
                <span className="text-[10px] font-bold text-[var(--color-text-secondary-light)] dark:text-[var(--color-text-secondary-dark)] uppercase tracking-widest">{profile?.role}</span>
              </div>
              <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary flex items-center justify-center font-black text-lg shadow-inner group-hover:scale-105 transition-transform">
                {(profile?.name || profile?.displayName)?.[0] || 'U'}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)] custom-scrollbar">
          <div className="max-w-[1400px] mx-auto h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="h-full p-4 md:px-8 md:py-6"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

function BarChartIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bar-chart-3"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>;
}
