import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  User, 
  Shield, 
  Bell, 
  Globe, 
  Moon, 
  Sun,
  Save,
  Check,
  History,
  Activity,
  Download,
  Upload,
  Database,
  ShieldAlert
} from 'lucide-react';
import Button from '../components/Button';
import { UserProfile, UserRole } from '../types';
import { translations } from '../translations';
import { toast } from 'react-hot-toast';
import { getActions, UserAction, logAction } from '../services/actionTrackingService';
import { updateInCollection, getCollection, addToCollection, getCompanyProfile, getUserProfiles, updateCompanyProfile } from '../services/accountingService';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';

interface Props {
  lang: 'ar' | 'en';
  setLang: (l: 'ar' | 'en') => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  compactMode: boolean;
  setCompactMode: (c: boolean) => void;
  browserMode: boolean;
  setBrowserMode: (b: boolean) => void;
  profile: any;
}

export default function SettingsPage({ 
  lang, setLang, theme, setTheme, 
  compactMode, setCompactMode, 
  browserMode, setBrowserMode, 
  profile 
}: Props) {
  const { hasPermission } = useAuth();
  const t = translations[lang];
  const [formData, setFormData] = useState({
    displayName: '',
    role: 'cashier',
    currency: 'EGP'
  });

  const [companyData, setCompanyData] = useState({
    name: '',
    address: '',
    phone: '',
    taxNumber: '',
    vatEnabled: false,
    vatRate: 15
  });

  const preferences = {
    emailNotifications: true, // This one stays local for now as it's not implemented globally
    browserMode,
    compactMode
  };

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || profile.name || '',
        role: profile.role || 'cashier',
        currency: profile.currency || 'EGP'
      });
    }
  }, [profile]);

  useEffect(() => {
    const fetchCompany = async () => {
      if (profile?.companyId) {
        const data = await getCompanyProfile(profile.companyId);
        if (data) {
          setCompanyData({
            name: data.name || '',
            address: data.address || '',
            phone: data.phone || '',
            taxNumber: data.taxNumber || '',
            vatEnabled: data.vatEnabled || false,
            vatRate: data.vatRate || 15
          });
        }
      }
    };
    fetchCompany();
  }, [profile?.companyId]);

  const [saved, setSaved] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);
  const [actions, setActions] = useState<UserAction[]>([]);

  useEffect(() => {
    if (!profile?.companyId) return;
    let unsubscribe: (() => void) | null = null;
    const timeoutId = setTimeout(() => {
      unsubscribe = getActions(profile.companyId, setActions);
    }, 300);
    return () => {
      clearTimeout(timeoutId);
      if (unsubscribe) unsubscribe();
    };
  }, [profile?.companyId]);

  if (!hasPermission('access_settings')) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-2xl">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-black">{lang === 'ar' ? 'غير مصرح' : 'Unauthorized'}</h2>
        <p className="text-zinc-500">{lang === 'ar' ? 'ليس لديك صلاحية للوصول إلى الإعدادات' : 'You do not have permission to access settings'}</p>
      </div>
    );
  }

  const handleSave = async () => {
    const userId = profile?.id || profile?.uid;
    if (!userId || !profile?.companyId) return;
    try {
      await updateInCollection<UserProfile>(profile.companyId, 'users', userId, {
        name: formData.displayName,
        displayName: formData.displayName,
        role: formData.role as UserRole,
        currency: formData.currency as 'EGP' | 'SAR'
      });
      
      await logAction({
        userId: userId,
        companyId: profile.companyId,
        userName: profile.name || profile.displayName || profile.email || 'Unknown',
        action: 'UPDATE_PROFILE',
        module: 'Settings',
        details: `Updated profile settings: ${JSON.stringify(formData)}`
      });
      setSaved(true);
      toast.success(lang === 'ar' ? 'تم حفظ الإعدادات بنجاح' : 'Settings saved successfully');
      setTimeout(() => setSaved(false), 3000);
      
      // No need to reload or update localStorage manually if we use Firestore subscriptions
      // But since profile is managed by useAuth, we might need to trigger a refresh there if it's not subscribed
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(lang === 'ar' ? 'خطأ في حفظ الإعدادات' : 'Error saving settings');
    }
  };

  const handleExport = async () => {
    try {
      const collections = [
        'products', 
        'invoices', 
        'customers', 
        'suppliers', 
        'accounts', 
        'cheques', 
        'returns', 
        'transactions', 
        'journal_entries', 
        'users', 
        'logs', 
        'categories', 
        'payments',
        'members',
        'expenses',
        'income'
      ];
      const backupData: any = {};

      // Get company profile
      if (profile?.companyId) {
        backupData.company_profile = await getCompanyProfile(profile.companyId);
        backupData.user_profiles = await getUserProfiles(profile.companyId);
      }

      for (const colName of collections) {
        if (profile?.companyId) {
          backupData[colName] = await getCollection<any>(profile.companyId, colName);
        }
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `makhzanak_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(lang === 'ar' ? 'تم تصدير النسخة الاحتياطية بنجاح' : 'Backup exported successfully');
      await logAction({
        userId: profile.uid,
        companyId: profile.companyId,
        userName: profile.displayName || profile.email || 'Unknown',
        action: 'EXPORT_BACKUP',
        module: 'Settings',
        details: `Exported data backup for company: ${profile.companyId}`
      });
    } catch (error) {
      console.error('Export error:', error);
      toast.error(lang === 'ar' ? 'خطأ في تصدير النسخة الاحتياطية' : 'Error exporting backup');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.companyId) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target?.result as string);
        const companyId = profile.companyId;

        toast.loading(lang === 'ar' ? 'جاري استيراد البيانات...' : 'Importing data...', { id: 'import-loading' });

        for (const colName in backupData) {
          const items = backupData[colName];
          if (!Array.isArray(items)) continue;

          // Use batches for efficiency (Firestore limit is 500 per batch)
          const batchSize = 500;
          for (let i = 0; i < items.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = items.slice(i, i + batchSize);
            
            chunk.forEach((item: any) => {
              const { id, ...data } = item;
              const docRef = id 
                ? doc(db, `companies/${companyId}/${colName}`, id)
                : doc(collection(db, `companies/${companyId}/${colName}`));
              batch.set(docRef, { ...data, companyId });
            });

            await batch.commit();
          }
        }

        toast.dismiss('import-loading');
        toast.success(lang === 'ar' ? 'تم استيراد النسخة الاحتياطية بنجاح' : 'Backup imported successfully');
        
        await logAction({
          userId: profile.uid,
          companyId: profile.companyId,
          userName: profile.displayName || profile.email || 'Unknown',
          action: 'IMPORT_BACKUP',
          module: 'Settings',
          details: `Imported data backup for company: ${profile.companyId}`
        });
        
        setTimeout(() => window.location.reload(), 2000);
      } catch (error) {
        toast.dismiss('import-loading');
        console.error('Import error:', error);
        toast.error(lang === 'ar' ? 'خطأ في استيراد النسخة الاحتياطية' : 'Error importing backup');
      }
    };
    reader.readAsText(file);
  };

  const handleSaveCompany = async () => {
    if (!profile?.companyId) return;
    try {
      await updateCompanyProfile(profile.companyId, companyData);
      
      await logAction({
        userId: profile.id || profile.uid,
        companyId: profile.companyId,
        userName: profile.name || profile.displayName || profile.email || 'Unknown',
        action: 'UPDATE_COMPANY_PROFILE',
        module: 'Settings',
        details: `Updated company settings: ${JSON.stringify(companyData)}`
      });
      setCompanySaved(true);
      toast.success(lang === 'ar' ? 'تم حفظ بيانات الشركة بنجاح' : 'Company settings saved successfully');
      setTimeout(() => setCompanySaved(false), 3000);
    } catch (error) {
      console.error('Error updating company:', error);
      toast.error(lang === 'ar' ? 'خطأ في حفظ بيانات الشركة' : 'Error saving company settings');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl flex items-center justify-center shadow-lg">
            <Settings className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">{t.settings}</h2>
            <p className="text-xs text-zinc-500 font-medium">{lang === 'ar' ? 'إدارة إعدادات حسابك وتفضيلاتك' : 'Manage your account settings and preferences'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Profile & Company */}
        <div className="lg:col-span-8 space-y-8">
          {/* Profile Settings */}
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black flex items-center gap-3">
                <User className="w-6 h-6 text-primary" />
                {lang === 'ar' ? 'إعدادات الملف الشخصي' : 'Profile Settings'}
              </h3>
              <Button 
                onClick={handleSave}
                leftIcon={saved ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                variant={saved ? 'secondary' : 'primary'}
                size="sm"
              >
                {saved ? (lang === 'ar' ? 'تم الحفظ' : 'Saved') : (lang === 'ar' ? 'حفظ' : 'Save')}
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 ml-2">{lang === 'ar' ? 'الاسم المعروض' : 'Display Name'}</label>
                <input 
                  type="text" 
                  value={formData.displayName}
                  onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 ring-primary/20 transition-all font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 ml-2">{lang === 'ar' ? 'الدور' : 'Role'}</label>
                <select 
                  disabled
                  value={formData.role}
                  className="w-full px-6 py-4 bg-zinc-100 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-2xl outline-none opacity-60 cursor-not-allowed font-bold"
                >
                  <option value="admin">{lang === 'ar' ? 'مدير' : 'Admin'}</option>
                  <option value="accountant">{lang === 'ar' ? 'محاسب' : 'Accountant'}</option>
                  <option value="cashier">{lang === 'ar' ? 'كاشير' : 'Cashier'}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 ml-2">{t.currency}</label>
                <select 
                  value={formData.currency}
                  onChange={e => setFormData({ ...formData, currency: e.target.value as any })}
                  className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 ring-primary/20 transition-all font-bold"
                >
                  <option value="EGP">{t.egp}</option>
                  <option value="SAR">{t.sar}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Company Settings (Admin Only) */}
          {profile?.role === 'admin' && (
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black flex items-center gap-3">
                  <Database className="w-6 h-6 text-emerald-600" />
                  {lang === 'ar' ? 'إعدادات الشركة' : 'Company Settings'}
                </h3>
                <Button 
                  onClick={handleSaveCompany}
                  leftIcon={companySaved ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                  variant={companySaved ? 'secondary' : 'primary'}
                  size="sm"
                >
                  {companySaved ? (lang === 'ar' ? 'تم الحفظ' : 'Saved') : (lang === 'ar' ? 'حفظ' : 'Save')}
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 ml-2">{lang === 'ar' ? 'اسم الشركة' : 'Company Name'}</label>
                  <input 
                    type="text" 
                    value={companyData.name}
                    onChange={e => setCompanyData({ ...companyData, name: e.target.value })}
                    className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 ring-primary/20 transition-all font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 ml-2">{lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</label>
                  <input 
                    type="text" 
                    value={companyData.phone}
                    onChange={e => setCompanyData({ ...companyData, phone: e.target.value })}
                    className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 ring-primary/20 transition-all font-bold"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 ml-2">{lang === 'ar' ? 'العنوان' : 'Address'}</label>
                  <input 
                    type="text" 
                    value={companyData.address}
                    onChange={e => setCompanyData({ ...companyData, address: e.target.value })}
                    className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 ring-primary/20 transition-all font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 ml-2">{lang === 'ar' ? 'الرقم الضريبي' : 'Tax Number'}</label>
                  <input 
                    type="text" 
                    value={companyData.taxNumber}
                    onChange={e => setCompanyData({ ...companyData, taxNumber: e.target.value })}
                    className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 ring-primary/20 transition-all font-bold"
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">{lang === 'ar' ? 'تفعيل الضريبة' : 'Enable VAT'}</span>
                    <span className="text-[10px] text-zinc-400 uppercase tracking-widest">{companyData.vatRate}% VAT</span>
                  </div>
                  <button 
                    onClick={() => setCompanyData({ ...companyData, vatEnabled: !companyData.vatEnabled })}
                    className={`w-12 h-6 rounded-full transition-all relative ${companyData.vatEnabled ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${companyData.vatEnabled ? (lang === 'ar' ? 'left-1' : 'right-1') : (lang === 'ar' ? 'right-1' : 'left-1')}`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Audit Log */}
          {profile?.role === 'admin' && (
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <h3 className="text-xl font-black mb-8 flex items-center gap-3">
                <Activity className="w-6 h-6 text-purple-600" />
                {lang === 'ar' ? 'سجل النشاطات' : 'Audit Log'}
              </h3>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {actions.map((action) => (
                  <div key={action.id} className="p-5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 group hover:border-primary/30 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <span className="px-3 py-1 bg-white dark:bg-zinc-900 rounded-full text-[10px] font-black text-primary uppercase tracking-widest border border-zinc-100 dark:border-zinc-800">{action.module}</span>
                      <span className="text-[10px] font-bold text-zinc-400">{new Date(action.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="text-sm font-black text-zinc-900 dark:text-white mb-1">{action.action.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-zinc-500 font-medium leading-relaxed">{action.details}</div>
                    <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[8px] font-black">
                        {action.userName?.[0] || '?'}
                      </div>
                      <span className="text-[10px] font-bold text-zinc-400">By: {action.userName}</span>
                    </div>
                  </div>
                ))}
                {actions.length === 0 && (
                  <div className="text-center py-20">
                    <History className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                    <p className="text-zinc-400 font-bold italic">No activity recorded yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Preferences & Backup */}
        <div className="lg:col-span-4 space-y-8">
          {/* Appearance */}
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-xl font-black mb-8 flex items-center gap-3">
              <Globe className="w-6 h-6 text-blue-600" />
              {lang === 'ar' ? 'المظهر واللغة' : 'Appearance & Language'}
            </h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-zinc-900 text-yellow-500' : 'bg-white text-zinc-400 shadow-sm'}`}>
                    {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </div>
                  <span className="font-bold text-sm">{lang === 'ar' ? 'الوضع الداكن' : 'Dark Mode'}</span>
                </div>
                <button 
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  className={`w-12 h-6 rounded-full transition-all relative ${theme === 'dark' ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${theme === 'dark' ? (lang === 'ar' ? 'left-1' : 'right-1') : (lang === 'ar' ? 'right-1' : 'left-1')}`} />
                </button>
              </div>

              <div className="space-y-4">
                <label className="block text-xs font-black uppercase tracking-widest text-zinc-400 ml-2">{lang === 'ar' ? 'اللغة' : 'Language'}</label>
                <div className="grid grid-cols-2 gap-3 p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
                  <Button 
                    variant={lang === 'ar' ? 'primary' : 'secondary'}
                    onClick={() => setLang('ar')}
                    className={`w-full py-3 rounded-xl border-none shadow-none ${lang === 'ar' ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm' : 'bg-transparent text-zinc-500'}`}
                  >
                    العربية
                  </Button>
                  <Button 
                    variant={lang === 'en' ? 'primary' : 'secondary'}
                    onClick={() => setLang('en')}
                    className={`w-full py-3 rounded-xl border-none shadow-none ${lang === 'en' ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm' : 'bg-transparent text-zinc-500'}`}
                  >
                    English
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-xl font-black mb-8 flex items-center gap-3">
              <Bell className="w-6 h-6 text-orange-600" />
              {lang === 'ar' ? 'التفضيلات' : 'Preferences'}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-2xl transition-colors">
                <div>
                  <div className="font-bold text-sm">{lang === 'ar' ? 'إشعارات البريد' : 'Email Notifications'}</div>
                  <div className="text-[10px] text-zinc-400 font-medium">Receive weekly reports</div>
                </div>
                <button 
                  className={`w-10 h-5 rounded-full transition-all relative bg-primary`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${lang === 'ar' ? 'left-0.5' : 'right-0.5'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-2xl transition-colors">
                <div>
                  <div className="font-bold text-sm">{lang === 'ar' ? 'وضع المتصفح' : 'Browser Mode'}</div>
                  <div className="text-[10px] text-zinc-400 font-medium">Sync with system settings</div>
                </div>
                <button 
                  onClick={() => setBrowserMode(!browserMode)}
                  className={`w-10 h-5 rounded-full transition-all relative ${browserMode ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${browserMode ? (lang === 'ar' ? 'left-0.5' : 'right-0.5') : (lang === 'ar' ? 'right-0.5' : 'left-0.5')}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-2xl transition-colors">
                <div>
                  <div className="font-bold text-sm">{lang === 'ar' ? 'الوضع المضغوط' : 'Compact Mode'}</div>
                  <div className="text-[10px] text-zinc-400 font-medium">Show more data on screen</div>
                </div>
                <button 
                  onClick={() => setCompactMode(!compactMode)}
                  className={`w-10 h-5 rounded-full transition-all relative ${compactMode ? 'bg-primary' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${compactMode ? (lang === 'ar' ? 'left-0.5' : 'right-0.5') : (lang === 'ar' ? 'right-0.5' : 'left-0.5')}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Security Settings (Managed by Google) */}
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm opacity-60">
            <h3 className="text-xl font-black mb-6 flex items-center gap-3">
              <Shield className="w-6 h-6 text-red-600" />
              {lang === 'ar' ? 'إعدادات الأمان' : 'Security Settings'}
            </h3>
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700">
              <p className="text-[10px] text-zinc-500 font-bold leading-relaxed text-center">
                {lang === 'ar' 
                  ? 'يتم إدارة إعدادات الأمان وكلمة المرور عبر حساب Google الخاص بك لضمان أقصى درجات الحماية.' 
                  : 'Security and password settings are managed via your Google Account to ensure maximum protection.'}
              </p>
              <div className="mt-4 flex justify-center">
                <a 
                  href="https://myaccount.google.com/security" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                >
                  {lang === 'ar' ? 'إدارة حساب Google' : 'Manage Google Account'}
                </a>
              </div>
            </div>
          </div>

          {/* Backup & Restore */}
          {profile?.role === 'admin' && (
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <h3 className="text-xl font-black mb-8 flex items-center gap-3">
                <Database className="w-6 h-6 text-primary" />
                {lang === 'ar' ? 'النسخ الاحتياطي' : 'Backup & Restore'}
              </h3>
              <div className="space-y-4">
                <Button 
                  variant="secondary"
                  onClick={handleExport}
                  leftIcon={<Download className="w-5 h-5" />}
                  className="w-full justify-center py-4 rounded-2xl"
                >
                  {lang === 'ar' ? 'تصدير نسخة احتياطية' : 'Export Backup'}
                </Button>
                <div className="relative">
                  <input 
                    type="file" 
                    accept=".json"
                    onChange={handleImport}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  <Button 
                    variant="black"
                    leftIcon={<Upload className="w-5 h-5" />}
                    className="w-full justify-center py-4 rounded-2xl"
                  >
                    {lang === 'ar' ? 'استيراد نسخة احتياطية' : 'Import Backup'}
                  </Button>
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                  <div className="flex items-center gap-2 text-amber-600 mb-1">
                    <ShieldAlert className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{lang === 'ar' ? 'تحذير' : 'Warning'}</span>
                  </div>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                    {lang === 'ar' ? 'الاستيراد سيقوم باستبدال كافة البيانات الحالية للشركة. يرجى التأكد من صحة الملف.' : 'Import will overwrite all existing company data. Please ensure the file is correct.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
