import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  FileText, 
  Printer, 
  Download, 
  Trash2, 
  ShoppingCart,
  Truck,
  Calendar,
  CreditCard,
  Package,
  X,
  Minus,
  Plus as PlusIcon,
  Percent,
  ShieldAlert,
  Edit2,
  Moon,
  Sun,
  FileDown
} from 'lucide-react';
import { Invoice, Product, Supplier, Account } from '../types';
import { translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { recordPurchaseInvoice, getCollection, addToCollection, updateInCollection, deleteInvoice, subscribeToCollection } from '../services/accountingService';
import { toast } from 'react-hot-toast';
import { fixArabic, initArabicPdf, generatePurchasePDF } from '../utils/pdfUtils';
import autoTable from 'jspdf-autotable';
import Pagination from '../components/Pagination';
import { logAction } from '../services/actionTrackingService';
import { getCurrencySymbol } from '../utils/currency';

import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Button from '../components/Button';

interface Props {
  lang: 'ar' | 'en';
  profile: any;
}

interface CartItem extends Product {
  cartQuantity: number;
}

import * as XLSX from 'xlsx';

export default function Purchases({ lang, profile }: Props) {
  const { user, hasPermission } = useAuth();
  const t = translations[lang];

  const currencySymbol = getCurrencySymbol(profile?.currency, lang);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [posSearchTerm, setPosSearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
  // Purchase State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [taxRate, setTaxRate] = useState(15);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  const exportToExcel = () => {
    const data = filteredInvoices.map(inv => ({
      [t.invoiceNumber]: inv.number,
      [t.supplier]: suppliers.find(s => s.id === inv.supplierId)?.name || 'Unknown',
      [t.date]: new Date(inv.date).toLocaleDateString(),
      [t.total]: inv.total,
      [lang === 'ar' ? 'الحالة' : 'Status']: inv.status
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Purchases");
    XLSX.writeFile(wb, `Purchases-${new Date().toISOString()}.xlsx`);
  };

  const getNextInvoiceNumber = (type: 'sales' | 'purchase') => {
    const filtered = invoices.filter(inv => inv.type === type);
    const prefix = type === 'sales' ? 'INV' : 'PUR';
    
    if (filtered.length === 0) return `${prefix}-001`;
    
    const numbers = filtered.map(inv => {
      const match = inv.number.match(/\d+/);
      return match ? parseInt(match[0]) : 0;
    });
    const max = Math.max(...numbers);
    return `${prefix}-${String(max + 1).padStart(3, '0')}`;
  };

  useEffect(() => {
    if (!profile?.companyId) return;

    const unsubInvoices = subscribeToCollection<Invoice>(profile.companyId, 'invoices', (data) => {
      setInvoices(data.filter(inv => inv.type === 'purchase').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });

    const unsubProducts = subscribeToCollection<Product>(profile.companyId, 'products', (data) => {
      setProducts(data.sort((a, b) => a.name.localeCompare(b.name)));
    });

    const unsubSuppliers = subscribeToCollection<Supplier>(profile.companyId, 'suppliers', (data) => {
      setSuppliers(data.sort((a, b) => a.name.localeCompare(b.name)));
    });

    const unsubAccounts = subscribeToCollection<Account>(profile.companyId, 'accounts', (data) => {
      setAccounts(data.filter(a => a.type === 'Asset' && (a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank'))));
    });

    return () => {
      unsubInvoices();
      unsubProducts();
      unsubSuppliers();
      unsubAccounts();
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

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, cartQuantity: item.cartQuantity + 1 } 
            : item
        );
      }
      return [...prev, { ...product, cartQuantity: 1 }];
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== productId));
      return;
    }
    setCart(prev => prev.map(item => 
      item.id === productId ? { ...item, cartQuantity: quantity } : item
    ));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.purchasePrice * item.cartQuantity), 0);
  const discountValue = discountType === 'percentage' ? (subtotal * discount / 100) : discount;
  const taxableAmount = subtotal - discountValue;
  const taxValue = taxableAmount * (taxRate / 100);
  const total = taxableAmount + taxValue;

  const editInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setSelectedSupplierId(invoice.supplierId || '');
    setSelectedAccountId(''); // Reset account selection for now

    setDiscount(invoice.discount);
    setDiscountType(invoice.discountType || 'percentage');
    setTaxRate(invoice.taxRate || 0);
    
    // Map invoice items back to cart items
    const cartItems: CartItem[] = invoice.items.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        ...(product || { id: item.productId, name: item.name, purchasePrice: item.price, quantity: 0, category: '', sku: '', minQuantity: 0, unit: 'unit', companyId: profile.companyId }),
        cartQuantity: item.quantity
      } as CartItem;
    });
    
    setCart(cartItems);
    setIsModalOpen(true);
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || !user) return;
    
    try {
      const supplier = suppliers.find(s => s.id === selectedSupplierId);
      const invoiceNumber = editingInvoice ? editingInvoice.number : getNextInvoiceNumber('purchase');
      
      const invoiceData: any = {
        ...(editingInvoice || {}),
        number: invoiceNumber,
        date: editingInvoice ? editingInvoice.date : new Date().toISOString(),
        supplierId: selectedSupplierId || null,
        supplierName: supplier?.name || 'Unknown Supplier',
        companyId: profile.companyId,
        items: cart.map(item => ({
          productId: item.id!,
          name: item.name,
          quantity: item.cartQuantity,
          price: item.purchasePrice,
          total: item.purchasePrice * item.cartQuantity
        })),
        subtotal,
        discount: discountValue,
        discountType,
        taxRate,
        tax: taxValue,
        total,
        paidAmount: selectedAccountId ? total : 0,
        paymentMethod: 'cash',
        type: 'purchase',
        status: selectedAccountId ? 'paid' : 'pending',
        userId: profile.id || user.uid
      };

      // 2. Save/Update Invoice
      let savedInvoice: Invoice;
      if (editingInvoice && editingInvoice.id) {
        await updateInCollection<Invoice>(profile.companyId, 'invoices', editingInvoice.id, invoiceData);
        savedInvoice = { ...invoiceData, id: editingInvoice.id };
      } else {
        savedInvoice = await addToCollection<Invoice>(profile.companyId, 'invoices', invoiceData);
      }

      // 3. Record Accounting Entry and handle stock via transaction in accountingService
      await recordPurchaseInvoice(profile.companyId, savedInvoice, selectedAccountId || undefined);
      
      // 5. Log Action
      await logAction({
        userId: profile.id || user.uid,
        companyId: profile.companyId,
        userName: profile.name || user.displayName || user.email || 'Unknown',
        action: editingInvoice ? 'EDITED_PURCHASE_INVOICE' : 'CREATED_PURCHASE_INVOICE',
        module: 'Purchases',
        details: `${editingInvoice ? 'Edited' : 'Created'} purchase invoice ${invoiceNumber} from ${supplier?.name} - Total: ${currencySymbol} ${total}`
      });

      toast.success(lang === 'ar' ? 'تم حفظ الفاتورة بنجاح' : 'Invoice saved successfully');
      
      setCart([]);
      setSelectedSupplierId('');
      setSelectedAccountId('');
      setDiscount(0);
      setEditingInvoice(null);
      setIsModalOpen(false);
      
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error(lang === 'ar' ? 'خطأ في حفظ الفاتورة' : 'Error saving invoice');
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    suppliers.find(s => s.id === inv.supplierId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredInvoices.length / pageSize);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(posSearchTerm.toLowerCase())
  );

  const exportToPDF = async (invoice: Invoice) => {
    const doc = await initArabicPdf();
    const isAr = lang === 'ar';
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;
    
    // Header Section
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 60, 'F');
    
    // Company Logo (Placeholder)
    doc.setFillColor(59, 130, 246);
    doc.circle(isAr ? pageWidth - 30 : 30, 30, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(12);
    doc.text(fixArabic(t.brand?.[0] || '?'), isAr ? pageWidth - 30 : 30, 31, { align: 'center' });
    
    // Company Name
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(18);
    doc.text(fixArabic(t.storeName), isAr ? pageWidth - 45 : 45, 32, { align: isAr ? 'right' : 'left' });
    
    // Invoice Title & Details
    doc.setFontSize(24);
    doc.setTextColor(59, 130, 246);
    doc.text(fixArabic(isAr ? 'فاتورة شراء' : 'Purchase Invoice'), isAr ? margin : pageWidth - margin, 32, { align: isAr ? 'left' : 'right' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(fixArabic(`${isAr ? 'رقم الفاتورة' : 'Invoice #'}: ${invoice.number}`), isAr ? margin : pageWidth - margin, 42, { align: isAr ? 'left' : 'right' });
    doc.text(fixArabic(`${isAr ? 'التاريخ' : 'Date'}: ${new Date(invoice.date).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}`), isAr ? margin : pageWidth - margin, 48, { align: isAr ? 'left' : 'right' });
    
    // Supplier Section
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('Cairo', 'bold');
    doc.text(fixArabic(isAr ? 'معلومات المورد' : 'Supplier Information'), isAr ? pageWidth - margin : margin, 80, { align: isAr ? 'right' : 'left' });
    
    doc.setFont('Cairo', 'normal');
    doc.setFontSize(11);
    const supplier = suppliers.find(s => s.id === invoice.supplierId);
    doc.text(fixArabic(`${isAr ? 'الاسم' : 'Name'}: ${supplier?.name || '---'}`), isAr ? pageWidth - margin : margin, 90, { align: isAr ? 'right' : 'left' });
    
    const tableData = invoice.items.map(item => [
      fixArabic(item.name),
      item.quantity,
      item.price.toFixed(2),
      item.total.toFixed(2)
    ]);

    autoTable(doc, {
      startY: 100,
      head: [[
        fixArabic(isAr ? 'المنتج' : 'Product'), 
        fixArabic(isAr ? 'الكمية' : 'Qty'), 
        fixArabic(isAr ? 'السعر' : 'Price'), 
        fixArabic(isAr ? 'الإجمالي' : 'Total')
      ]],
      body: tableData,
      styles: { 
        font: 'Cairo', 
        fontSize: 10,
        cellPadding: 6,
        halign: isAr ? 'right' : 'left' 
      },
      headStyles: { 
        fillColor: [59, 130, 246], 
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: isAr ? 'right' : 'left' 
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: margin, right: margin }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 150;
    
    doc.setFontSize(11);
    const totalsX = isAr ? margin : pageWidth - margin - 40;
    const labelsX = isAr ? margin + 60 : pageWidth - margin - 60;
    const align = isAr ? 'left' : 'right';

    doc.setFont('Cairo', 'normal');
    doc.text(fixArabic(`${isAr ? 'المجموع الفرعي' : 'Subtotal'}:`), labelsX, finalY + 20, { align: isAr ? 'right' : 'left' });
    doc.text(`${invoice.subtotal.toFixed(2)} ${currencySymbol}`, totalsX, finalY + 20, { align });

    doc.text(fixArabic(`${isAr ? 'الخصم' : 'Discount'}:`), labelsX, finalY + 30, { align: isAr ? 'right' : 'left' });
    doc.text(`${invoice.discount.toFixed(2)} ${currencySymbol}`, totalsX, finalY + 30, { align });

    doc.text(fixArabic(`${isAr ? 'الضريبة' : 'Tax'}:`), labelsX, finalY + 40, { align: isAr ? 'right' : 'left' });
    doc.text(`${invoice.tax.toFixed(2)} ${currencySymbol}`, totalsX, finalY + 40, { align });

    doc.setDrawColor(226, 232, 240);
    doc.line(isAr ? margin : pageWidth - margin - 100, finalY + 45, isAr ? margin + 100 : pageWidth - margin, finalY + 45);

    doc.setFontSize(16);
    doc.setFont('Cairo', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text(fixArabic(`${isAr ? 'الإجمالي النهائي' : 'Final Total'}:`), labelsX, finalY + 60, { align: isAr ? 'right' : 'left' });
    doc.text(`${invoice.total.toFixed(2)} ${currencySymbol}`, totalsX, finalY + 60, { align });

    doc.save(`Purchase-Invoice-${invoice.number}.pdf`);
  };

  const confirmDelete = async () => {
    if (!invoiceToDelete || !profile?.companyId) return;
    try {
      await deleteInvoice(profile.companyId, invoiceToDelete, profile.id || profile.uid);
      setInvoices(prev => prev.filter(i => i.id !== invoiceToDelete));
      toast.success(lang === 'ar' ? 'تم حذف الفاتورة' : 'Invoice deleted');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(lang === 'ar' ? 'خطأ في الحذف' : 'Delete error');
    } finally {
      setIsConfirmDeleteOpen(false);
      setInvoiceToDelete(null);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="relative w-full md:w-[450px] group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder={lang === 'ar' ? 'بحث عن فاتورة شراء...' : 'Search purchase invoices...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] focus:ring-4 focus:ring-primary/10 transition-all outline-none shadow-sm font-medium"
          />
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Button 
            onClick={exportToExcel}
            variant="secondary"
            className="p-4.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-[1.5rem] font-bold shadow-sm hover:bg-zinc-50"
            title={lang === 'ar' ? 'تصدير إكسل' : 'Export Excel'}
            leftIcon={<Download className="w-5 h-5" />}
          >
            <span className="hidden sm:inline">{lang === 'ar' ? 'تصدير إكسل' : 'Export Excel'}</span>
          </Button>
          <Button 
            onClick={() => {
              setEditingInvoice(null);
              setCart([]);
              setSelectedSupplierId('');
              setSelectedAccountId('');
              setDiscount(0);
              setIsModalOpen(true);
            }}
            variant="primary"
            className="px-10 py-4.5 rounded-[1.5rem] font-black shadow-2xl shadow-primary/20"
            leftIcon={<Plus className="w-6 h-6" />}
          >
            {lang === 'ar' ? 'فاتورة شراء جديدة' : 'New Purchase Invoice'}
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left responsive-table">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t.invoiceNumber}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t.supplier}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t.date}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t.total}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] text-right">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {paginatedInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                  <td className="px-10 py-8 font-black text-zinc-900 dark:text-white" data-label={t.invoiceNumber}>{inv.number}</td>
                  <td className="px-10 py-8 text-sm font-black text-zinc-600 dark:text-zinc-400" data-label={t.supplier}>
                    {suppliers.find(s => s.id === inv.supplierId)?.name || 'Unknown Supplier'}
                  </td>
                  <td className="px-10 py-8 text-sm text-zinc-500 font-medium" data-label={t.date}>{new Date(inv.date).toLocaleDateString()}</td>
                  <td className="px-10 py-8 font-black text-primary" data-label={t.total}>{currencySymbol} {inv.total.toLocaleString()}</td>
                  <td className="px-10 py-8" data-label={lang === 'ar' ? 'الحالة' : 'Status'}>
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      inv.status === 'paid' ? 'bg-primary/10 text-primary' : 'bg-yellow-100 text-yellow-600'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <Button 
                        onClick={() => setViewingInvoice(inv)}
                        variant="secondary"
                        size="icon"
                        className="p-3 text-zinc-400 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded-xl bg-transparent"
                        title={lang === 'ar' ? 'عرض الفاتورة' : 'View Invoice'}
                        leftIcon={<FileText className="w-5 h-5" />}
                      />
                      <Button 
                        onClick={() => editInvoice(inv)}
                        variant="secondary"
                        size="icon"
                        className="p-3 text-zinc-400 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded-xl bg-transparent"
                        title={lang === 'ar' ? 'تعديل الفاتورة' : 'Edit Invoice'}
                        leftIcon={<Edit2 className="w-5 h-5" />}
                      />
                      <Button 
                        onClick={() => {
                          setInvoiceToDelete(inv.id!);
                          setIsConfirmDeleteOpen(true);
                        }}
                        variant="icon-danger"
                        size="icon"
                        className="p-3 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl bg-transparent"
                        title={lang === 'ar' ? 'حذف الفاتورة' : 'Delete Invoice'}
                        leftIcon={<Trash2 className="w-5 h-5" />}
                      />
                      <Button 
                        onClick={() => exportToPDF(inv)}
                        variant="secondary"
                        size="icon"
                        className="p-3 text-zinc-400 hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/20 rounded-xl bg-transparent"
                        title={lang === 'ar' ? 'تصدير PDF' : 'Export PDF'}
                        leftIcon={<Download className="w-5 h-5" />}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalRecords={filteredInvoices.length}
          pageSize={pageSize}
          lang={lang}
        />
      </div>

      {/* Viewing Invoice Modal */}
      <Modal
        isOpen={!!viewingInvoice && !isModalOpen}
        onClose={() => setViewingInvoice(null)}
        title={`${lang === 'ar' ? 'فاتورة شراء رقم' : 'Purchase Invoice #'} ${viewingInvoice?.number}`}
        size="lg"
        footer={
          <div className="flex gap-4 w-full">
            <Button 
              onClick={() => viewingInvoice && generatePurchasePDF(viewingInvoice, lang)}
              variant="secondary"
              className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl font-black hover:bg-zinc-200"
              leftIcon={<Download className="w-5 h-5" />}
            >
              PDF
            </Button>
            <Button 
              onClick={() => window.print()}
              variant="primary"
              className="flex-1 py-4 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-700 shadow-lg shadow-emerald-600/20"
              leftIcon={<Printer className="w-5 h-5" />}
            >
              {lang === 'ar' ? 'طباعة الفاتورة' : 'Print Invoice'}
            </Button>
          </div>
        }
      >
        {viewingInvoice && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-6 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-700/50">
                <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">{t.supplierName}</div>
                <div className="font-black text-lg">{viewingInvoice.supplierName}</div>
              </div>
              <div className="p-6 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-700/50">
                <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">{t.date}</div>
                <div className="font-black text-lg">{new Date(viewingInvoice.date).toLocaleDateString()}</div>
              </div>
            </div>

            <div className="border border-zinc-100 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-sm responsive-table">
                <thead className="bg-zinc-50 dark:bg-zinc-800">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t.productName}</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t.quantity}</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t.total}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {viewingInvoice.items.map((item, i) => (
                    <tr key={i} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4 font-bold" data-label={t.productName}>{item.name}</td>
                      <td className="px-6 py-4 text-center font-black" data-label={t.quantity}>{item.quantity}</td>
                      <td className="px-6 py-4 text-right font-black text-emerald-600" data-label={t.total}>{currencySymbol} {item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 pt-6 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex justify-between text-sm font-bold">
                <span className="text-zinc-500">{t.subtotal}</span>
                <span className="text-zinc-900 dark:text-white">{currencySymbol} {viewingInvoice.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-zinc-500">{t.discount}</span>
                <span className="text-red-500">- {currencySymbol} {viewingInvoice.discount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-zinc-500">{t.taxValue}</span>
                <span className="text-zinc-900 dark:text-white">{currencySymbol} {viewingInvoice.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-2xl md:text-3xl font-black pt-6 border-t border-zinc-100 dark:border-zinc-800 tracking-tight">
                <span>{t.total}</span>
                <span className="text-emerald-600">{currencySymbol} {viewingInvoice.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Purchase Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={lang === 'ar' ? 'فاتورة شراء' : 'Purchase Invoice'}
        size="xl"
        footer={
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <div className="flex-1 flex flex-col justify-center">
              <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t.total}</div>
              <div className="text-2xl font-black text-primary">{currencySymbol} {total.toFixed(2)}</div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setIsModalOpen(false)}
                variant="secondary"
                className="px-8 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl font-black hover:bg-zinc-200"
              >
                {t.cancel}
              </Button>
              <Button
                onClick={handleCheckout}
                disabled={cart.length === 0 || !selectedSupplierId}
                variant="primary"
                className="px-12 py-4 rounded-xl font-black shadow-xl shadow-primary/20 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                leftIcon={<CreditCard className="w-5 h-5" />}
              >
                {lang === 'ar' ? 'حفظ فاتورة الشراء' : 'Save Purchase Invoice'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col lg:flex-row gap-8">
          {/* LEFT SIDE: Product Selection */}
          <div className="flex-1 space-y-6">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder={t.searchProduct}
                value={posSearchTerm}
                onChange={(e) => setPosSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-primary/10 transition-all font-bold shadow-sm" 
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredProducts.map(product => (
                <div 
                  key={product.id} 
                  onClick={() => addToCart(product)}
                  className="p-3 md:p-5 bg-white dark:bg-zinc-800 rounded-[1.5rem] hover:ring-4 hover:ring-primary/20 cursor-pointer transition-all group relative shadow-sm border border-zinc-100 dark:border-zinc-700/50 active:scale-[0.98]"
                >
                  <div className="w-full aspect-square bg-zinc-50 dark:bg-zinc-700 rounded-xl mb-3 flex items-center justify-center text-zinc-300 group-hover:scale-105 transition-all duration-500">
                    <Package className="w-8 h-8 md:w-10 md:h-10" />
                  </div>
                  <div className="font-black text-xs md:text-sm mb-1 text-zinc-900 dark:text-white line-clamp-1 group-hover:text-primary transition-colors">{product.name}</div>
                  <div className="flex justify-between items-center">
                    <span className="text-primary font-black text-xs md:text-base">{currencySymbol} {product.purchasePrice.toLocaleString()}</span>
                    <span className="text-[8px] md:text-[10px] font-black px-2 py-1 bg-zinc-100 dark:bg-zinc-700 rounded-lg text-zinc-500 dark:text-zinc-300 uppercase tracking-widest">
                      {product.quantity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT SIDE: Cart & Totals */}
          <div className="w-full lg:w-[450px] space-y-6">
            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                  <Truck className="w-6 h-6" />
                </div>
                <h4 className="text-xl font-black tracking-tighter">{lang === 'ar' ? 'تفاصيل الشراء' : 'Purchase Details'}</h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t.supplier}</label>
                  <select 
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-4 focus:ring-primary/10 font-bold"
                  >
                    <option value="">{lang === 'ar' ? 'اختر مورد' : 'Select Supplier'}</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'حساب الدفع' : 'Payment Account'}</label>
                  <select 
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-4 focus:ring-primary/10 font-bold"
                  >
                    <option value="">{lang === 'ar' ? 'شراء آجل (دائنون)' : 'Credit Purchase (AP)'}</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar mb-6">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-start gap-4 p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 group">
                    <div className="flex-1">
                      <div className="text-xs font-black text-zinc-900 dark:text-white">{item.name}</div>
                      <div className="text-[10px] text-zinc-500 font-bold flex items-center gap-2 mt-1">
                        <span>{item.cartQuantity} x {currencySymbol} {item.purchasePrice.toLocaleString()}</span>
                        <div className="flex items-center gap-1">
                          <Button onClick={() => updateCartQuantity(item.id!, item.cartQuantity - 1)} variant="secondary" size="icon" className="w-6 h-6 p-0 bg-zinc-50 dark:bg-zinc-700" leftIcon={<Minus className="w-3 h-3" />} />
                          <Button onClick={() => updateCartQuantity(item.id!, item.cartQuantity + 1)} variant="secondary" size="icon" className="w-6 h-6 p-0 bg-zinc-50 dark:bg-zinc-700" leftIcon={<PlusIcon className="w-3 h-3" />} />
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-black text-primary">{currencySymbol} {(item.purchasePrice * item.cartQuantity).toFixed(2)}</div>
                  </div>
                ))}
                {cart.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-300 dark:text-zinc-700 py-10">
                    <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Cart is empty</p>
                  </div>
                )}
              </div>

              <div className="space-y-3 border-t border-dashed border-zinc-200 dark:border-zinc-700 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t.discount}</label>
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        value={discount}
                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                        className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none"
                      />
                      <Button 
                        onClick={() => setDiscountType(discountType === 'percentage' ? 'fixed' : 'percentage')}
                        variant="secondary"
                        size="sm"
                        className="px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-700 rounded-xl text-xs font-black"
                      >
                        {discountType === 'percentage' ? '%' : currencySymbol}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'الضريبة (15%)' : 'Tax (15%)'}</label>
                    <Button 
                      onClick={() => setTaxRate(taxRate === 15 ? 0 : 15)}
                      variant="secondary"
                      className={`w-full px-3 py-2 rounded-xl text-xs font-black transition-all border ${
                        taxRate > 0 
                          ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800' 
                          : 'bg-zinc-100 border-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:border-zinc-700'
                      }`}
                    >
                      {taxRate > 0 ? (lang === 'ar' ? 'مفعل' : 'Enabled') : (lang === 'ar' ? 'معطل' : 'Disabled')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={confirmDelete}
        title={lang === 'ar' ? 'حذف الفاتورة' : 'Delete Invoice'}
        message={lang === 'ar' ? 'هل أنت متأكد من حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this invoice? This action cannot be undone.'}
        confirmText={lang === 'ar' ? 'حذف' : 'Delete'}
        cancelText={lang === 'ar' ? 'إلغاء' : 'Cancel'}
        type="danger"
        lang={lang}
      />
    </div>
  );
}
