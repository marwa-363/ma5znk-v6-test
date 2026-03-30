import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowRight, 
  BarChart3, 
  Package, 
  ShieldCheck, 
  Mic, 
  ScanBarcode, 
  Users, 
  Globe,
  CheckCircle2,
  FileText,
  PieChart,
  Zap,
  Layout,
  Moon,
  Sun
} from 'lucide-react';
import { translations } from '../translations';
import AuthModal from '../components/AuthModal';
import Button from '../components/Button';

interface Props {
  lang: 'ar' | 'en';
  setLang: (l: 'ar' | 'en') => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
}

export default function LandingPage({ lang, setLang, theme, setTheme }: Props) {
  const t = translations[lang];
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <div className="overflow-x-hidden font-sans selection:bg-primary/10 selection:text-primary">
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        lang={lang} 
      />
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-2xl border-b border-zinc-200/50 dark:border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <span className="text-2xl font-black text-primary tracking-tighter flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                <Package className="w-5 h-5" />
              </div>
              {t.brand}
            </span>
            <div className="hidden lg:flex items-center gap-8 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              <a href="#features" className="hover:text-primary transition-all duration-300">{t.features}</a>
              <a href="#how-it-works" className="hover:text-primary transition-all duration-300">{t.howItWorks}</a>
              <a href="#pricing" className="hover:text-primary transition-all duration-300">{t.pricing}</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              variant="secondary"
              size="icon"
              className="p-2.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl bg-transparent"
              title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </Button>
            <Button 
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              variant="secondary"
              className="px-4 py-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 bg-transparent text-sm font-bold"
              leftIcon={<Globe className="w-4 h-4" />}
            >
              <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
            </Button>
            <Button 
              onClick={() => setIsAuthModalOpen(true)}
              variant="secondary"
              className="hidden sm:block text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:text-primary bg-transparent"
            >
              {t.login}
            </Button>
            <Button 
              onClick={() => setIsAuthModalOpen(true)}
              variant="primary"
              className="px-6 py-2.5 rounded-full text-sm font-bold shadow-xl shadow-primary/20"
            >
              {t.startNow}
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-48 pb-32 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-primary/20 blur-[120px] rounded-full" 
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.3, 1],
              rotate: [0, -90, 0],
              opacity: [0.1, 0.15, 0.1]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[120px] rounded-full" 
          />
        </div>

        <div className="max-w-7xl mx-auto text-center relative">
          {/* Floating Elements */}
          <motion.div
            animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-20 -left-20 w-32 h-32 bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-100 dark:border-zinc-800 flex items-center justify-center hidden xl:flex"
          >
            <BarChart3 className="w-12 h-12 text-primary" />
          </motion.div>
          <motion.div
            animate={{ y: [0, 20, 0], rotate: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute top-40 -right-20 w-24 h-24 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 flex items-center justify-center hidden xl:flex"
          >
            <PieChart className="w-10 h-10 text-emerald-500" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 text-xs font-bold tracking-widest text-primary uppercase bg-primary/5 dark:bg-primary/20 rounded-full border border-primary/10 dark:border-primary/80">
              <Zap className="w-3 h-3" />
              {t.tagline}
            </div>
            <h1 className="text-6xl md:text-8xl font-black text-zinc-900 dark:text-white mb-8 leading-[1.1] tracking-tight">
              {t.heroTitle}
            </h1>
            <p className="text-xl md:text-2xl text-zinc-500 dark:text-zinc-400 max-w-3xl mx-auto mb-12 leading-relaxed font-medium">
              {t.heroSub}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Button 
                onClick={() => setIsAuthModalOpen(true)}
                variant="primary"
                className="group w-full sm:w-auto px-10 py-5 rounded-2xl text-lg font-bold shadow-2xl shadow-primary/30"
                rightIcon={<ArrowRight className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${lang === 'ar' ? 'rotate-180 group-hover:-translate-x-1' : ''}`} />}
              >
                {t.startNow}
              </Button>
              <Button 
                onClick={() => {
                  const pricing = document.getElementById('pricing');
                  pricing?.scrollIntoView({ behavior: 'smooth' });
                }}
                variant="secondary"
                className="w-full sm:w-auto px-10 py-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-2xl text-lg font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                {t.requestDemo}
              </Button>
            </div>
          </motion.div>

          {/* Dashboard Preview Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 60 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="mt-24 relative group"
          >
            <div className="absolute inset-0 bg-primary/10 blur-[100px] rounded-full -z-10 group-hover:bg-primary/20 transition-all duration-700" />
            <div className="relative mx-auto max-w-6xl p-2 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] dark:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden">
              <div className="bg-zinc-50 dark:bg-zinc-950 rounded-[2rem] overflow-hidden border border-zinc-200 dark:border-zinc-800 aspect-[16/10] flex flex-col">
                {/* Browser Header */}
                <div className="h-12 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-6 gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="w-64 h-6 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center px-3 gap-2">
                      <ShieldCheck className="w-3 h-3 text-emerald-500" />
                      <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
                    </div>
                  </div>
                </div>
                {/* Dashboard Mockup Content */}
                <div className="flex-1 flex overflow-hidden">
                  {/* Sidebar */}
                  <div className="w-64 border-r border-zinc-200 dark:border-zinc-800 p-6 space-y-8 hidden md:block">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                        <Package className="w-4 h-4" />
                      </div>
                      <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-24" />
                    </div>
                    <div className="space-y-4">
                      {[
                        { icon: <Layout className="w-4 h-4" />, label: t.dashboard, active: true },
                        { icon: <Package className="w-4 h-4" />, label: t.inventory },
                        { icon: <FileText className="w-4 h-4" />, label: t.invoices },
                        { icon: <Users className="w-4 h-4" />, label: t.customers },
                        { icon: <BarChart3 className="w-4 h-4" />, label: t.reports },
                        { icon: <ShieldCheck className="w-4 h-4" />, label: t.aiAssistantTitle },
                      ].map((item, i) => (
                        <div key={i} className={`flex items-center gap-3 p-2 rounded-xl ${item.active ? 'bg-primary/10 text-primary' : 'text-zinc-400'}`}>
                          <div className="w-5 h-5 flex items-center justify-center">{item.icon}</div>
                          <div className={`h-3 rounded ${item.active ? 'w-20 bg-primary/20' : 'w-16 bg-zinc-100 dark:bg-zinc-800'}`} />
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Main Content */}
                  <div className="flex-1 p-8 overflow-y-auto">
                    <div className="flex items-center justify-between mb-8">
                      <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-48" />
                      <div className="flex gap-3">
                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400">
                          <Globe className="w-4 h-4" />
                        </div>
                        <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400">
                          <Users className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-6 mb-8">
                      {[
                        { label: t.sales, color: 'bg-emerald-500', value: '12,450' },
                        { label: t.expenses, color: 'bg-rose-500', value: '3,200' },
                        { label: t.profits, color: 'bg-blue-500', value: '9,250' },
                        { label: t.inventoryValue, color: 'bg-amber-500', value: '45,000' },
                      ].map((stat, i) => (
                        <div key={i} className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
                          <div className={`w-8 h-8 ${stat.color} rounded-lg opacity-20`} />
                          <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{stat.label}</div>
                          <div className="text-2xl font-black text-zinc-900 dark:text-white">{stat.value}</div>
                        </div>
                      ))}
                    </div>
                    {/* Main Chart Area */}
                    <div className="grid grid-cols-3 gap-6">
                      <div className="col-span-2 h-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6">
                        <div className="h-full w-full bg-[repeating-linear-gradient(90deg,transparent,transparent_40px,rgba(0,0,0,0.02)_40px,rgba(0,0,0,0.02)_41px)] dark:bg-[repeating-linear-gradient(90deg,transparent,transparent_40px,rgba(255,255,255,0.02)_40px,rgba(255,255,255,0.02)_41px)] relative">
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: '75%' }}
                            transition={{ duration: 1.5, delay: 0.5 }}
                            className="absolute bottom-0 left-0 w-full bg-primary/10 rounded-t-lg" 
                            style={{ clipPath: 'polygon(0 100%, 10% 80%, 20% 90%, 30% 60%, 40% 70%, 50% 40%, 60% 50%, 70% 20%, 80% 30%, 90% 10%, 100% 20%, 100% 100%)' }} 
                          />
                        </div>
                      </div>
                      <div className="h-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4">
                        <div className="text-sm font-bold text-zinc-400">{t.latestInvoices}</div>
                        <div className="space-y-3">
                          {[1, 2, 3, 4].map(i => (
                            <div key={i} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">#{i}</div>
                                <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-16" />
                              </div>
                              <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded w-8" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 bg-zinc-50 dark:bg-zinc-900/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-20">
          <motion.div 
            animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
            transition={{ duration: 15, repeat: Infinity }}
            className="absolute top-20 left-10 w-64 h-64 bg-primary/20 blur-3xl rounded-full" 
          />
          <motion.div 
            animate={{ x: [0, -100, 0], y: [0, -50, 0] }}
            transition={{ duration: 20, repeat: Infinity }}
            className="absolute bottom-20 right-10 w-96 h-96 bg-emerald-500/20 blur-3xl rounded-full" 
          />
        </div>

        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-6xl font-black mb-6 tracking-tight"
            >
              {t.features}
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto font-medium"
            >
              {lang === 'ar' ? 'نظام متكامل يغنيك عن الأوراق والتعقيدات' : 'A complete system that replaces paperwork and complexity'}
            </motion.p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Package />} 
              title={t.inventory} 
              desc={lang === 'ar' ? 'تحكم كامل في مخزونك مع تتبع فوري وتنبيهات تلقائية' : 'Full control over your stock with real-time tracking and automated alerts.'}
              delay={0}
            />
            <FeatureCard 
              icon={<FileText />} 
              title={t.invoices} 
              desc={lang === 'ar' ? 'أنشئ فواتير احترافية في ثوانٍ مع حساب تلقائي للضرائب' : 'Create professional invoices in seconds with automated tax calculations.'}
              delay={0.1}
            />
            <FeatureCard 
              icon={<PieChart />} 
              title={t.accounting} 
              desc={lang === 'ar' ? 'نظام محاسبي متكامل لإدارة حساباتك بدقة متناهية' : 'Professional chart of accounts and ledger system for precise financial management.'}
              delay={0.2}
            />
            <FeatureCard 
              icon={<ShieldCheck />} 
              title={t.aiAssistant} 
              desc={lang === 'ar' ? 'رؤى وتقارير مدعومة بالذكاء الاصطناعي لمساعدتك في اتخاذ القرارات' : 'AI-powered insights and reports to help you make better business decisions.'}
              delay={0.3}
            />
            <FeatureCard 
              icon={<ScanBarcode />} 
              title={t.barcodeSupport} 
              desc={lang === 'ar' ? 'دعم كامل للباركود لتسريع عمليات البيع والجرد' : 'Full support for barcode scanning to speed up your sales and inventory processes.'}
              delay={0.4}
            />
            <FeatureCard 
              icon={<Mic />} 
              title={t.voiceEntry} 
              desc={lang === 'ar' ? 'أضف المنتجات وادير مخزنك باستخدام الأوامر الصوتية البسيطة' : 'Add products and manage your warehouse using simple voice commands.'}
              delay={0.5}
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-6xl font-black mb-6 tracking-tight"
            >
              {t.pricing}
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto font-medium"
            >
              {t.singlePlan}
            </motion.p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Monthly Plan */}
            <PricingCard 
              title={lang === 'ar' ? 'الباقة الشهرية' : 'Monthly Plan'}
              price="700"
              period={lang === 'ar' ? 'ج.م / شهر' : 'EGP / mo'}
              features={t.pricingFeatures}
              lang={lang}
              onSelect={() => setIsAuthModalOpen(true)}
              delay={0}
            />
            {/* Semi-Annual Plan (Popular) */}
            <PricingCard 
              title={lang === 'ar' ? 'الباقة النصف سنوية' : 'Semi-Annual Plan'}
              price="2,000"
              period={lang === 'ar' ? 'ج.م / 6 أشهر' : 'EGP / 6 mo'}
              features={t.pricingFeatures}
              lang={lang}
              popular
              onSelect={() => setIsAuthModalOpen(true)}
              delay={0.1}
            />
            {/* Annual Plan (Best Value) */}
            <PricingCard 
              title={lang === 'ar' ? 'الباقة السنوية' : 'Annual Plan'}
              price="3,000"
              period={lang === 'ar' ? 'ج.م / سنة' : 'EGP / yr'}
              features={t.pricingFeatures}
              lang={lang}
              onSelect={() => setIsAuthModalOpen(true)}
              delay={0.2}
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">{t.howItWorks}</h2>
            <p className="text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto font-medium">
              Get up and running in minutes with our intuitive four-step process.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 relative">
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-zinc-100 dark:bg-zinc-800 -z-10" />
            
            <StepCard number="01" title={t.step1} desc="Import your products via Excel or add them manually with our smart entry system." />
            <StepCard number="02" title={t.step2} desc="Generate professional invoices, manage discounts, and handle taxes automatically." />
            <StepCard number="03" title={t.step3} desc="Monitor stock levels in real-time across multiple warehouses and locations." />
            <StepCard number="04" title={t.step4} desc="Analyze your business performance with AI-driven financial reports and insights." />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="relative bg-primary rounded-[3rem] p-12 md:p-24 text-center text-white overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent)]" />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative z-10"
            >
              <h2 className="text-4xl md:text-7xl font-black mb-8 tracking-tighter">{t.ctaTitle}</h2>
              <p className="text-xl md:text-2xl text-primary-hover mb-12 max-w-2xl mx-auto font-medium opacity-90">
                Join thousands of businesses that trust Makhzanak for their daily operations.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <Button 
                  onClick={() => setIsAuthModalOpen(true)}
                  variant="secondary"
                  className="w-full sm:w-auto px-12 py-6 bg-white text-primary rounded-2xl text-xl font-black hover:bg-primary/5 shadow-2xl"
                >
                  {t.startNow}
                </Button>
                <Button 
                  variant="primary"
                  className="w-full sm:w-auto px-12 py-6 bg-primary-hover/50 text-white border border-primary/30 rounded-2xl text-xl font-black hover:bg-primary-hover"
                >
                  {t.requestDemo}
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex flex-col items-center md:items-start gap-4">
            <span className="text-2xl font-black text-primary tracking-tighter">{t.brand}</span>
            <p className="text-zinc-500 font-medium max-w-xs text-center md:text-left">
              The ultimate platform for modern business management.
            </p>
          </div>
          <div className="flex gap-12 text-sm font-bold text-zinc-500 dark:text-zinc-400">
            <div className="flex flex-col gap-4">
              <span className="text-zinc-900 dark:text-white uppercase tracking-widest text-xs">Product</span>
              <a href="#features" className="hover:text-primary transition-colors">Features</a>
              <a href="#pricing" className="hover:text-primary transition-colors">Pricing</a>
              <a href="#" className="hover:text-primary transition-colors">Updates</a>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-zinc-900 dark:text-white uppercase tracking-widest text-xs">Company</span>
              <a href="#" className="hover:text-primary transition-colors">About</a>
              <a href="#" className="hover:text-primary transition-colors">Contact</a>
              <a href="#" className="hover:text-primary transition-colors">Privacy</a>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-20 pt-8 border-t border-zinc-100 dark:border-zinc-900 text-center">
          <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">
            © 2026 {t.brand}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function StepCard({ number, title, desc }: { number: string, title: string, desc: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative p-8 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-200/20 dark:shadow-none"
    >
      <div className="text-5xl font-black text-primary/20 mb-6">{number}</div>
      <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">{title}</h3>
      <p className="text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
        {desc}
      </p>
    </motion.div>
  );
}
function FeatureCard({ icon, title, desc, delay = 0 }: { icon: React.ReactNode, title: string, desc: string, delay?: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      whileHover={{ y: -8 }}
      className="group p-10 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200/50 dark:border-zinc-800 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] transition-all duration-500"
    >
      <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 text-primary rounded-2xl flex items-center justify-center mb-8 group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-sm">
        <div className="w-8 h-8 flex items-center justify-center">{icon}</div>
      </div>
      <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">{title}</h3>
      <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
        {desc}
      </p>
    </motion.div>
  );
}

function PricingCard({ 
  title, 
  price, 
  period, 
  features, 
  popular = false, 
  onSelect, 
  lang,
  delay = 0 
}: { 
  title: string, 
  price: string, 
  period: string, 
  features: string[], 
  popular?: boolean, 
  onSelect: () => void,
  lang: 'ar' | 'en',
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className={`relative p-8 md:p-12 rounded-[2.5rem] border ${
        popular 
          ? 'bg-zinc-900 dark:bg-zinc-900 border-primary shadow-2xl shadow-primary/20 scale-105 z-10' 
          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
      }`}
    >
      {popular && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 px-6 py-2 bg-primary text-white text-sm font-black rounded-full uppercase tracking-widest shadow-xl">
          {lang === 'ar' ? 'الأكثر شيوعاً' : 'Most Popular'}
        </div>
      )}
      <div className="text-center mb-10">
        <h3 className={`text-xl font-bold mb-4 uppercase tracking-widest ${popular ? 'text-primary' : 'text-zinc-400'}`}>
          {title}
        </h3>
        <div className="flex items-baseline justify-center gap-2">
          <span className={`text-6xl font-black ${popular ? 'text-white' : 'text-zinc-900 dark:text-white'}`}>
            {price}
          </span>
          <span className={`text-xl font-bold ${popular ? 'text-zinc-500' : 'text-zinc-400'}`}>
            {period}
          </span>
        </div>
      </div>
      <ul className="space-y-5 mb-12">
        {features.map((feature, i) => (
          <li key={i} className={`flex items-center gap-4 font-medium ${popular ? 'text-zinc-300' : 'text-zinc-600 dark:text-zinc-400'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${popular ? 'bg-primary' : 'bg-primary/10'}`}>
              <CheckCircle2 className={`w-4 h-4 ${popular ? 'text-white' : 'text-primary'}`} />
            </div>
            {feature}
          </li>
        ))}
      </ul>
      <Button 
        onClick={onSelect}
        variant={popular ? 'primary' : 'secondary'}
        className={`w-full py-5 rounded-2xl text-lg font-bold shadow-xl ${
          popular 
            ? 'shadow-primary/20' 
            : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white'
        }`}
      >
        {lang === 'ar' ? 'ابدأ الآن' : 'Start Now'}
      </Button>
    </motion.div>
  );
}
