import React, { useState, useEffect } from 'react';
import Button from '../components/Button';
import { 
  Users, 
  Plus, 
  Search, 
  Shield, 
  Mail, 
  Edit2, 
  Trash2, 
  X,
  UserCheck,
  UserMinus,
  Lock,
  Eye,
  CheckSquare,
  Square,
  LogIn
} from 'lucide-react';
import { getCollection, addToCollection, updateInCollection, deleteUser, subscribeToCollection } from '../services/accountingService';
import { UserProfile, UserRole, UserPermissions } from '../types';
import { translations } from '../translations';
import { toast } from 'react-hot-toast';
import { motion } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { logAction } from '../services/actionTrackingService';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';

interface Props {
  lang: 'ar' | 'en';
  profile: any;
}

export default function UserManagement({ lang, profile: currentProfile }: Props) {
  const { user, impersonate, isImpersonating } = useAuth();
  const t = translations[lang];
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{id: string, name: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    name: '',
    email: '',
    role: 'cashier',
    permissions: {
      invoices: true,
      products: true,
      reports: false,
      treasury: false,
      view_dashboard: true,
      view_reports: false,
      edit_customers: true,
      add_products: false,
      edit_products: false,
      delete_products: false,
      create_invoices: true,
      edit_invoices: false,
      delete_invoices: false,
      access_settings: false,
      access_suppliers: false,
      access_treasury: false
    }
  });

  useEffect(() => {
    if (!currentProfile?.companyId) return;

    const unsub = subscribeToCollection<UserProfile>(currentProfile.companyId, 'users', (data) => {
      setUsers(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });

    return () => unsub();
  }, [currentProfile?.companyId]);

  if (currentProfile?.role !== 'admin' || isImpersonating) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-10">
        <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mb-6">
          <Lock className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-black mb-4">{t.accessDenied}</h2>
        <p className="text-zinc-500 max-w-md">{lang === 'ar' ? 'عذراً، هذه الصفحة مخصصة لمديري النظام فقط.' : 'Sorry, this page is restricted to system administrators only.'}</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile?.companyId) return;
    try {
      if (formData.id) {
        await updateInCollection<UserProfile>(currentProfile.companyId, 'users', formData.id, {
          name: formData.name,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          password: formData.password,
          role: formData.role as UserRole,
          permissions: formData.permissions as UserPermissions
        });
        
        if (user && currentProfile) {
          await logAction({
            userId: currentProfile.id || user.uid,
            companyId: currentProfile.companyId,
            userName: currentProfile.name || user.displayName || user.email || 'Admin',
            action: 'UPDATE_USER',
            module: 'Users',
            details: `Updated user ${formData.name}`
          });
        }
        
        toast.success(lang === 'ar' ? 'تم تحديث المستخدم بنجاح' : 'User updated successfully');
      } else {
        // Create new user profile
        const newId = Math.random().toString(36).substring(2, 15);
        const newUser: UserProfile = {
          id: newId,
          uid: newId,
          companyId: currentProfile.companyId,
          name: formData.name || '',
          displayName: formData.name || '',
          email: formData.email || '',
          phoneNumber: formData.phoneNumber || '',
          password: formData.password || '',
          role: formData.role as UserRole || 'cashier',
          permissions: formData.permissions as UserPermissions || getPermissionsForRole('cashier'),
          createdAt: new Date().toISOString()
        };
        
        await addToCollection<UserProfile>(currentProfile.companyId, 'users', newUser);
        
        if (user && currentProfile) {
          await logAction({
            userId: currentProfile.id || user.uid,
            companyId: currentProfile.companyId,
            userName: currentProfile.name || user.displayName || user.email || 'Admin',
            action: 'CREATE_USER',
            module: 'Users',
            details: `Created user ${formData.name}`
          });
        }
        
        toast.success(lang === 'ar' ? 'تم إضافة المستخدم بنجاح' : 'User added successfully');
      }
      setIsModalOpen(false);
      setFormData({ name: '', email: '', role: 'cashier', phoneNumber: '', password: '', permissions: getPermissionsForRole('cashier') });
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error(lang === 'ar' ? 'خطأ في حفظ بيانات المستخدم' : 'Error saving user');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    // Safety Restriction: Prevent deleting main admin account
    if (id === currentProfile?.id || id === user?.uid) {
      toast.error(lang === 'ar' ? 'لا يمكن حذف حساب المدير الرئيسي' : 'Cannot delete main admin account');
      return;
    }

    setUserToDelete({ id, name });
    setIsConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete || !currentProfile?.companyId) return;

    try {
      await deleteUser(currentProfile.companyId, userToDelete.id, currentProfile.id || user?.uid || '');
      
      toast.success(lang === 'ar' ? 'تم حذف المستخدم بنجاح' : 'User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(lang === 'ar' ? 'خطأ في حذف المستخدم' : 'Error deleting user');
    } finally {
      setUserToDelete(null);
      setIsConfirmDeleteOpen(false);
    }
  };

  const handleImpersonate = async (targetUser: UserProfile) => {
    if (!impersonate) return;
    
    try {
      await impersonate(targetUser);
      toast.success(lang === 'ar' ? `جاري الدخول كـ ${targetUser.name}` : `Logging in as ${targetUser.name}`);
    } catch (error) {
      toast.error(lang === 'ar' ? 'فشل في عملية المحاكاة' : 'Impersonation failed');
    }
  };

  const ALL_PERMISSIONS: (keyof UserPermissions)[] = [
    'invoices', 'products', 'reports', 'treasury', 'view_dashboard', 'view_reports',
    'edit_customers', 'add_products', 'edit_products', 'delete_products',
    'create_invoices', 'edit_invoices', 'delete_invoices', 'access_settings',
    'access_suppliers', 'access_treasury'
  ];

  const getPermissionsForRole = (role: UserRole): UserPermissions => {
    const base: UserPermissions = {
      invoices: false, products: false, reports: false, treasury: false,
      view_dashboard: true, view_reports: false, edit_customers: false,
      add_products: false, edit_products: false, delete_products: false,
      create_invoices: false, edit_invoices: false, delete_invoices: false,
      access_settings: false, access_suppliers: false, access_treasury: false
    };

    if (role === 'admin') {
      Object.keys(base).forEach(key => base[key as keyof UserPermissions] = true);
    } else if (role === 'accountant') {
      base.invoices = true;
      base.reports = true;
      base.view_reports = true;
      base.treasury = true;
      base.access_treasury = true;
    } else if (role === 'cashier') {
      base.invoices = true;
      base.create_invoices = true;
      base.products = true;
    }
    return base;
  };

  const togglePermission = (perm: keyof UserPermissions) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...(prev.permissions as UserPermissions),
        [perm]: !(prev.permissions as UserPermissions)[perm]
      }
    }));
  };

  const filteredUsers = users.filter(u => 
    (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-primary/10">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight">{t.userManagement}</h2>
            <p className="text-sm text-zinc-500 font-medium">{lang === 'ar' ? 'إدارة صلاحيات وأدوار فريق العمل' : 'Manage team roles and permissions'}</p>
          </div>
        </div>
        <Button 
          onClick={() => { setFormData({ name: '', email: '', role: 'cashier', phoneNumber: '', password: '', permissions: getPermissionsForRole('cashier') }); setIsModalOpen(true); }}
          className="w-full md:w-auto px-8 py-4 rounded-2xl"
          leftIcon={<Plus className="w-5 h-5" />}
        >
          {t.addUser}
        </Button>
      </div>

      <div className="relative max-w-md group">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-primary transition-colors" />
        <input 
          type="text" 
          placeholder={lang === 'ar' ? 'البحث عن مستخدم...' : 'Search users...'}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-14 pr-6 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-4 ring-primary/10 transition-all font-medium"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredUsers.map((userItem) => (
          <motion.div 
            layout
            key={userItem.id} 
            className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl" />
            
            <div className="flex justify-between items-start mb-6 relative">
              <div className="w-16 h-16 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-2xl font-black text-primary group-hover:scale-110 transition-transform">
                {userItem.name?.[0] || '?'}
              </div>
              <div className="flex gap-2">
                {(userItem.id !== (currentProfile?.id || user?.uid)) && (
                  <Button 
                    variant="icon"
                    onClick={() => handleImpersonate(userItem)}
                    className="p-3"
                    title={t.impersonate}
                  >
                    <LogIn className="w-5 h-5" />
                  </Button>
                )}
                <Button 
                  variant="icon-primary"
                  onClick={() => { setFormData(userItem); setIsModalOpen(true); }}
                  className="p-3"
                >
                  <Edit2 className="w-5 h-5" />
                </Button>
                {(userItem.id !== (currentProfile?.id || user?.uid)) && (
                  <Button 
                    variant="icon-danger"
                    onClick={() => handleDelete(userItem.id, userItem.name)}
                    className="p-3"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </div>

            <h3 className="text-xl font-black mb-1 text-zinc-900 dark:text-white">{userItem.name}</h3>
            <div className="flex items-center gap-2 text-sm text-zinc-500 font-medium mb-6">
              <Mail className="w-4 h-4" />
              {userItem.email}
            </div>

            <div className="flex flex-wrap gap-2 mb-8">
              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                userItem.role === 'admin' ? 'bg-rose-100 text-rose-600' : 
                'bg-primary/10 text-primary'
              }`}>
                {t[userItem.role as keyof typeof t] || userItem.role}
              </span>
            </div>

            <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
              <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">{t.permissions}</div>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto no-scrollbar">
                {ALL_PERMISSIONS.filter(p => userItem.permissions[p]).map(p => (
                  <span key={p} className="px-3 py-1 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-[10px] font-bold text-zinc-500">
                    {t[p as keyof typeof t] || p}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={formData.id ? (lang === 'ar' ? 'تعديل مستخدم' : 'Edit User') : t.addUser}
        size="lg"
        footer={
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full">
            <Button 
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-4 sm:py-5 rounded-2xl order-2 sm:order-1"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              type="submit"
              form="user-form"
              className="flex-1 py-4 sm:py-5 rounded-2xl order-1 sm:order-2"
            >
              {lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <form id="user-form" onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2">
              <label className="text-[10px] sm:text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{t.name}</label>
              <input 
                type="text" 
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="m-input text-sm sm:text-base"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] sm:text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{t.email}</label>
              <input 
                type="email" 
                required
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="m-input text-sm sm:text-base"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2">
              <label className="text-[10px] sm:text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{t.phoneNumber}</label>
              <input 
                type="tel" 
                value={formData.phoneNumber || ''}
                onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                className="m-input text-sm sm:text-base"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] sm:text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{t.password}</label>
              <input 
                type="password" 
                required={!formData.id}
                value={formData.password || ''}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                className="m-input text-sm sm:text-base"
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] sm:text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{t.role}</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['admin', 'accountant', 'cashier'] as UserRole[]).map(role => (
                <Button
                  key={role}
                  variant={formData.role === role ? "primary" : "secondary"}
                  onClick={() => setFormData({ ...formData, role, permissions: getPermissionsForRole(role) })}
                  className={`flex flex-row sm:flex-col items-center gap-3 p-4 sm:p-5 rounded-2xl border-2 transition-all h-auto ${
                    formData.role === role 
                      ? 'border-primary' 
                      : 'border-zinc-100 dark:border-zinc-800 hover:border-primary/30'
                  }`}
                >
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    formData.role === role ? 'bg-white/20 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                  }`}>
                    {role === 'admin' ? <Shield className="w-5 h-5 sm:w-6 sm:h-6" /> : role === 'accountant' ? <UserCheck className="w-5 h-5 sm:w-6 sm:h-6" /> : <UserMinus className="w-5 h-5 sm:w-6 sm:h-6" />}
                  </div>
                  <div className="text-left sm:text-center">
                    <div className="font-black text-xs sm:text-sm">{t[role as keyof typeof t] || role}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] sm:text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{t.permissions}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-4 sm:p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800">
              {ALL_PERMISSIONS.map(perm => (
                <Button
                  key={perm}
                  variant="secondary"
                  onClick={() => togglePermission(perm)}
                  className="flex items-center gap-3 p-2 sm:p-3 hover:bg-white dark:hover:bg-zinc-800 rounded-xl transition-all group text-left h-auto justify-start bg-transparent border-none shadow-none"
                >
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center transition-all flex-shrink-0 ${
                    formData.permissions?.[perm]
                      ? 'bg-primary text-white'
                      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 group-hover:border-primary'
                  }`}>
                    {formData.permissions?.[perm] ? <CheckSquare className="w-3 h-3 sm:w-4 sm:h-4" /> : <Square className="w-3 h-3 sm:w-4 sm:h-4" />}
                  </div>
                  <span className={`text-xs sm:text-sm font-bold ${
                    formData.permissions?.[perm] ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'
                  }`}>
                    {t[perm as keyof typeof t] || perm}
                  </span>
                </Button>
              ))}
            </div>
          </div>
        </form>
      </Modal>
      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={confirmDelete}
        title={lang === 'ar' ? 'حذف مستخدم' : 'Delete User'}
        message={lang === 'ar' ? `هل أنت متأكد من حذف المستخدم ${userToDelete?.name}؟ لا يمكن التراجع عن هذا الإجراء.` : `Are you sure you want to delete user ${userToDelete?.name}? This action cannot be undone.`}
        lang={lang}
      />
    </div>
  );
}
