import React, { useState, useEffect } from 'react';
import Button from '../components/Button';
import { translations } from '../translations';
import { recordCashMovement, recordExpense, recordSupplierPayment, getCollection, subscribeToCollection, deleteTransaction } from '../services/accountingService';
import { Account, Supplier, Transaction, TreasuryTransaction } from '../types';
import Pagination from '../components/Pagination';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { logAction } from '../services/actionTrackingService';
import Modal from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { getCurrencySymbol } from '../utils/currency';
import ConfirmModal from '../components/ConfirmModal';
import { Trash2, ShieldAlert, Wallet, Plus, DollarSign, ArrowUpRight, ArrowDownRight, Search, Filter, Calendar, Download, ArrowRightLeft, History as HistoryIcon } from 'lucide-react';

interface Props {
  lang: 'ar' | 'en';
  profile: any;
}

export default function Treasury({ lang, profile }: Props) {
  const { user, hasPermission, loading: authLoading } = useAuth();
  const t = translations[lang];
  const currencySymbol = getCurrencySymbol(profile?.currency, lang);
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [balance, setBalance] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const [formData, setFormData] = useState({
    type: 'in' as 'in' | 'out' | 'expense' | 'supplier',
    amount: 0,
    description: '',
    accountId: '',
    expenseAccountId: '',
    supplierId: ''
  });

  useEffect(() => {
    if (!profile?.companyId) return;

    const unsubTransactions = subscribeToCollection<TreasuryTransaction>(profile.companyId, 'transactions', (data) => {
      setTransactions(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });

    const unsubAccounts = subscribeToCollection<Account>(profile.companyId, 'accounts', (data) => {
      setAccounts(data);
      const treasuryBalance = data
        .filter((a: Account) => a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank') || a.code.startsWith('11'))
        .reduce((sum: number, a: Account) => sum + (a.balance || 0), 0);
      setBalance(treasuryBalance);
    });

    const unsubSuppliers = subscribeToCollection<Supplier>(profile.companyId, 'suppliers', (data) => {
      setSuppliers(data);
    });

    return () => {
      unsubTransactions();
      unsubAccounts();
      unsubSuppliers();
    };
  }, [profile?.companyId]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasPermission('access_treasury')) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-2xl">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-black">{lang === 'ar' ? 'غير مصرح' : 'Unauthorized'}</h2>
        <p className="text-zinc-500">{lang === 'ar' ? 'ليس لديك صلاحية للوصول إلى الخزينة' : 'You do not have permission to access the treasury'}</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.type === 'in' || formData.type === 'out') {
        await recordCashMovement(
          profile.companyId,
          formData.amount,
          formData.description,
          formData.type,
          formData.accountId,
          profile.id || user.uid
        );
      } else if (formData.type === 'expense') {
        await recordExpense(
          profile.companyId,
          formData.amount,
          formData.description,
          formData.expenseAccountId,
          formData.accountId,
          profile.id || user.uid
        );
      } else if (formData.type === 'supplier') {
        await recordSupplierPayment(
          profile.companyId,
          formData.supplierId,
          formData.amount,
          formData.description,
          formData.accountId,
          profile.id || user.uid
        );
      }
      
      toast.success(lang === 'ar' ? 'تمت العملية بنجاح' : 'Transaction recorded successfully');
      
      // Log Action
      if (user && profile?.companyId) {
        await logAction({
          userId: profile.id || user.uid,
          companyId: profile.companyId,
          userName: profile.name || user.displayName || user.email || 'Unknown',
          action: `TREASURY_${formData.type.toUpperCase()}`,
          module: 'Treasury',
          details: `${formData.type} transaction of ${currencySymbol} ${formData.amount} - ${formData.description}`
        });
      }

      setIsModalOpen(false);
      setFormData({ 
        type: 'in', 
        amount: 0, 
        description: '', 
        accountId: '', 
        expenseAccountId: '', 
        supplierId: '' 
      });
    } catch (error) {
      console.error("Error saving transaction:", error);
      toast.error(lang === 'ar' ? 'خطأ في تسجيل العملية' : 'Error recording transaction');
    }
  };

  // Filtering Logic
  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = tx.description?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         tx.type?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || tx.type === filterType;
    
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const txDate = new Date(tx.date);
      const today = new Date();
      if (dateFilter === 'today') {
        matchesDate = txDate.toDateString() === today.toDateString();
      } else if (dateFilter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 7);
        matchesDate = txDate >= weekAgo;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(today.getMonth() - 1);
        matchesDate = txDate >= monthAgo;
      }
    }

    return matchesSearch && matchesType && matchesDate;
  });

  // Pagination Logic
  const totalItems = filteredTransactions.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleDelete = async (id: string) => {
    setTransactionToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!transactionToDelete || !profile?.companyId) return;
    try {
      await deleteTransaction(profile.companyId, transactionToDelete, profile.id || profile.uid);
      toast.success(lang === 'ar' ? 'تم حذف العملية بنجاح' : 'Transaction deleted successfully');
      setIsDeleteModalOpen(false);
      setTransactionToDelete(null);
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast.error(lang === 'ar' ? 'خطأ في حذف العملية' : 'Error deleting transaction');
    }
  };

  const cashAccounts = accounts.filter(a => a.type === 'Asset' && (a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')));
  const expenseAccounts = accounts.filter(a => a.type === 'Expense');

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-primary/10 dark:bg-primary/20 text-primary rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-primary/10">
            <Wallet className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight">{t.treasury}</h2>
            <p className="text-sm text-zinc-500 font-medium">{lang === 'ar' ? 'إدارة النقدية والتدفقات المالية' : 'Manage cash flow and financial transactions'}</p>
          </div>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)}
          variant="primary"
          size="lg"
          leftIcon={<Plus className="w-6 h-6" />}
        >
          {lang === 'ar' ? 'عملية جديدة' : 'New Transaction'}
        </Button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary p-8 rounded-[2.5rem] text-white shadow-2xl shadow-primary/30 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-700" />
          <div className="flex items-center gap-3 opacity-80 mb-6">
            <DollarSign className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{lang === 'ar' ? 'الرصيد الحالي' : 'Current Balance'}</span>
          </div>
          <div className="text-5xl font-black tracking-tighter">{currencySymbol} {balance.toLocaleString()}</div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm"
        >
          <div className="flex items-center gap-3 text-primary mb-6">
            <ArrowUpRight className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{lang === 'ar' ? 'إجمالي المقبوضات' : 'Total Income'}</span>
          </div>
          <div className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-white">
            {currencySymbol} {transactions.filter(tx => tx.type === 'Cash In' || tx.type === 'Sales Invoice').reduce((sum, tx) => sum + (tx.amount || 0), 0).toLocaleString()}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm"
        >
          <div className="flex items-center gap-3 text-red-500 mb-6">
            <ArrowDownRight className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{lang === 'ar' ? 'إجمالي المصروفات' : 'Total Expenses'}</span>
          </div>
          <div className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-white">
            {currencySymbol} {transactions.filter(tx => tx.type === 'Cash Out' || tx.type === 'Expense' || tx.type === 'Supplier Payment' || tx.type === 'Purchase Invoice').reduce((sum, tx) => sum + (tx.amount || 0), 0).toLocaleString()}
          </div>
        </motion.div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder={lang === 'ar' ? 'البحث في العمليات...' : 'Search transactions...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-4 ring-primary/10 transition-all font-medium"
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <select 
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="pl-11 pr-8 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-4 ring-primary/10 transition-all font-bold text-sm appearance-none min-w-[160px]"
            >
              <option value="all">{lang === 'ar' ? 'كل العمليات' : 'All Types'}</option>
              <option value="Cash In">{lang === 'ar' ? 'مقبوضات' : 'Cash In'}</option>
              <option value="Cash Out">{lang === 'ar' ? 'مدفوعات' : 'Cash Out'}</option>
              <option value="Expense">{lang === 'ar' ? 'مصروفات' : 'Expense'}</option>
              <option value="Supplier Payment">{lang === 'ar' ? 'دفع مورد' : 'Supplier Payment'}</option>
              <option value="Sales Invoice">{lang === 'ar' ? 'فاتورة مبيعات' : 'Sales Invoice'}</option>
              <option value="Purchase Invoice">{lang === 'ar' ? 'فاتورة مشتريات' : 'Purchase Invoice'}</option>
            </select>
          </div>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <select 
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="pl-11 pr-8 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-4 ring-primary/10 transition-all font-bold text-sm appearance-none min-w-[160px]"
            >
              <option value="all">{lang === 'ar' ? 'كل الأوقات' : 'All Time'}</option>
              <option value="today">{lang === 'ar' ? 'اليوم' : 'Today'}</option>
              <option value="week">{lang === 'ar' ? 'هذا الأسبوع' : 'This Week'}</option>
              <option value="month">{lang === 'ar' ? 'هذا الشهر' : 'This Month'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="text-xl font-black flex items-center gap-3">
            <HistoryIcon className="w-6 h-6 text-zinc-400" />
            {lang === 'ar' ? 'سجل العمليات' : 'Transaction History'}
          </h3>
          <Button 
            variant="icon"
            leftIcon={<Download className="w-5 h-5" />}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left responsive-table">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-black">
                <th className="px-8 py-5">{t.date}</th>
                <th className="px-8 py-5">{lang === 'ar' ? 'البيان' : 'Description'}</th>
                <th className="px-8 py-5">{lang === 'ar' ? 'النوع' : 'Type'}</th>
                <th className="px-8 py-5 text-right">{lang === 'ar' ? 'المبلغ' : 'Amount'}</th>
                <th className="px-8 py-5 text-center">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {paginatedTransactions.map((tx) => {
                const isIncome = ['Cash In', 'Sales Invoice'].includes(tx.type);
                return (
                  <tr key={tx.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                    <td className="px-8 py-6 text-sm font-bold text-zinc-500" data-label={t.date}>{new Date(tx.date).toLocaleDateString()}</td>
                    <td className="px-8 py-6" data-label={lang === 'ar' ? 'البيان' : 'Description'}>
                      <div className="text-sm font-black text-zinc-900 dark:text-white mb-0.5">{tx.description}</div>
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{tx.id.slice(0, 8)}</div>
                    </td>
                    <td className="px-8 py-6" data-label={lang === 'ar' ? 'النوع' : 'Type'}>
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        isIncome ? 'bg-primary/10 text-primary' : 'bg-red-100 text-red-600'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className={`px-8 py-6 text-right text-base font-black ${isIncome ? 'text-primary' : 'text-red-500'}`} data-label={lang === 'ar' ? 'المبلغ' : 'Amount'}>
                      {isIncome ? '+' : '-'} {currencySymbol} {(tx.amount || 0).toLocaleString()}
                    </td>
                    <td className="px-8 py-6 text-center" data-label={lang === 'ar' ? 'إجراءات' : 'Actions'}>
                      <Button 
                        variant="icon-danger"
                        onClick={() => handleDelete(tx.id)}
                        leftIcon={<Trash2 className="w-5 h-5" />}
                        title={lang === 'ar' ? 'حذف' : 'Delete'}
                      />
                    </td>
                  </tr>
                );
              })}
              {paginatedTransactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center opacity-20">
                      <HistoryIcon className="w-16 h-16 mb-4" />
                      <p className="text-xl font-black">{lang === 'ar' ? 'لا توجد عمليات' : 'No transactions found'}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-8 border-t border-zinc-100 dark:border-zinc-800">
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalRecords={filteredTransactions.length}
            pageSize={pageSize}
            lang={lang}
          />
        </div>
      </div>

      {/* Transaction Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={lang === 'ar' ? 'عملية مالية جديدة' : 'New Transaction'}
        size="md"
        footer={
          <Button 
            form="treasury-form"
            type="submit"
            className="w-full"
            size="lg"
          >
            {lang === 'ar' ? 'تأكيد العملية' : 'Confirm Transaction'}
          </Button>
        }
      >
        <form id="treasury-form" onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-[1.5rem]">
            {[
              { id: 'in', label: lang === 'ar' ? 'قبض' : 'Income', icon: <ArrowUpRight className="w-4 h-4" /> },
              { id: 'out', label: lang === 'ar' ? 'صرف' : 'Expense', icon: <ArrowDownRight className="w-4 h-4" /> },
              { id: 'expense', label: lang === 'ar' ? 'مصروفات' : 'Expense', icon: <DollarSign className="w-4 h-4" /> },
              { id: 'supplier', label: lang === 'ar' ? 'مورد' : 'Supplier', icon: <ArrowRightLeft className="w-4 h-4" /> }
            ].map(type => (
              <Button 
                key={type.id}
                type="button"
                variant={formData.type === type.id ? 'primary' : 'secondary'}
                onClick={() => setFormData({ ...formData, type: type.id as any })}
                className="flex-col gap-2 py-4 h-auto"
                leftIcon={type.icon}
              >
                <span className="text-[10px] uppercase tracking-widest">{type.label}</span>
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'حساب النقدية' : 'Cash Account'}</label>
              <select 
                required
                value={formData.accountId}
                onChange={e => setFormData({ ...formData, accountId: e.target.value })}
                className="m-input"
              >
                <option value="">{lang === 'ar' ? 'اختر الحساب' : 'Select Account'}</option>
                {cashAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'المبلغ' : 'Amount'}</label>
              <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-zinc-400">{currencySymbol}</span>
                <input 
                  required
                  type="number" 
                  value={formData.amount || ''}
                  onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                  className="m-input pl-16 text-2xl font-black"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {formData.type === 'expense' && (
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'بند المصروف' : 'Expense Category'}</label>
              <select 
                required
                value={formData.expenseAccountId}
                onChange={e => setFormData({ ...formData, expenseAccountId: e.target.value })}
                className="m-input"
              >
                <option value="">{lang === 'ar' ? 'اختر البند' : 'Select Category'}</option>
                {expenseAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
            </div>
          )}

          {formData.type === 'supplier' && (
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'المورد' : 'Supplier'}</label>
              <select 
                required
                value={formData.supplierId}
                onChange={e => setFormData({ ...formData, supplierId: e.target.value })}
                className="m-input"
              >
                <option value="">{lang === 'ar' ? 'اختر المورد' : 'Select Supplier'}</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (Balance: {s.balance})</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'البيان' : 'Description'}</label>
            <textarea 
              required
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="m-input h-32 resize-none font-medium py-4"
              placeholder={lang === 'ar' ? 'اكتب تفاصيل العملية هنا...' : 'Write transaction details here...'}
            />
          </div>
        </form>
      </Modal>

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title={lang === 'ar' ? 'حذف العملية' : 'Delete Transaction'}
        message={lang === 'ar' ? 'هل أنت متأكد من حذف هذه العملية؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this transaction? This action cannot be undone.'}
        lang={lang}
      />
    </div>
  );
}
