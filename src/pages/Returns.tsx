import React, { useState, useEffect } from 'react';
import { translations } from '../translations';
import { useAuth } from '../hooks/useAuth';
import { Invoice, Product, Customer, Supplier, Return, ReturnItem } from '../types';
import Button from '../components/Button';
import { 
  RotateCcw, 
  Search, 
  Plus, 
  ArrowLeftRight, 
  Calendar, 
  User, 
  Hash, 
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ShoppingCart,
  X,
  ShieldAlert,
  Trash2
} from 'lucide-react';
import { motion } from 'motion/react';
import { logAction } from '../services/actionTrackingService';
import { getCollection, addToCollection, updateInCollection, subscribeToCollection, recordSalesReturn, recordPurchaseReturn, deleteReturn } from '../services/accountingService';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';

interface Props {
  lang: 'ar' | 'en';
  profile: any;
}

const Returns: React.FC<Props> = ({ lang, profile }) => {
  const { hasPermission } = useAuth();
  const t = translations[lang];

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [returnItems, setReturnItems] = useState<{ productId: string; quantity: number; reason: string }[]>([]);

  const [returns, setReturns] = useState<Return[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [returnToDelete, setReturnToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.companyId) return;

    const unsubInvoices = subscribeToCollection<Invoice>(profile.companyId, 'invoices', (data) => {
      setInvoices(data);
    });

    const unsubProducts = subscribeToCollection<Product>(profile.companyId, 'products', (data) => {
      setProducts(data);
    });

    const unsubReturns = subscribeToCollection<Return>(profile.companyId, 'returns', (data) => {
      setReturns(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });

    setLoading(false);

    return () => {
      unsubInvoices();
      unsubProducts();
      unsubReturns();
    };
  }, [profile?.companyId]);

  if (!hasPermission('create_invoices')) {
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

  const handleCreateReturn = async () => {
    if (!selectedInvoice || returnItems.length === 0 || !profile?.companyId) return;

    try {
      const returnAmount = returnItems.reduce((acc, item) => {
        const invItem = selectedInvoice.items.find(i => i.productId === item.productId);
        return acc + (invItem ? invItem.price * item.quantity : 0);
      }, 0);

      const returnDoc: Omit<Return, 'id'> = {
        companyId: profile.companyId,
        invoiceId: selectedInvoice.id!,
        invoiceNumber: selectedInvoice.number,
        type: selectedInvoice.type === 'sales' ? 'sales_return' : 'purchase_return',
        items: returnItems,
        totalAmount: returnAmount,
        createdAt: new Date().toISOString(),
        status: 'completed'
      };

      // 1. Save Return to Firestore
      const returnId = await addToCollection<Return>(profile.companyId, 'returns', returnDoc as any);

      // 2. Record in Accounting Service (handles inventory and balances)
      if (selectedInvoice.type === 'sales') {
        await recordSalesReturn(profile.companyId, { ...returnDoc, id: returnId });
      } else {
        await recordPurchaseReturn(profile.companyId, { ...returnDoc, id: returnId });
      }

      toast.success(lang === 'ar' ? 'تم تسجيل المرتجع بنجاح' : 'Return recorded successfully');
      setIsModalOpen(false);
      setSelectedInvoice(null);
      setReturnItems([]);
    } catch (error) {
      console.error('Error creating return:', error);
      toast.error(lang === 'ar' ? 'حدث خطأ أثناء تسجيل المرتجع' : 'Error recording return');
    }
  };

  const handleDelete = async (id: string) => {
    setReturnToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!returnToDelete || !profile?.companyId) return;
    try {
      await deleteReturn(profile.companyId, returnToDelete, profile.id || profile.uid);
      toast.success(lang === 'ar' ? 'تم حذف المرتجع بنجاح' : 'Return deleted successfully');
      setIsDeleteModalOpen(false);
      setReturnToDelete(null);
    } catch (error) {
      console.error("Error deleting return:", error);
      toast.error(lang === 'ar' ? 'خطأ في حذف المرتجع' : 'Error deleting return');
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(returns.length / pageSize);
  const paginatedReturns = returns.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="p-6 space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {lang === 'ar' ? 'إدارة المرتجعات' : 'Returns Management'}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            {lang === 'ar' ? 'معالجة مرتجعات المبيعات والمشتريات' : 'Process sales and purchase returns'}
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          leftIcon={<RotateCcw className="w-5 h-5" />}
          onClick={() => setIsModalOpen(true)}
        >
          {lang === 'ar' ? 'إنشاء مرتجع' : 'Create Return'}
        </Button>
      </div>

      {/* Recent Returns List (Placeholder for now) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-bold text-zinc-900 dark:text-white">
            {lang === 'ar' ? 'آخر المرتجعات' : 'Recent Returns'}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left rtl:text-right">
            <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="px-6 py-4">{lang === 'ar' ? 'رقم الفاتورة' : 'Invoice #'}</th>
                <th className="px-6 py-4">{lang === 'ar' ? 'النوع' : 'Type'}</th>
                <th className="px-6 py-4">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="px-6 py-4">{lang === 'ar' ? 'القيمة' : 'Amount'}</th>
                <th className="px-6 py-4">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="px-6 py-4 text-center">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {paginatedReturns.map((ret) => (
                <tr key={ret.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-zinc-900 dark:text-white">{ret.invoiceNumber}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      ret.type === 'sales_return' ? 'bg-primary/10 text-primary' : 'bg-rose-100 text-rose-600'
                    }`}>
                      {ret.type === 'sales_return' ? (lang === 'ar' ? 'مرتجع مبيعات' : 'Sales Return') : (lang === 'ar' ? 'مرتجع مشتريات' : 'Purchase Return')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-zinc-500">{new Date(ret.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 font-bold text-zinc-900 dark:text-white">{ret.totalAmount.toLocaleString()} EGP</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {ret.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Button
                      variant="icon-danger"
                      size="sm"
                      onClick={() => handleDelete(ret.id)}
                      title={lang === 'ar' ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {returns.length === 0 && (
                <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td colSpan={6} className="px-6 py-10 text-center text-zinc-500 italic">
                    {lang === 'ar' ? 'لا توجد مرتجعات مسجلة حالياً' : 'No returns recorded yet'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="p-6 border-t border-zinc-100 dark:border-zinc-800">
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalRecords={returns.length}
              pageSize={pageSize}
              lang={lang}
            />
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={lang === 'ar' ? 'إنشاء مرتجع جديد' : 'Create New Return'}
        size="lg"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              onClick={() => setIsModalOpen(false)}
              variant="secondary"
              className="flex-1"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            {selectedInvoice && (
              <Button
                onClick={handleCreateReturn}
                disabled={returnItems.length === 0}
                variant="primary"
                className="flex-1"
              >
                {lang === 'ar' ? 'تأكيد المرتجع' : 'Confirm Return'}
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-6">
          {!selectedInvoice ? (
            <div className="space-y-6">
              <div className="relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder={lang === 'ar' ? 'ابحث برقم الفاتورة...' : 'Search by invoice number...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-12 pl-4 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                />
              </div>

              <div className="space-y-3">
                {invoices.filter(inv => inv.number.toLowerCase().includes(searchTerm.toLowerCase())).map(inv => (
                  <Button
                    key={inv.id}
                    onClick={() => setSelectedInvoice(inv)}
                    variant="secondary"
                    className="w-full flex items-center justify-between p-4 h-auto"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                        <Hash className="w-6 h-6" />
                      </div>
                      <div className="text-right rtl:text-left">
                        <p className="font-bold text-zinc-900 dark:text-white">{inv.number}</p>
                        <p className="text-xs text-zinc-500">{inv.type === 'sales' ? (lang === 'ar' ? 'مبيعات' : 'Sales') : (lang === 'ar' ? 'مشتريات' : 'Purchases')}</p>
                      </div>
                    </div>
                    <div className="text-right rtl:text-left">
                      <p className="font-bold text-zinc-900 dark:text-white">{inv.total.toLocaleString()} EGP</p>
                      <p className="text-xs text-zinc-500">{inv.date}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                <div>
                  <p className="text-xs text-zinc-500">{lang === 'ar' ? 'الفاتورة المختارة' : 'Selected Invoice'}</p>
                  <p className="font-bold text-zinc-900 dark:text-white">{selectedInvoice.number}</p>
                </div>
                <Button 
                  onClick={() => setSelectedInvoice(null)}
                  variant="secondary"
                  size="sm"
                  className="text-primary"
                >
                  {lang === 'ar' ? 'تغيير' : 'Change'}
                </Button>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-zinc-900 dark:text-white">{lang === 'ar' ? 'اختر الأصناف المرتجعة' : 'Select Returned Items'}</h3>
                <div className="space-y-3">
                  {selectedInvoice.items.map(item => {
                    const product = products.find(p => p.id === item.productId);
                    const returnItem = returnItems.find(ri => ri.productId === item.productId);
                    
                    return (
                      <div key={item.productId} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                        <div className="flex-1">
                          <p className="font-bold text-zinc-900 dark:text-white">{product?.name || 'Unknown'}</p>
                          <p className="text-xs text-zinc-500">{lang === 'ar' ? 'الكمية الأصلية:' : 'Original Qty:'} {item.quantity}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            placeholder="0"
                            value={returnItem?.quantity || ''}
                            onChange={(e) => {
                              const qty = Math.min(Number(e.target.value), item.quantity);
                              if (qty > 0) {
                                setReturnItems(prev => {
                                  const existing = prev.find(p => p.productId === item.productId);
                                  if (existing) {
                                    return prev.map(p => p.productId === item.productId ? { ...p, quantity: qty } : p);
                                  }
                                  return [...prev, { productId: item.productId, quantity: qty, reason: '' }];
                                });
                              } else {
                                setReturnItems(prev => prev.filter(p => p.productId !== item.productId));
                              }
                            }}
                            className="w-20 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title={lang === 'ar' ? 'حذف المرتجع' : 'Delete Return'}
        message={lang === 'ar' ? 'هل أنت متأكد من حذف هذا المرتجع؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this return? This action cannot be undone.'}
        lang={lang}
      />
    </div>
  );
};

export default Returns;
