import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FileText,
  DollarSign,
  ArrowRightLeft,
  PieChart,
  X,
  History,
  Search,
  Calendar,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createAccountingEntry, createJournalEntry, deleteJournalEntry, getCollection, addToCollection, updateInCollection, deleteFromCollection, subscribeToCollection } from '../services/accountingService';
import { Account, JournalEntry, JournalEntryLine } from '../types';
import { translations } from '../translations';
import { toast } from 'react-hot-toast';
import { getCurrencySymbol } from '../utils/currency';
import { logAction } from '../services/actionTrackingService';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

import Button from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';

interface Props {
  lang: 'ar' | 'en';
  profile: any;
}

export default function Accounting({ lang, profile }: Props) {
  const { user, hasPermission, loading: authLoading } = useAuth();
  const t = translations[lang];

  const currencySymbol = getCurrencySymbol(profile?.currency, lang);
  const [activeTab, setActiveTab] = useState<'chart' | 'journal'>('chart');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmJournalDeleteOpen, setIsConfirmJournalDeleteOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const [journalToDelete, setJournalToDelete] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  
  const [accountFormData, setAccountFormData] = useState<Partial<Account>>({
    name: '',
    code: '',
    type: 'Asset',
    parentId: '',
    balance: 0
  });

  const [journalFormData, setJournalFormData] = useState<Partial<JournalEntry>>({
    date: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    lines: [
      { accountId: '', accountName: '', debit: 0, credit: 0 },
      { accountId: '', accountName: '', debit: 0, credit: 0 }
    ]
  });

  useEffect(() => {
    if (!profile?.companyId) return;

    const unsubAccounts = subscribeToCollection<Account>(profile.companyId, 'accounts', (data) => {
      setAccounts(data.sort((a, b) => a.code.localeCompare(b.code)));
    });

    const unsubJournal = subscribeToCollection<JournalEntry>(profile.companyId, 'journal_entries', (data) => {
      setJournalEntries(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });

    return () => {
      unsubAccounts();
      unsubJournal();
    };
  }, [profile?.companyId]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

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

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountFormData.name || !accountFormData.code) {
      toast.error(lang === 'ar' ? 'يرجى إدخال الاسم والكود' : 'Please enter name and code');
      return;
    }

    try {
      if (accountFormData.id) {
        const { id, ...data } = accountFormData;
        await updateInCollection<Account>(profile.companyId, 'accounts', id, data as any);
        if (user) {
          await logAction({
            userId: user.uid,
            companyId: profile.companyId,
            userName: user.displayName || user.email || 'Unknown',
            action: 'UPDATED_ACCOUNT',
            module: 'Accounting',
            details: `Updated account: ${accountFormData.name} (${accountFormData.code})`
          });
        }
        toast.success(lang === 'ar' ? 'تم تحديث الحساب بنجاح' : 'Account updated successfully');
      } else {
        await addToCollection<Account>(profile.companyId, 'accounts', {
          name: accountFormData.name || '',
          code: accountFormData.code || '',
          type: accountFormData.type || 'Asset',
          parentId: accountFormData.parentId || '',
          companyId: profile.companyId,
          balance: accountFormData.balance || 0,
          isSystem: false
        });
        if (user && profile) {
          await logAction({
            userId: profile.id || user.uid,
            companyId: profile.companyId,
            userName: profile.name || user.displayName || user.email || 'Unknown',
            action: 'CREATED_ACCOUNT',
            module: 'Accounting',
            details: `Created account: ${accountFormData.name} (${accountFormData.code})`
          });
        }
        toast.success(lang === 'ar' ? 'تم إضافة الحساب بنجاح' : 'Account added successfully');
      }
      setIsAccountModalOpen(false);
      setAccountFormData({ name: '', code: '', type: 'Asset', parentId: '', balance: 0 });
    } catch (error) {
      console.error('Error saving account:', error);
      toast.error(lang === 'ar' ? 'خطأ في حفظ الحساب' : 'Error saving account');
    }
  };

  const deleteAccount = async (id: string) => {
    const hasChildren = accounts.some(a => a.parentId === id);
    if (hasChildren) {
      toast.error(lang === 'ar' ? 'لا يمكن حذف حساب لديه حسابات فرعية' : 'Cannot delete account with sub-accounts');
      return;
    }

    const account = accounts.find(a => a.id === id);
    if (account && Math.abs(account.balance) > 0.01) {
      toast.error(lang === 'ar' ? 'لا يمكن حذف حساب لديه رصيد' : 'Cannot delete account with a balance');
      return;
    }

    setAccountToDelete(id);
    setIsConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!accountToDelete || !profile?.companyId) return;
    const account = accounts.find(a => a.id === accountToDelete);
    try {
      await deleteFromCollection(profile.companyId, 'accounts', accountToDelete);
      if (user && profile) {
        await logAction({
          userId: profile.id || user.uid,
          companyId: profile.companyId,
          userName: profile.name || user.displayName || user.email || 'Unknown',
          action: 'DELETED_ACCOUNT',
          module: 'Accounting',
          details: `Deleted account: ${account?.name} (${account?.code})`
        });
      }
      toast.success(lang === 'ar' ? 'تم حذف الحساب بنجاح' : 'Account deleted successfully');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error(lang === 'ar' ? 'خطأ في حذف الحساب' : 'Error deleting account');
    } finally {
      setIsConfirmDeleteOpen(false);
      setAccountToDelete(null);
    }
  };

  const confirmDeleteJournalEntry = async () => {
    if (!journalToDelete || !profile?.companyId) return;
    const entry = journalEntries.find(e => e.id === journalToDelete);
    try {
      await deleteJournalEntry(profile.companyId, journalToDelete, profile.id || profile.uid);
      if (user && profile) {
        await logAction({
          userId: profile.id || user.uid,
          companyId: profile.companyId,
          userName: profile.name || user.displayName || user.email || 'Unknown',
          action: 'DELETED_JOURNAL_ENTRY',
          module: 'Accounting',
          details: `Deleted journal entry: ${entry?.reference} - ${entry?.description}`
        });
      }
      toast.success(lang === 'ar' ? 'تم حذف القيد بنجاح' : 'Journal entry deleted successfully');
    } catch (error) {
      console.error('Error deleting journal entry:', error);
      toast.error(lang === 'ar' ? 'خطأ في حذف القيد' : 'Error deleting journal entry');
    } finally {
      setIsConfirmJournalDeleteOpen(false);
      setJournalToDelete(null);
    }
  };

  const handleJournalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate balance
    const totalDebit = journalFormData.lines?.reduce((sum, line) => sum + (line.debit || 0), 0) || 0;
    const totalCredit = journalFormData.lines?.reduce((sum, line) => sum + (line.credit || 0), 0) || 0;
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      toast.error(lang === 'ar' ? 'القيد غير متزن' : 'Journal entry is not balanced');
      return;
    }

    if (totalDebit === 0) {
      toast.error(lang === 'ar' ? 'يجب إدخال مبالغ' : 'Amounts must be greater than zero');
      return;
    }

    try {
      await createJournalEntry(
        profile.companyId,
        journalFormData.date || new Date().toISOString().split('T')[0],
        journalFormData.description || '',
        journalFormData.lines || [],
        journalFormData.reference || '',
        profile?.id || user?.uid || 'system'
      );

      if (user && profile) {
        await logAction({
          userId: profile.id || user.uid,
          companyId: profile.companyId,
          userName: profile.name || user.displayName || user.email || 'Unknown',
          action: 'CREATED_JOURNAL_ENTRY',
          module: 'Accounting',
          details: `Created journal entry: ${journalFormData.reference} - ${journalFormData.description}`
        });
      }

      toast.success(lang === 'ar' ? 'تم حفظ القيد بنجاح' : 'Journal entry saved successfully');
      setIsJournalModalOpen(false);
      setJournalFormData({
        date: new Date().toISOString().split('T')[0],
        reference: '',
        description: '',
        lines: [
          { accountId: '', accountName: '', debit: 0, credit: 0 },
          { accountId: '', accountName: '', debit: 0, credit: 0 }
        ]
      });
    } catch (error) {
      console.error('Error saving journal entry:', error);
      toast.error(lang === 'ar' ? 'خطأ في حفظ القيد' : 'Error saving journal entry');
    }
  };

  const addJournalLine = () => {
    setJournalFormData({
      ...journalFormData,
      lines: [...(journalFormData.lines || []), { accountId: '', accountName: '', debit: 0, credit: 0 }]
    });
  };

  const removeJournalLine = (index: number) => {
    if ((journalFormData.lines?.length || 0) <= 2) return;
    const newLines = [...(journalFormData.lines || [])];
    newLines.splice(index, 1);
    setJournalFormData({ ...journalFormData, lines: newLines });
  };

  const updateJournalLine = (index: number, field: keyof JournalEntryLine, value: any) => {
    const newLines = [...(journalFormData.lines || [])];
    if (field === 'accountId') {
      const account = accounts.find(a => a.id === value);
      newLines[index] = { ...newLines[index], accountId: value, accountName: account?.name || '' };
    } else {
      newLines[index] = { ...newLines[index], [field]: value };
    }
    setJournalFormData({ ...journalFormData, lines: newLines });
  };

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const rootAccounts = accounts.filter(a => !a.parentId);

  const renderAccount = (account: Account, level = 0) => {
    const children = accounts.filter(a => a.parentId === account.id);
    const isExpanded = expanded[account.id || ''];

    return (
      <div key={account.id} className="select-none">
        <div 
          className={`flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-2xl transition-colors cursor-pointer group`}
          style={{ paddingLeft: `${level * 2 + 1}rem`, paddingRight: `${level * 2 + 1}rem` }}
          onClick={() => toggle(account.id || '')}
        >
          <div className="flex items-center gap-3">
            {children.length > 0 ? (
              isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className={`w-4 h-4 text-zinc-400 ${lang === 'ar' ? 'rotate-180' : ''}`} />
            ) : (
              <div className="w-4" />
            )}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              account.type === 'Asset' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' :
              account.type === 'Liability' ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
              account.type === 'Equity' ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' :
              account.type === 'Revenue' ? 'bg-primary/10 text-primary' :
              'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400'
            }`}>
              {children.length > 0 ? <Folder className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-400">{account.code}</div>
              <div className="font-bold text-sm">{account.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-sm font-bold">{currencySymbol} {account.balance.toLocaleString()}</div>
              <div className="text-[10px] uppercase font-bold tracking-wider opacity-50">
                {account.type === 'Asset' ? t.assets :
                 account.type === 'Liability' ? t.liabilities :
                 account.type === 'Equity' ? t.equity :
                 account.type === 'Revenue' ? t.revenue :
                 t.expensesCat}
              </div>
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button 
                variant="icon"
                onClick={(e) => { e.stopPropagation(); setSelectedAccountId(account.id || null); setIsLedgerModalOpen(true); }}
                leftIcon={<History className="w-4 h-4" />}
                title={lang === 'ar' ? 'كشف حساب' : 'General Ledger'}
              />
              <Button 
                variant="icon-primary"
                onClick={(e) => { e.stopPropagation(); setAccountFormData(account); setIsAccountModalOpen(true); }}
                leftIcon={<Edit2 className="w-4 h-4" />}
              />
              {!account.isSystem && (
                <Button 
                  variant="icon-danger"
                  onClick={(e) => { e.stopPropagation(); deleteAccount(account.id || ''); }}
                  leftIcon={<Trash2 className="w-4 h-4" />}
                />
              )}
            </div>
          </div>
        </div>
        {isExpanded && children.map(child => renderAccount(child, level + 1))}
      </div>
    );
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-primary/10 dark:bg-primary/20 text-primary rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-primary/10">
            <PieChart className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight">{lang === 'ar' ? 'المحاسبة المالية' : 'Financial Accounting'}</h2>
            <p className="text-sm text-zinc-500 font-medium">{lang === 'ar' ? 'إدارة شجرة الحسابات والقيود اليومية' : 'Manage chart of accounts and journal entries'}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="secondary"
            size="lg"
            onClick={() => {
              setAccountFormData({ name: '', code: '', type: 'Asset', parentId: '', balance: 0 });
              setIsAccountModalOpen(true);
            }}
            leftIcon={<Plus className="w-5 h-5 text-primary" />}
          >
            {lang === 'ar' ? 'إضافة حساب' : 'Add Account'}
          </Button>
          <Button 
            variant="primary"
            size="lg"
            onClick={() => setIsJournalModalOpen(true)}
            leftIcon={<History className="w-5 h-5" />}
          >
            {lang === 'ar' ? 'قيد جديد' : 'New Entry'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-[1.5rem] w-fit">
        <Button 
          variant={activeTab === 'chart' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('chart')}
          className="px-8"
        >
          {t.chartOfAccounts}
        </Button>
        <Button 
          variant={activeTab === 'journal' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('journal')}
          className="px-8"
        >
          {lang === 'ar' ? 'القيود اليومية' : 'Journal Entries'}
        </Button>
      </div>

      {activeTab === 'chart' ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <AccountSummaryCard title={t.assets} amount={accounts.filter(a => a.type === 'Asset').reduce((sum, a) => sum + a.balance, 0).toLocaleString()} color="emerald" currencySymbol={currencySymbol} />
            <AccountSummaryCard title={t.liabilities} amount={accounts.filter(a => a.type === 'Liability').reduce((sum, a) => sum + a.balance, 0).toLocaleString()} color="red" currencySymbol={currencySymbol} />
            <AccountSummaryCard title={t.equity} amount={accounts.filter(a => a.type === 'Equity').reduce((sum, a) => sum + a.balance, 0).toLocaleString()} color="zinc" currencySymbol={currencySymbol} />
            <AccountSummaryCard title={t.revenue} amount={accounts.filter(a => a.type === 'Revenue').reduce((sum, a) => sum + a.balance, 0).toLocaleString()} color="primary" currencySymbol={currencySymbol} />
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden p-6">
            <div className="space-y-1">
              {rootAccounts.length > 0 ? rootAccounts.map(a => renderAccount(a)) : (
                <div className="p-20 text-center opacity-20 italic flex flex-col items-center gap-4">
                  <Folder className="w-16 h-16" />
                  <p className="text-xl font-black">No accounts found.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left responsive-table">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-black">
                  <th className="px-8 py-5">{t.date}</th>
                  <th className="px-8 py-5">{lang === 'ar' ? 'المرجع' : 'Reference'}</th>
                  <th className="px-8 py-5">{lang === 'ar' ? 'البيان' : 'Description'}</th>
                  <th className="px-8 py-5 text-right">{lang === 'ar' ? 'المبلغ' : 'Amount'}</th>
                  <th className="px-8 py-5 text-right">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {journalEntries.map((entry) => {
                  const totalAmount = entry.lines.reduce((sum, l) => sum + l.debit, 0);
                  return (
                    <tr key={entry.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                      <td className="px-8 py-6 text-sm font-bold text-zinc-500">{new Date(entry.date).toLocaleDateString()}</td>
                      <td className="px-8 py-6 font-black text-zinc-900 dark:text-white">{entry.reference}</td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{entry.description}</div>
                        <div className="mt-2 space-y-1">
                          {entry.lines.map((line, idx) => (
                            <div key={idx} className="flex items-center gap-4 text-[10px] font-bold">
                              <span className="text-zinc-400 w-32 truncate">{line.accountName}</span>
                              {line.debit > 0 && <span className="text-primary">Dr: {currencySymbol} {line.debit.toLocaleString()}</span>}
                              {line.credit > 0 && <span className="text-red-500">Cr: {currencySymbol} {line.credit.toLocaleString()}</span>}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right font-black text-zinc-900 dark:text-white">
                        {currencySymbol} {totalAmount.toLocaleString()}
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="icon-danger"
                            onClick={() => {
                              setJournalToDelete(entry.id!);
                              setIsConfirmJournalDeleteOpen(true);
                            }}
                            leftIcon={<Trash2 className="w-5 h-5" />}
                            title={lang === 'ar' ? 'حذف' : 'Delete'}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {journalEntries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center opacity-20">
                      <History className="w-16 h-16 mx-auto mb-4" />
                      <p className="text-xl font-black">{lang === 'ar' ? 'لا توجد قيود يومية' : 'No journal entries found'}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Account Modal */}
      <Modal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        title={accountFormData.id ? (lang === 'ar' ? 'تعديل حساب' : 'Edit Account') : (lang === 'ar' ? 'إضافة حساب جديد' : 'Add New Account')}
        size="md"
        footer={
          <div className="flex gap-4 w-full">
            <Button 
              variant="secondary"
              onClick={() => setIsAccountModalOpen(false)}
              className="flex-1"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              type="submit"
              form="account-form"
              className="flex-1"
            >
              {lang === 'ar' ? 'حفظ' : 'Save'}
            </Button>
          </div>
        }
      >
        <form id="account-form" onSubmit={handleAccountSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'كود الحساب' : 'Account Code'}</label>
              <input 
                required
                type="text" 
                value={accountFormData.code}
                onChange={e => setAccountFormData({ ...accountFormData, code: e.target.value })}
                className="m-input"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'نوع الحساب' : 'Account Type'}</label>
              <select 
                value={accountFormData.type}
                onChange={e => setAccountFormData({ ...accountFormData, type: e.target.value as any })}
                className="m-input"
              >
                <option value="Asset">Asset</option>
                <option value="Liability">Liability</option>
                <option value="Equity">Equity</option>
                <option value="Revenue">Revenue</option>
                <option value="Expense">Expense</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'اسم الحساب' : 'Account Name'}</label>
            <input 
              required
              type="text" 
              value={accountFormData.name}
              onChange={e => setAccountFormData({ ...accountFormData, name: e.target.value })}
              className="m-input"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'الحساب الأب' : 'Parent Account'}</label>
            <select 
              value={accountFormData.parentId}
              onChange={e => setAccountFormData({ ...accountFormData, parentId: e.target.value })}
              className="m-input"
            >
              <option value="">None (Root)</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      {/* Journal Entry Modal */}
      <Modal
        isOpen={isJournalModalOpen}
        onClose={() => setIsJournalModalOpen(false)}
        title={lang === 'ar' ? 'قيد يومية جديد' : 'New Journal Entry'}
        size="xl"
        footer={
          <div className="flex gap-4 w-full">
            <Button 
              variant="secondary"
              onClick={() => setIsJournalModalOpen(false)}
              className="flex-1"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              type="submit"
              form="journal-form"
              className="flex-1"
            >
              {lang === 'ar' ? 'حفظ القيد' : 'Save Entry'}
            </Button>
          </div>
        }
      >
        <form id="journal-form" onSubmit={handleJournalSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'التاريخ' : 'Date'}</label>
              <input 
                required
                type="date" 
                value={journalFormData.date}
                onChange={e => setJournalFormData({ ...journalFormData, date: e.target.value })}
                className="m-input"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'المرجع' : 'Reference'}</label>
              <input 
                required
                type="text" 
                placeholder="JV-001"
                value={journalFormData.reference}
                onChange={e => setJournalFormData({ ...journalFormData, reference: e.target.value })}
                className="m-input"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'البيان' : 'Description'}</label>
              <input 
                required
                type="text" 
                value={journalFormData.description}
                onChange={e => setJournalFormData({ ...journalFormData, description: e.target.value })}
                className="m-input"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-sm uppercase tracking-widest text-zinc-400">{lang === 'ar' ? 'تفاصيل القيد' : 'Entry Details'}</h4>
              <Button 
                variant="secondary"
                size="sm"
                onClick={addJournalLine}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                {lang === 'ar' ? 'إضافة سطر' : 'Add Line'}
              </Button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {journalFormData.lines?.map((line, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <div className="md:col-span-5 space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">{lang === 'ar' ? 'الحساب' : 'Account'}</label>
                    <select 
                      required
                      value={line.accountId}
                      onChange={e => updateJournalLine(index, 'accountId', e.target.value)}
                      className="m-input py-3 text-sm"
                    >
                      <option value="">{lang === 'ar' ? 'اختر الحساب' : 'Select Account'}</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3 space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">{lang === 'ar' ? 'مدين' : 'Debit'}</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={line.debit || ''}
                      onChange={e => updateJournalLine(index, 'debit', parseFloat(e.target.value) || 0)}
                      className="m-input py-3 text-sm font-black text-primary"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">{lang === 'ar' ? 'دائن' : 'Credit'}</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={line.credit || ''}
                      onChange={e => updateJournalLine(index, 'credit', parseFloat(e.target.value) || 0)}
                      className="m-input py-3 text-sm font-black text-red-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="md:col-span-1 flex justify-center pb-2">
                    <Button 
                      variant="icon-danger"
                      onClick={() => removeJournalLine(index)}
                      leftIcon={<Trash2 className="w-5 h-5" />}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-zinc-100 dark:bg-zinc-800 rounded-3xl gap-6">
              <div className="flex gap-8">
                <div>
                  <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{lang === 'ar' ? 'إجمالي المدين' : 'Total Debit'}</div>
                  <div className="text-xl font-black text-primary">{currencySymbol} {(journalFormData.lines?.reduce((sum, l) => sum + (l.debit || 0), 0) || 0).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{lang === 'ar' ? 'إجمالي الدائن' : 'Total Credit'}</div>
                  <div className="text-xl font-black text-red-500">{currencySymbol} {(journalFormData.lines?.reduce((sum, l) => sum + (l.credit || 0), 0) || 0).toLocaleString()}</div>
                </div>
              </div>
              
              {Math.abs((journalFormData.lines?.reduce((sum, l) => sum + (l.debit || 0), 0) || 0) - (journalFormData.lines?.reduce((sum, l) => sum + (l.credit || 0), 0) || 0)) < 0.01 ? (
                <div className="flex items-center gap-2 text-primary font-black text-sm bg-primary/10 px-6 py-3 rounded-2xl">
                  <CheckCircle2 className="w-5 h-5" />
                  {lang === 'ar' ? 'القيد متزن' : 'Balanced'}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-500 font-black text-sm bg-red-100 px-6 py-3 rounded-2xl">
                  <AlertCircle className="w-5 h-5" />
                  {lang === 'ar' ? 'القيد غير متزن' : 'Unbalanced'}
                </div>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* General Ledger Modal */}
      <Modal
        isOpen={isLedgerModalOpen && !!selectedAccountId}
        onClose={() => setIsLedgerModalOpen(false)}
        title={lang === 'ar' ? 'كشف حساب' : 'General Ledger'}
        size="xl"
        footer={
          <Button
            variant="secondary"
            onClick={() => setIsLedgerModalOpen(false)}
            className="w-full"
          >
            {lang === 'ar' ? 'إغلاق' : 'Close'}
          </Button>
        }
      >
        {selectedAccountId && (
          <div className="space-y-6">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">{lang === 'ar' ? 'الحساب' : 'Account'}</div>
              <div className="text-lg font-bold">
                {accounts.find(a => a.id === selectedAccountId)?.name} ({accounts.find(a => a.id === selectedAccountId)?.code})
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left rtl:text-right border-collapse">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="py-4 px-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                    <th className="py-4 px-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">{lang === 'ar' ? 'المرجع' : 'Reference'}</th>
                    <th className="py-4 px-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">{lang === 'ar' ? 'البيان' : 'Description'}</th>
                    <th className="py-4 px-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">{lang === 'ar' ? 'مدين' : 'Debit'}</th>
                    <th className="py-4 px-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">{lang === 'ar' ? 'دائن' : 'Credit'}</th>
                  </tr>
                </thead>
                <tbody>
                  {journalEntries
                    .filter(entry => entry.lines.some(line => line.accountId === selectedAccountId))
                    .map((entry, idx) => {
                      const line = entry.lines.find(l => l.accountId === selectedAccountId);
                      return (
                        <tr key={entry.id || idx} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="py-4 px-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">{entry.date}</td>
                          <td className="py-4 px-2 text-sm font-black text-zinc-900 dark:text-white">{entry.reference}</td>
                          <td className="py-4 px-2 text-sm text-zinc-500">{entry.description}</td>
                          <td className="py-4 px-2 text-sm font-black text-primary">{line?.debit > 0 ? `${currencySymbol} ${line.debit.toLocaleString()}` : '-'}</td>
                          <td className="py-4 px-2 text-sm font-black text-red-500">{line?.credit > 0 ? `${currencySymbol} ${line.credit.toLocaleString()}` : '-'}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={confirmDelete}
        title={lang === 'ar' ? 'حذف الحساب' : 'Delete Account'}
        message={lang === 'ar' ? 'هل أنت متأكد من حذف هذا الحساب؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this account? This action cannot be undone.'}
        confirmText={lang === 'ar' ? 'حذف' : 'Delete'}
        cancelText={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        type="danger"
        lang={lang}
      />

      <ConfirmModal
        isOpen={isConfirmJournalDeleteOpen}
        onClose={() => setIsConfirmJournalDeleteOpen(false)}
        onConfirm={confirmDeleteJournalEntry}
        title={lang === 'ar' ? 'حذف القيد' : 'Delete Journal Entry'}
        message={lang === 'ar' ? 'هل أنت متأكد من حذف هذا القيد؟ سيتم عكس تأثيره على الحسابات. لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this journal entry? Its impact on accounts will be reversed. This action cannot be undone.'}
        confirmText={lang === 'ar' ? 'حذف' : 'Delete'}
        cancelText={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        type="danger"
        lang={lang}
      />
    </div>
  );
}

function AccountSummaryCard({ title, amount, color, currencySymbol }: any) {
  const colors: any = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 border-emerald-100 dark:border-emerald-900/20',
    red: 'bg-red-50 dark:bg-red-900/10 text-red-600 border-red-100 dark:border-red-900/20',
    zinc: 'bg-zinc-50 dark:bg-zinc-800/10 text-zinc-600 border-zinc-100 dark:border-zinc-800/20',
    primary: 'bg-primary/10 dark:bg-primary/20 text-primary border-primary/20 dark:border-primary/30'
  };

  return (
    <div className={`p-8 rounded-[2rem] border ${colors[color]} shadow-sm`}>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 mb-4">{title}</div>
      <div className="text-3xl font-black tracking-tighter">{currencySymbol} {amount}</div>
    </div>
  );
}
