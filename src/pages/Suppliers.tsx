import React, { useState, useEffect } from 'react';
import Button from '../components/Button';
import { translations } from '../translations';
import { recordSupplierPayment, getCollection, addToCollection, updateInCollection, deleteSupplier, subscribeToCollection } from '../services/accountingService';
import { Account, Supplier } from '../types';
import { toast } from 'react-hot-toast';
import { getCurrencySymbol } from '../utils/currency';
import { useAuth } from '../hooks/useAuth';
import ConfirmModal from '../components/ConfirmModal';
import Pagination from '../components/Pagination';
import Modal from '../components/Modal';
import { ShieldAlert, Truck, Plus, Search, Phone, Mail, DollarSign, Edit2, Trash2 } from 'lucide-react';

interface Props {
  lang: 'ar' | 'en';
  profile: any;
}

export default function Suppliers({ lang, profile }: Props) {
  const { hasPermission, loading: authLoading } = useAuth();
  const t = translations[lang];
  const currencySymbol = getCurrencySymbol(profile?.currency, lang);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [formData, setFormData] = useState<Supplier>({
    name: '',
    email: '',
    phone: '',
    address: '',
    category: '',
    balance: 0,
    companyId: profile?.companyId || ''
  });
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    description: '',
    accountId: ''
  });

  useEffect(() => {
    if (!profile?.companyId) return;

    const unsubSuppliers = subscribeToCollection<Supplier>(profile.companyId, 'suppliers', (data) => {
      setSuppliers(data);
    });

    const unsubAccounts = subscribeToCollection<Account>(profile.companyId, 'accounts', (data) => {
      setAccounts(data);
    });

    return () => {
      unsubSuppliers();
      unsubAccounts();
    };
  }, [profile?.companyId]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasPermission('access_suppliers')) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-2xl">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-black">{lang === 'ar' ? 'غير مصرح' : 'Unauthorized'}</h2>
        <p className="text-zinc-500">{lang === 'ar' ? 'ليس لديك صلاحية للوصول إلى الموردين' : 'You do not have permission to access suppliers'}</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.companyId) return;
    try {
      if (formData.id) {
        await updateInCollection<Supplier>(profile.companyId, 'suppliers', formData.id, formData as any);
        toast.success(lang === 'ar' ? 'تم تحديث بيانات المورد بنجاح' : 'Supplier updated successfully');
      } else {
        await addToCollection<Supplier>(profile.companyId, 'suppliers', {
          ...formData,
          balance: formData.balance || 0,
          companyId: profile.companyId
        } as any);
        toast.success(lang === 'ar' ? 'تم إضافة المورد بنجاح' : 'Supplier added successfully');
      }
      setIsModalOpen(false);
      setFormData({ name: '', email: '', phone: '', address: '', category: '', balance: 0, companyId: profile.companyId });
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast.error(lang === 'ar' ? 'خطأ في حفظ بيانات المورد' : 'Error saving supplier');
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier?.id || !profile?.companyId) return;
    try {
      await recordSupplierPayment(
        profile.companyId,
        selectedSupplier.id,
        paymentData.amount,
        paymentData.description,
        paymentData.accountId
      );
      toast.success(lang === 'ar' ? 'تم تسجيل الدفعة بنجاح' : 'Payment recorded successfully');
      setIsPaymentModalOpen(false);
      setPaymentData({ amount: 0, description: '', accountId: '' });
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error(lang === 'ar' ? 'خطأ في تسجيل الدفعة' : 'Error recording payment');
    }
  };

  const handleDelete = async (id: string) => {
    if (!profile?.companyId) return;
    setSupplierToDelete(id);
    setIsConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!supplierToDelete || !profile?.companyId) return;
    try {
      await deleteSupplier(profile.companyId, supplierToDelete, profile.id || profile.uid);
      toast.success(lang === 'ar' ? 'تم حذف المورد' : 'Supplier deleted');
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast.error(lang === 'ar' ? 'خطأ في حذف المورد' : 'Error deleting supplier');
    } finally {
      setSupplierToDelete(null);
      setIsConfirmDeleteOpen(false);
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredSuppliers.length / pageSize);
  const paginatedSuppliers = filteredSuppliers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-2xl">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{t.suppliers}</h2>
            <p className="text-sm text-zinc-500">Manage your supply chain and vendor relationships</p>
          </div>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)}
          variant="primary"
          size="lg"
          leftIcon={<Plus className="w-5 h-5" />}
        >
          {lang === 'ar' ? 'إضافة مورد' : 'Add Supplier'}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
        <input 
          type="text" 
          placeholder={lang === 'ar' ? 'البحث عن مورد...' : 'Search suppliers...'}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 ring-emerald-500/20 transition-all"
        />
      </div>

      {/* Suppliers Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left responsive-table">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 text-xs uppercase tracking-widest font-bold">
                <th className="px-8 py-4">{lang === 'ar' ? 'المورد' : 'Supplier'}</th>
                <th className="px-8 py-4">{lang === 'ar' ? 'التصنيف' : 'Category'}</th>
                <th className="px-8 py-4">{lang === 'ar' ? 'الاتصال' : 'Contact'}</th>
                <th className="px-8 py-4">{lang === 'ar' ? 'الرصيد' : 'Balance'}</th>
                <th className="px-8 py-4 text-right">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {paginatedSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                  <td className="px-8 py-5" data-label={lang === 'ar' ? 'المورد' : 'Supplier'}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                        {supplier.name?.[0] || '?'}
                      </div>
                      <div className="font-bold">{supplier.name}</div>
                    </div>
                  </td>
                  <td className="px-8 py-5" data-label={lang === 'ar' ? 'التصنيف' : 'Category'}>
                    <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      {supplier.category}
                    </span>
                  </td>
                  <td className="px-8 py-5" data-label={lang === 'ar' ? 'الاتصال' : 'Contact'}>
                    <div className="space-y-1">
                      <div className="text-sm flex items-center gap-2 text-zinc-500">
                        <Phone className="w-3 h-3" /> {supplier.phone}
                      </div>
                      <div className="text-xs flex items-center gap-2 text-zinc-400">
                        <Mail className="w-3 h-3" /> {supplier.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5" data-label={lang === 'ar' ? 'الرصيد' : 'Balance'}>
                    <div className={`font-black ${supplier.balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {currencySymbol} {supplier.balance?.toLocaleString() || 0}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="icon-primary"
                        onClick={() => { setSelectedSupplier(supplier); setIsPaymentModalOpen(true); }}
                        leftIcon={<DollarSign className="w-4 h-4" />}
                        title={lang === 'ar' ? 'دفع' : 'Pay'}
                      />
                      <Button 
                        variant="icon-primary"
                        onClick={() => { setFormData(supplier); setIsModalOpen(true); }}
                        leftIcon={<Edit2 className="w-4 h-4" />}
                      />
                      <Button 
                        variant="icon-danger"
                        onClick={() => handleDelete(supplier.id!)}
                        leftIcon={<Trash2 className="w-4 h-4" />}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center opacity-50 italic">No suppliers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination 
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalRecords={filteredSuppliers.length}
        pageSize={pageSize}
        lang={lang}
      />

      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={confirmDelete}
        title={lang === 'ar' ? 'حذف مورد' : 'Delete Supplier'}
        message={lang === 'ar' ? 'هل أنت متأكد من حذف هذا المورد؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this supplier? This action cannot be undone.'}
        lang={lang}
      />

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={formData.id ? (lang === 'ar' ? 'تعديل مورد' : 'Edit Supplier') : (lang === 'ar' ? 'إضافة مورد جديد' : 'Add New Supplier')}
        size="md"
        footer={
          <div className="flex gap-3 w-full">
            <Button 
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              className="flex-1"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              type="submit"
              form="supplier-form"
              className="flex-1"
            >
              {lang === 'ar' ? 'حفظ' : 'Save'}
            </Button>
          </div>
        }
      >
        <form id="supplier-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'اسم المورد' : 'Supplier Name'}</label>
            <input 
              required
              type="text" 
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="m-input"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'التصنيف' : 'Category'}</label>
            <input 
              required
              type="text" 
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              className="m-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">Email</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="m-input"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">Phone</label>
              <input 
                required
                type="tel" 
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="m-input"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen && !!selectedSupplier}
        onClose={() => setIsPaymentModalOpen(false)}
        title={lang === 'ar' ? 'دفع للمورد' : 'Pay Supplier'}
        size="md"
        footer={
          <Button 
            type="submit"
            form="payment-form"
            className="w-full"
          >
            {lang === 'ar' ? 'تأكيد الدفع' : 'Confirm Payment'}
          </Button>
        }
      >
        {selectedSupplier && (
          <div className="space-y-6">
            <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-2xl border border-orange-100 dark:border-orange-900/20">
              <div className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-1">{lang === 'ar' ? 'المورد' : 'Supplier'}</div>
              <div className="text-lg font-bold">{selectedSupplier.name}</div>
              <div className="text-sm text-orange-600 font-bold mt-2">
                {lang === 'ar' ? 'الرصيد المستحق:' : 'Outstanding Balance:'} {currencySymbol} {selectedSupplier.balance?.toLocaleString()}
              </div>
            </div>
            <form id="payment-form" onSubmit={handlePayment} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'الحساب (الخزينة/البنك)' : 'Account (Cash/Bank)'}</label>
                <select 
                  required
                  value={paymentData.accountId}
                  onChange={e => setPaymentData({ ...paymentData, accountId: e.target.value })}
                  className="m-input"
                >
                  <option value="">Select Account</option>
                  {accounts.filter(a => a.type === 'Asset').map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'المبلغ' : 'Amount'}</label>
                <input 
                  required
                  type="number" 
                  value={paymentData.amount || ''}
                  onChange={e => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) })}
                  className="m-input text-2xl font-black"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'البيان' : 'Description'}</label>
                <textarea 
                  required
                  value={paymentData.description}
                  onChange={e => setPaymentData({ ...paymentData, description: e.target.value })}
                  className="m-input h-24 resize-none py-4"
                  placeholder={lang === 'ar' ? 'تفاصيل الدفع...' : 'Payment details...'}
                />
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
