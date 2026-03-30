import React, { useState, useEffect } from 'react';
import Button from '../components/Button';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  ShoppingCart, 
  Users, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertCircle,
  FileText,
  Plus,
  PieChart,
  Wallet,
  AlertTriangle,
  CreditCard,
  RotateCcw,
  Sparkles,
  Lightbulb,
  Zap
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Product, Invoice } from '../types';
import { translations } from '../translations';
import { motion } from 'motion/react';
import { getCurrencySymbol } from '../utils/currency';
import { getCollection, subscribeToCollection } from '../services/accountingService';
import { generateSmartInsights } from '../services/gemini';

interface Props {
  lang: 'ar' | 'en';
  profile: any;
  setActiveTab: (tab: string) => void;
}

export default function DashboardHome({ lang, profile, setActiveTab }: Props) {
  const t = translations[lang];
  const currencySymbol = getCurrencySymbol(profile?.currency, lang);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalPurchases: 0,
    totalProducts: 0,
    totalInvoices: 0,
    totalPurchaseInvoices: 0,
    inventoryValue: 0,
    lowStockCount: 0,
    expiredCount: 0,
    treasuryBalance: 0
  });
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [expiryAlerts, setExpiryAlerts] = useState<Product[]>([]);
  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    if (!profile?.companyId) return;

    let unsubProducts: (() => void) | null = null;
    let unsubInvoices: (() => void) | null = null;
    let unsubAccounts: (() => void) | null = null;

    // Add a small delay to ensure Firestore is fully initialized and avoid assertion failures
    const timeoutId = setTimeout(() => {
      unsubProducts = subscribeToCollection<Product>(profile.companyId, 'products', (data) => {
        setProducts(data);
      });

      unsubInvoices = subscribeToCollection<Invoice>(profile.companyId, 'invoices', (data) => {
        setInvoices(data);
      });

      unsubAccounts = subscribeToCollection<any>(profile.companyId, 'accounts', (data) => {
        setAccounts(data);
      });
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      if (unsubProducts) unsubProducts();
      if (unsubInvoices) unsubInvoices();
      if (unsubAccounts) unsubAccounts();
    };
  }, [profile?.companyId]);

  useEffect(() => {
    if (products.length >= 0 || invoices.length >= 0 || accounts.length >= 0) {
      updateStats(products, invoices, accounts);
    }
  }, [products, invoices, accounts, lang]);

  const updateStats = async (products: Product[], invoices: Invoice[], accounts: any[]) => {
    // Stats
    const totalProducts = products.length;
    const inventoryValue = products.reduce((sum: number, p: Product) => sum + (p.purchasePrice * (p.quantity || 0)), 0);
    const lowStock = products.filter((p: Product) => (p.quantity || 0) <= (p.minStock || 5));
    
    const treasuryBalance = accounts
      .filter((a: any) => a.type === 'Asset' && (a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')))
      .reduce((sum: number, a: any) => sum + (a.balance || 0), 0);
    
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const expired = products.filter((p: Product) => p.expiryDate && new Date(p.expiryDate) < today);
    const nearExpiry = products.filter((p: Product) => {
      if (!p.expiryDate) return false;
      const expiry = new Date(p.expiryDate);
      return expiry >= today && expiry <= thirtyDaysFromNow;
    });

    const salesInvoices = invoices.filter(inv => inv.type === 'sales');
    const purchaseInvoices = invoices.filter(inv => inv.type === 'purchase');
    
    const totalSales = salesInvoices.reduce((sum: number, inv: Invoice) => sum + (inv.total || 0), 0);
    const totalPurchases = purchaseInvoices.reduce((sum: number, inv: Invoice) => sum + (inv.total || 0), 0);
    const totalInvoices = salesInvoices.length;
    const totalPurchaseInvoices = purchaseInvoices.length;

    setStats({
      totalSales,
      totalPurchases,
      totalProducts,
      totalInvoices,
      totalPurchaseInvoices,
      inventoryValue,
      lowStockCount: lowStock.length,
      expiredCount: expired.length,
      treasuryBalance
    });

    setLowStockProducts(lowStock.slice(0, 5));
    setExpiryAlerts([...expired, ...nearExpiry].sort((a, b) => {
      if (!a.expiryDate || !b.expiryDate) return 0;
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    }).slice(0, 5));
    setRecentInvoices(invoices.sort((a: Invoice, b: Invoice) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5));

    // Prepare chart data (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const dailyData = last7Days.map(date => {
      const daySales = invoices
        .filter((inv: Invoice) => inv.date.startsWith(date))
        .reduce((sum: number, inv: Invoice) => sum + (inv.total || 0), 0);
      return {
        name: new Date(date).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'short' }),
        sales: daySales,
        expenses: daySales * 0.6 // Mock expenses for now
      };
    });
    setChartData(dailyData);

    // Fetch AI Insights
    setIsInsightsLoading(true);
    try {
      const insights = await generateSmartInsights({
        stats: { totalSales, totalProducts, inventoryValue, lowStockCount: lowStock.length, expiredCount: expired.length },
        recentSales: invoices.slice(0, 10),
        lowStock: lowStock.slice(0, 5)
      }, lang);
      setAiInsights(insights);
    } catch (e) {
      console.error("Failed to fetch AI insights", e);
    } finally {
      setIsInsightsLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-10">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatCard 
          title={lang === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'} 
          value={`${stats.totalSales.toLocaleString()} ${currencySymbol}`} 
          icon={<TrendingUp className="w-6 h-6" />} 
          trend={lang === 'ar' ? `${stats.totalInvoices} فاتورة` : `${stats.totalInvoices} Invoices`}
          color="primary"
          delay={0}
        />
        <StatCard 
          title={lang === 'ar' ? 'إجمالي المشتريات' : 'Total Purchases'} 
          value={`${stats.totalPurchases.toLocaleString()} ${currencySymbol}`} 
          icon={<TrendingDown className="w-6 h-6" />} 
          trend={lang === 'ar' ? `${stats.totalPurchaseInvoices} فاتورة` : `${stats.totalPurchaseInvoices} Invoices`}
          color="red"
          delay={0.1}
        />
        <StatCard 
          title={lang === 'ar' ? 'رصيد الخزينة' : 'Treasury Balance'} 
          value={`${stats.treasuryBalance.toLocaleString()} ${currencySymbol}`} 
          icon={<Wallet className="w-6 h-6" />} 
          trend="+5.4%"
          color="primary"
          delay={0.2}
        />
        <StatCard 
          title={t.inventoryValue} 
          value={`${stats.inventoryValue.toLocaleString()} ${currencySymbol}`} 
          icon={<Package className="w-6 h-6" />} 
          trend="+3.2%"
          color="zinc"
          delay={0.3}
        />
      </div>

      {/* Quick Actions & Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 bg-white dark:bg-zinc-900 p-10 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm"
        >
          <h3 className="text-2xl font-black tracking-tight mb-8">{lang === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { id: 'invoices', label: lang === 'ar' ? 'فاتورة مبيعات' : 'Sales Invoice', icon: <Plus className="w-5 h-5" />, color: 'bg-primary/10 text-primary' },
              { id: 'purchases', label: lang === 'ar' ? 'فاتورة مشتريات' : 'Purchase Invoice', icon: <ShoppingCart className="w-5 h-5" />, color: 'bg-blue-500/10 text-blue-500' },
              { id: 'inventory', label: lang === 'ar' ? 'إضافة منتج' : 'Add Product', icon: <Package className="w-5 h-5" />, color: 'bg-purple-500/10 text-purple-500' },
              { id: 'treasury', label: lang === 'ar' ? 'تسجيل مصروف' : 'Add Expense', icon: <DollarSign className="w-5 h-5" />, color: 'bg-red-500/10 text-red-500' },
            ].map((action) => (
              <Button
                key={action.id}
                onClick={() => setActiveTab(action.id)}
                variant="secondary"
                className="flex flex-col items-center gap-4 p-6 h-auto border-zinc-100 dark:border-zinc-800 hover:border-primary/50 hover:bg-primary/5 group"
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${action.color}`}>
                  {action.icon}
                </div>
                <span className="text-sm font-black text-center">{action.label}</span>
              </Button>
            ))}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary text-white p-10 rounded-[3rem] shadow-2xl shadow-primary/20 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="relative z-10">
            <h3 className="text-xl font-black mb-8 opacity-80">{lang === 'ar' ? 'الملخص المالي' : 'Financial Summary'}</h3>
            <div className="space-y-8">
              <div>
                <p className="text-sm font-bold opacity-60 mb-1">{lang === 'ar' ? 'صافي الربح التقديري' : 'Estimated Net Profit'}</p>
                <p className="text-4xl font-black tracking-tighter">{(stats.totalSales - stats.totalPurchases).toLocaleString()} <span className="text-lg opacity-60">{currencySymbol}</span></p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">{lang === 'ar' ? 'المبيعات' : 'Sales'}</p>
                  <p className="text-xl font-black">{stats.totalSales.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-1">{lang === 'ar' ? 'المشتريات' : 'Purchases'}</p>
                  <p className="text-xl font-black">{stats.totalPurchases.toLocaleString()}</p>
                </div>
              </div>
              <Button 
                onClick={() => setActiveTab('reports')}
                variant="secondary"
                className="w-full bg-white text-primary hover:bg-zinc-100"
                size="lg"
                leftIcon={<PieChart className="w-5 h-5" />}
              >
                {lang === 'ar' ? 'عرض التقارير التفصيلية' : 'View Detailed Reports'}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* AI Smart Insights */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-primary/5 to-purple-500/5 dark:from-primary/10 dark:to-purple-500/10 p-10 rounded-[3rem] border border-primary/10 dark:border-primary/20"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black tracking-tight">{lang === 'ar' ? 'رؤى ذكية من الذكاء الاصطناعي' : 'AI Smart Insights'}</h3>
            <p className="text-sm text-zinc-500 font-medium">{lang === 'ar' ? 'توصيات مخصصة لتحسين عملك' : 'Personalized recommendations to optimize your business'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isInsightsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-white/50 dark:bg-zinc-800/50 rounded-2xl animate-pulse border border-zinc-200 dark:border-zinc-700" />
            ))
          ) : (
            aiInsights.map((insight, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${
                    insight.type === 'warning' ? 'bg-red-50 text-red-500 dark:bg-red-900/20' :
                    insight.type === 'success' ? 'bg-green-50 text-green-500 dark:bg-green-900/20' :
                    'bg-zinc-50 text-zinc-500 dark:bg-zinc-800/20'
                  }`}>
                    {insight.icon === 'trending' ? <TrendingUp className="w-5 h-5" /> :
                     insight.icon === 'package' ? <Package className="w-5 h-5" /> :
                     <Lightbulb className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm mb-1">{insight.title}</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed">{insight.description}</p>
                  </div>
                </div>
              </motion.div>
            ))
          )}
          {!isInsightsLoading && aiInsights.length === 0 && (
            <div className="col-span-3 text-center py-6 text-zinc-400">
              <p className="text-sm">{lang === 'ar' ? 'لا توجد رؤى متاحة حالياً' : 'No insights available at the moment'}</p>
            </div>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Sales Chart */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 bg-white dark:bg-zinc-900 p-10 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm"
        >
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-2xl font-black tracking-tight mb-1">{lang === 'ar' ? 'نظرة عامة على المبيعات' : 'Sales Overview'}</h3>
              <p className="text-sm text-zinc-500 font-medium">{lang === 'ar' ? 'أداء المبيعات خلال الأسبوع الماضي' : 'Sales performance for the last 7 days'}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm">Weekly</Button>
              <Button variant="primary" size="sm">Monthly</Button>
            </div>
          </div>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                  dx={-10}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '20px', 
                    border: 'none', 
                    boxShadow: '0 20px 50px -10px rgb(0 0 0 / 0.1)' 
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="var(--color-primary)" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Right Column */}
        <div className="space-y-10">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-zinc-900 p-10 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm"
          >
            <h3 className="text-2xl font-black mb-8 tracking-tight">{t.quickActions}</h3>
            <div className="grid grid-cols-2 gap-4">
              {['admin', 'accountant', 'cashier'].includes(profile?.role) && (
                <QuickAction icon={<Plus />} label={lang === 'ar' ? 'إنشاء فاتورة' : 'New Invoice'} color="primary" onClick={() => setActiveTab('invoices')} />
              )}
              {['admin', 'accountant', 'cashier'].includes(profile?.role) && (
                <QuickAction icon={<Package />} label={lang === 'ar' ? 'إضافة منتج' : 'Add Product'} color="zinc" onClick={() => setActiveTab('inventory')} />
              )}
              {['admin', 'accountant'].includes(profile?.role) && (
                <QuickAction icon={<CreditCard />} label={lang === 'ar' ? 'إضافة شيك' : 'Add Cheque'} color="zinc" onClick={() => setActiveTab('cheques')} />
              )}
              {['admin', 'accountant'].includes(profile?.role) && (
                <QuickAction icon={<RotateCcw />} label={lang === 'ar' ? 'المرتجعات' : 'Returns'} color="amber" onClick={() => setActiveTab('returns')} />
              )}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white dark:bg-zinc-900 p-10 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm"
          >
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-2xl font-black tracking-tight">{lang === 'ar' ? 'تنبيهات الصلاحية' : 'Expiry Alerts'}</h3>
              <Button 
                variant="secondary"
                size="sm"
                onClick={() => setActiveTab('inventory')}
              >
                {lang === 'ar' ? 'عرض الكل' : 'View All'}
              </Button>
            </div>
            <div className="space-y-6">
              {expiryAlerts.map((product) => {
                const isExpired = new Date(product.expiryDate!) < new Date();
                return (
                  <div key={product.id} className="flex items-center justify-between group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isExpired ? 'bg-red-50 text-red-500 dark:bg-red-900/20' : 'bg-amber-50 text-amber-500 dark:bg-amber-900/20'}`}>
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-zinc-900 dark:text-white">{product.name}</div>
                        <div className={`text-[10px] font-black uppercase tracking-widest ${isExpired ? 'text-red-500' : 'text-amber-500'}`}>
                          {isExpired ? (lang === 'ar' ? 'منتهي' : 'Expired') : (lang === 'ar' ? 'قارب على الانتهاء' : 'Near Expiry')}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-zinc-500">{product.expiryDate}</div>
                    </div>
                  </div>
                );
              })}
              {expiryAlerts.length === 0 && (
                <div className="text-center py-6 text-zinc-400 opacity-50">
                  <Package className="w-10 h-10 mx-auto mb-3" />
                  <p className="text-xs font-bold">{lang === 'ar' ? 'لا توجد تنبيهات صلاحية' : 'No expiry alerts'}</p>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-zinc-900 p-10 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm"
          >
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-2xl font-black tracking-tight">{lang === 'ar' ? 'آخر الفواتير' : 'Recent Invoices'}</h3>
              <Button 
                variant="secondary"
                size="sm"
                onClick={() => setActiveTab('invoices')}
              >
                {lang === 'ar' ? 'عرض الكل' : 'View All'}
              </Button>
            </div>
            <div className="space-y-8">
              {recentInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between group cursor-pointer">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-zinc-900 dark:text-white group-hover:text-primary transition-colors">{inv.number}</div>
                      <div className="text-xs text-zinc-500 font-medium">{inv.customerName}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-zinc-900 dark:text-white">{currencySymbol} {inv.total.toLocaleString()}</div>
                    <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">{new Date(inv.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              ))}
              {recentInvoices.length === 0 && (
                <div className="text-center py-10 text-zinc-400 opacity-50">
                  <FileText className="w-12 h-12 mx-auto mb-4" />
                  <p className="font-bold">{lang === 'ar' ? 'لا توجد فواتير مؤخراً' : 'No recent invoices'}</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend, color, delay }: any) {
  const colorClasses: any = {
    primary: 'bg-primary/10 dark:bg-primary/20 text-primary',
    zinc: 'bg-zinc-50 dark:bg-zinc-800/20 text-zinc-600',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600',
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl hover:shadow-zinc-200/20 dark:hover:shadow-zinc-950/40 transition-all group"
    >
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-2xl ${colorClasses[color]} group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold ${trend.startsWith('+') ? 'text-primary' : 'text-red-500'}`}>
          {trend}
          {trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        </div>
      </div>
      <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2">{title}</div>
      <div className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">{value}</div>
    </motion.div>
  );
}

function QuickAction({ icon, label, color, onClick }: any) {
  const colorClasses: any = {
    primary: 'bg-primary/10 dark:bg-primary/20 text-primary hover:bg-primary hover:text-white border-primary/10',
    zinc: 'bg-zinc-50 dark:bg-zinc-800/20 text-zinc-600 hover:bg-zinc-600 hover:text-white border-zinc-100',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 hover:bg-amber-600 hover:text-white border-amber-100',
  };

  return (
    <Button 
      onClick={onClick}
      variant="secondary"
      className={`flex flex-col items-center justify-center p-6 h-auto transition-all duration-500 gap-4 group border hover:shadow-2xl hover:shadow-zinc-200/50 dark:hover:shadow-zinc-950/50 ${colorClasses[color]}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-800 flex items-center justify-center shadow-sm group-hover:bg-white/20 transition-all duration-500 relative">
        {React.cloneElement(icon, { className: "w-6 h-6" })}
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 group-hover:scale-110 transition-transform">
          <Plus className="w-3 h-3" />
        </div>
      </div>
      <span className="text-sm font-black tracking-tight">{label}</span>
    </Button>
  );
}
