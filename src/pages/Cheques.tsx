import React, { useState, useEffect } from 'react';
import { getCollection, addToCollection, updateInCollection, recordCheque, clearCheque, subscribeToCollection, deleteCheque } from '../services/accountingService';
import { translations } from '../translations';
import { Cheque, Customer, Supplier, Account, TreasuryTransaction, Company } from '../types';
import { toast } from 'react-hot-toast';
import Button from '../components/Button';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  CreditCard,
  Building2,
  Calendar,
  User,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  ShieldAlert,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Modal from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import ConfirmModal from '../components/ConfirmModal';
import Pagination from '../components/Pagination';

interface Props {
  lang: 'ar' | 'en';
  profile: any;
}

const Cheques: React.FC<Props> = ({ lang, profile }) => {
  const { hasPermission } = useAuth();
  const t = translations[lang];

  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'cleared' | 'rejected'>('all');
  const [filterType, setFilterType] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCheque, setEditingCheque] = useState<Cheque | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [chequeToDelete, setChequeToDelete] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;

  const [formData, setFormData] = useState({
    number: '',
    bank: '',
    amount: 0,
    dueDate: new Date().toISOString().split('T')[0],
    type: 'incoming' as 'incoming' | 'outgoing',
    status: 'pending' as 'pending' | 'cleared' | 'rejected',
    entityId: '',
    entityName: '',
    accountId: '', // Treasury/Bank account
    notes: ''
  });

  useEffect(() => {
    const companyId = profile?.companyId;
    if (!companyId) return;

    const unsubCheques = subscribeToCollection<Cheque>(companyId, 'cheques', (data) => {
      setCheques(data);
    });

    const unsubCustomers = subscribeToCollection<Customer>(companyId, 'customers', (data) => {
      setCustomers(data);
    });

    const unsubSuppliers = subscribeToCollection<Supplier>(companyId, 'suppliers', (data) => {
      setSuppliers(data);
    });

    const unsubAccounts = subscribeToCollection<Account>(companyId, 'accounts', (data) => {
      setAccounts(data);
    });

    setLoading(false);

    return () => {
      unsubCheques();
      unsubCustomers();
      unsubSuppliers();
      unsubAccounts();
    };
  }, [profile?.companyId]);

  if (!hasPermission('view_reports')) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-10">
        <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-black mb-4">{t.accessDenied || (lang === 'ar' ? 'غير مصرح' : 'Unauthorized')}</h2>
        <p className="text-zinc-500 max-w-md">{lang === 'ar' ? 'عذراً، ليس لديك الصلاحية الكافية للوصول إلى هذه الصفحة.' : 'Sorry, you do not have sufficient permissions to access this page.'}</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId) return;
    
    const entity = formData.type === 'incoming' 
      ? customers.find(c => c.id === formData.entityId)
      : suppliers.find(s => s.id === formData.entityId);

    const data = {
      ...formData,
      companyId: profile.companyId,
      entityName: entity ? entity.name : '',
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingCheque) {
        await updateInCollection<Cheque>(profile.companyId, 'cheques', editingCheque.id, data as any);
      } else {
        const chequeId = await addToCollection<Cheque>(profile.companyId, 'cheques', {
          ...data,
          createdAt: new Date().toISOString()
        } as any);
        
        // Record in accounting
        await recordCheque(profile.companyId, { ...data, id: chequeId });
      }
      setIsModalOpen(false);
      setEditingCheque(null);
      setFormData({
        number: '',
        bank: '',
        amount: 0,
        dueDate: new Date().toISOString().split('T')[0],
        type: 'incoming',
        status: 'pending',
        entityId: '',
        entityName: '',
        accountId: '',
        notes: ''
      });
      toast.success(lang === 'ar' ? 'تم حفظ الشيك' : 'Cheque saved');
    } catch (error) {
      console.error("Error saving cheque:", error);
      toast.error(lang === 'ar' ? 'خطأ في حفظ الشيك' : 'Error saving cheque');
    }
  };

  const updateStatus = async (id: string, newStatus: 'cleared' | 'rejected') => {
    if (!profile?.companyId) return;
    try {
      if (newStatus === 'cleared') {
        await clearCheque(profile.companyId, id);
      } else {
        await updateInCollection<Cheque>(profile.companyId, 'cheques', id, { 
          status: newStatus,
          updatedAt: new Date().toISOString()
        } as any);
      }
      
      toast.success(lang === 'ar' ? 'تم تحديث حالة الشيك' : 'Cheque status updated');
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error(lang === 'ar' ? 'خطأ في تحديث الحالة' : 'Error updating status');
    }
  };

  const filteredCheques = cheques.filter(cheque => {
    const matchesSearch = cheque.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cheque.bank.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cheque.entityName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || cheque.status === filterStatus;
    const matchesType = filterType === 'all' || cheque.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const totalItems = filteredCheques.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedCheques = filteredCheques.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleDelete = async (id: string) => {
    setChequeToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!chequeToDelete || !profile?.companyId) return;
    try {
      await deleteCheque(profile.companyId, chequeToDelete, profile.id || profile.uid);
      toast.success(lang === 'ar' ? 'تم حذف الشيك بنجاح' : 'Cheque deleted successfully');
      setIsDeleteModalOpen(false);
      setChequeToDelete(null);
    } catch (error) {
      console.error("Error deleting cheque:", error);
      toast.error(lang === 'ar' ? 'خطأ في حذف الشيك' : 'Error deleting cheque');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'cleared': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-rose-500" />;
      default: return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'cleared': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'rejected': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
      default: return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    }
  };

  return (
    <div className="p-6 space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {lang === 'ar' ? 'إدارة الشيكات' : 'Cheque Management'}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            {lang === 'ar' ? 'تتبع وتحصيل الشيكات الصادرة والواردة' : 'Track and collect incoming and outgoing cheques'}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingCheque(null);
            setIsModalOpen(true);
          }}
          variant="black"
          size="lg"
          leftIcon={<Plus className="w-5 h-5" />}
        >
          {lang === 'ar' ? 'إضافة شيك' : 'Add Cheque'}
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="text"
            placeholder={lang === 'ar' ? 'بحث برقم الشيك أو البنك...' : 'Search by cheque number or bank...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
        >
          <option value="all">{lang === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
          <option value="pending">{lang === 'ar' ? 'قيد الانتظار' : 'Pending'}</option>
          <option value="cleared">{lang === 'ar' ? 'تم التحصيل' : 'Cleared'}</option>
          <option value="rejected">{lang === 'ar' ? 'مرفوض' : 'Rejected'}</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
        >
          <option value="all">{lang === 'ar' ? 'كل الأنواع' : 'All Types'}</option>
          <option value="incoming">{lang === 'ar' ? 'وارد' : 'Incoming'}</option>
          <option value="outgoing">{lang === 'ar' ? 'صادر' : 'Outgoing'}</option>
        </select>
      </div>

      {/* Cheques List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode='popLayout'>
          {paginatedCheques.map((cheque) => (
            <motion.div
              key={cheque.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 hover:shadow-lg transition-all group relative overflow-hidden"
            >
              {/* Type Indicator */}
              <div className={`absolute top-0 right-0 w-1 h-full ${cheque.type === 'incoming' ? 'bg-emerald-500' : 'bg-rose-500'}`} />

              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${cheque.type === 'incoming' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'} dark:bg-opacity-10`}>
                    {cheque.type === 'incoming' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white">#{cheque.number}</h3>
                    <p className="text-xs text-zinc-500">{cheque.bank}</p>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${getStatusColor(cheque.status)}`}>
                  {getStatusIcon(cheque.status)}
                  {lang === 'ar' ? (cheque.status === 'pending' ? 'انتظار' : cheque.status === 'cleared' ? 'تم' : 'مرفوض') : cheque.status}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500 flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {cheque.entityName}
                  </span>
                  <span className="text-lg font-black text-zinc-900 dark:text-white">
                    {cheque.amount.toLocaleString()} <span className="text-xs font-normal opacity-50">EGP</span>
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {cheque.dueDate}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {accounts.find(a => a.id === cheque.accountId)?.name || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                {cheque.status === 'pending' && (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => updateStatus(cheque.id, 'cleared')}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      {lang === 'ar' ? 'تحصيل' : 'Clear'}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => updateStatus(cheque.id, 'rejected')}
                      className="flex-1"
                    >
                      {lang === 'ar' ? 'رفض' : 'Reject'}
                    </Button>
                  </>
                )}
                <Button
                  variant="icon-danger"
                  onClick={() => handleDelete(cheque.id)}
                  leftIcon={<Trash2 className="w-4 h-4" />}
                  title={lang === 'ar' ? 'حذف' : 'Delete'}
                />
              </div>

              <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-all">
                <Button 
                  variant="icon"
                  onClick={() => {
                    setEditingCheque(cheque);
                    setFormData({
                      number: cheque.number,
                      bank: cheque.bank,
                      amount: cheque.amount,
                      dueDate: cheque.dueDate,
                      type: cheque.type,
                      status: cheque.status,
                      entityId: cheque.entityId,
                      entityName: cheque.entityName,
                      accountId: cheque.accountId,
                      notes: cheque.notes || ''
                    });
                    setIsModalOpen(true);
                  }}
                  leftIcon={<MoreVertical className="w-4 h-4 text-zinc-500" />}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredCheques.length > pageSize && (
        <div className="mt-8">
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalRecords={totalItems}
            pageSize={pageSize}
            lang={lang}
          />
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCheque(null);
        }}
        title={editingCheque ? (lang === 'ar' ? 'تعديل شيك' : 'Edit Cheque') : (lang === 'ar' ? 'إضافة شيك جديد' : 'Add New Cheque')}
        size="md"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              variant="secondary"
              onClick={() => {
                setIsModalOpen(false);
                setEditingCheque(null);
              }}
              className="flex-1"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              form="cheque-form"
              variant="black"
              className="flex-1"
            >
              {editingCheque ? (lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes') : (lang === 'ar' ? 'إضافة الشيك' : 'Add Cheque')}
            </Button>
          </div>
        }
      >
        <form id="cheque-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">{lang === 'ar' ? 'رقم الشيك' : 'Cheque Number'}</label>
              <input
                required
                type="text"
                value={formData.number}
                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">{lang === 'ar' ? 'البنك' : 'Bank'}</label>
              <input
                required
                type="text"
                value={formData.bank}
                onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">{lang === 'ar' ? 'المبلغ' : 'Amount'}</label>
              <input
                required
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 outline-none focus:ring-4 focus:ring-primary/10 transition-all font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">{lang === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}</label>
              <input
                required
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">{lang === 'ar' ? 'النوع' : 'Type'}</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any, entityId: '' })}
                className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
              >
                <option value="incoming">{lang === 'ar' ? 'وارد (من عميل)' : 'Incoming (from Customer)'}</option>
                <option value="outgoing">{lang === 'ar' ? 'صادر (إلى مورد)' : 'Outgoing (to Supplier)'}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">
                {formData.type === 'incoming' ? (lang === 'ar' ? 'العميل' : 'Customer') : (lang === 'ar' ? 'المورد' : 'Supplier')}
              </label>
              <select
                required
                value={formData.entityId}
                onChange={(e) => setFormData({ ...formData, entityId: e.target.value })}
                className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
              >
                <option value="">{lang === 'ar' ? 'اختر...' : 'Select...'}</option>
                {formData.type === 'incoming' 
                  ? customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                  : suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                }
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-zinc-500 uppercase tracking-widest">{lang === 'ar' ? 'الحساب (خزينة/بنك)' : 'Account (Treasury/Bank)'}</label>
            <select
              required
              value={formData.accountId}
              onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
              className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 outline-none focus:ring-4 focus:ring-primary/10 transition-all"
            >
              <option value="">{lang === 'ar' ? 'اختر الحساب...' : 'Select Account...'}</option>
              {accounts.filter(a => a.type === 'Asset').map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title={lang === 'ar' ? 'حذف الشيك' : 'Delete Cheque'}
        message={lang === 'ar' ? 'هل أنت متأكد من حذف هذا الشيك؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this cheque? This action cannot be undone.'}
        lang={lang}
      />
    </div>
  );
};

export default Cheques;
