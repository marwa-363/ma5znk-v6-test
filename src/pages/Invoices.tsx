import React, { useState, useEffect, useRef } from 'react';
import Button from '../components/Button';
import { Plus, Search, FileText, Printer, Download, Trash2, ShoppingCart, User, Calendar, CreditCard, Package, X, Minus, Plus as PlusIcon, ScanBarcode, Percent, Banknote, Eye, FileDown, Mic, MicOff, Edit2 } from 'lucide-react';
import { Invoice, Product, Customer, Account, InvoiceItem } from '../types';
import { translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { fixArabic, initArabicPdf, generateInvoicePDF } from '../utils/pdfUtils';
import { useAuth } from '../hooks/useAuth';
import Pagination from '../components/Pagination';
import { Filter, RotateCcw } from 'lucide-react';
import { logAction } from '../services/actionTrackingService';
import { recordSalesInvoice, getCollection, addToCollection, updateInCollection, deleteInvoice, subscribeToCollection } from '../services/accountingService';
import { getCurrencySymbol, formatCurrency } from '../utils/currency';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { useVoiceInput } from '../hooks/useVoiceInput';

import ConfirmModal from '../components/ConfirmModal';

import Modal from '../components/Modal';

interface Props {
  lang: 'ar' | 'en';
  profile: any;
}

interface CartItem extends Product {
  cartQuantity: number;
  selectedPriceType: 'sellingPrice' | 'wholesalePrice' | 'vipPrice';
  selectedPrice: number;
}

export default function Invoices({ lang, profile }: Props) {
  const { user, hasPermission } = useAuth();
  const t = translations[lang];
  const currencySymbol = getCurrencySymbol(profile?.currency, lang);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [posSearchTerm, setPosSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isVatEnabled, setIsVatEnabled] = useState(profile?.currency === 'SAR');
  
  const { isListening, transcript, startListening, stopListening } = useVoiceInput(lang);

  useEffect(() => {
    if (transcript) {
      setPosSearchTerm(transcript);
    }
  }, [transcript]);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
  // POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [taxRate, setTaxRate] = useState(15);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer' | 'credit'>('cash');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  const barcodeRef = useRef<HTMLInputElement>(null);

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
      setInvoices(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });

    const unsubProducts = subscribeToCollection<Product>(profile.companyId, 'products', (data) => {
      setProducts(data.sort((a, b) => a.name.localeCompare(b.name)));
    });

    const unsubCustomers = subscribeToCollection<Customer>(profile.companyId, 'customers', (data) => {
      setCustomers(data.sort((a, b) => a.name.localeCompare(b.name)));
    });

    const unsubAccounts = subscribeToCollection<Account>(profile.companyId, 'accounts', (data) => {
      setAccounts(data.filter(a => a.type === 'Asset' && (a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank'))));
    });

    return () => {
      unsubInvoices();
      unsubProducts();
      unsubCustomers();
      unsubAccounts();
    };
  }, [profile?.companyId]);

  const editInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setCart(invoice.items.map(item => {
      const product = products.find(p => p.id === item.productId);
      return {
        ...product!,
        cartQuantity: item.quantity,
        selectedPriceType: item.priceType === 'retail' ? 'sellingPrice' : 
                          item.priceType === 'wholesale' ? 'wholesalePrice' : 'vipPrice',
        selectedPrice: item.price
      };
    }));
    setSelectedCustomerId(invoice.customerId || '');
    setDiscount(invoice.discountType === 'percentage' ? (invoice.discount / invoice.subtotal * 100) : invoice.discount);
    setDiscountType(invoice.discountType);
    setPaymentMethod(invoice.paymentMethod);
    setInvoiceDate(new Date(invoice.date).toISOString().split('T')[0]);
    setDueDate(new Date(invoice.dueDate).toISOString().split('T')[0]);
    setNotes(invoice.notes || '');
    setIsVatEnabled(invoice.taxRate > 0);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (isModalOpen && barcodeRef.current) {
      barcodeRef.current.focus();
    }
    
    if (!isModalOpen) {
      setEditingInvoice(null);
      setCart([]);
      setSelectedCustomerId('');
      setDiscount(0);
      setNotes('');
    }
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
        setViewingInvoice(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isModalOpen]);

  const addToCart = (product: Product, priceType: 'sellingPrice' | 'wholesalePrice' | 'vipPrice' = 'sellingPrice') => {
    if (product.quantity <= 0) {
      toast.error(lang === 'ar' ? 'هذا المنتج غير متوفر في المخزون' : 'This product is out of stock');
      return;
    }

    const price = product[priceType] || product.sellingPrice;

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id && item.selectedPriceType === priceType);
      if (existing) {
        if (existing.cartQuantity + 1 > product.quantity) {
          toast.error(lang === 'ar' ? 'الكمية المطلوبة أكبر من الكمية المتاحة في المخزون' : 'Requested quantity exceeds available stock');
          return prev;
        }
        return prev.map(item => 
          (item.id === product.id && item.selectedPriceType === priceType)
            ? { ...item, cartQuantity: item.cartQuantity + 1 } 
            : item
        );
      }
      return [...prev, { 
        ...product, 
        cartQuantity: 1, 
        selectedPriceType: priceType,
        selectedPrice: price
      }];
    });
  };

  const updateCartPriceType = (productId: string, priceType: 'sellingPrice' | 'wholesalePrice' | 'vipPrice') => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const price = product[priceType] || product.sellingPrice;

    setCart(prev => prev.map(item => 
      item.id === productId 
        ? { ...item, selectedPriceType: priceType, selectedPrice: price } 
        : item
    ));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== productId));
      return;
    }

    if (quantity > product.quantity) {
      toast.error(lang === 'ar' ? 'الكمية المطلوبة أكبر من الكمية المتاحة في المخزون' : 'Requested quantity exceeds available stock');
    }

    setCart(prev => prev.map(item => 
      item.id === productId ? { ...item, cartQuantity: quantity } : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.barcode === barcodeInput || p.sku === barcodeInput);
    if (product) {
      addToCart(product);
      setBarcodeInput('');
      toast.success(lang === 'ar' ? `تم إضافة ${product.name}` : `Added ${product.name}`);
    } else {
      toast.error(t.productNotFound);
    }
  };

  const handleBarcodeScan = (decodedText: string) => {
    const product = products.find(p => p.barcode === decodedText || p.sku === decodedText);
    if (product) {
      addToCart(product);
      toast.success(lang === 'ar' ? `تم إضافة ${product.name}` : `Added ${product.name}`);
    } else {
      toast.error(t.productNotFound);
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.selectedPrice * item.cartQuantity), 0);
  const discountValue = discountType === 'percentage' ? (subtotal * discount / 100) : discount;
  const taxableAmount = subtotal - discountValue;
  
  const effectiveTaxRate = isVatEnabled ? 15 : 0;
  const taxValue = taxableAmount * (effectiveTaxRate / 100);
  const total = taxableAmount + taxValue;

  const handleCheckout = async () => {
    if (cart.length === 0 || !user) return;

    // Validate Stock (only for new items or increased quantity)
    for (const item of cart) {
      const product = products.find(p => p.id === item.id);
      if (!product) continue;
      
      const originalItem = editingInvoice?.items.find(i => i.productId === item.id);
      const originalQty = originalItem?.quantity || 0;
      const neededQty = item.cartQuantity - originalQty;
      
      if (neededQty > product.quantity) {
        toast.error(lang === 'ar' ? `الكمية المطلوبة لـ ${item.name} غير متوفرة` : `Insufficient stock for ${item.name}`);
        return;
      }
    }
    
    try {
      const invoiceNumber = editingInvoice ? editingInvoice.number : getNextInvoiceNumber('sales');
      const customer = customers.find(c => c.id === selectedCustomerId);
      
      const invoiceData: any = {
        number: invoiceNumber,
        date: new Date(invoiceDate).toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        notes,
        customerId: selectedCustomerId || null,
        customerName: customer?.name || (lang === 'ar' ? 'عميل نقدي' : 'Cash Customer'),
        items: cart.map(item => ({
          productId: item.id!,
          name: item.name,
          quantity: item.cartQuantity,
          price: item.selectedPrice,
          priceType: item.selectedPriceType === 'sellingPrice' ? 'retail' : 
                     item.selectedPriceType === 'wholesalePrice' ? 'wholesale' : 'vip',
          total: item.selectedPrice * item.cartQuantity
        })),
        subtotal,
        discount: discountValue,
        discountType,
        taxRate: effectiveTaxRate,
        tax: taxValue,
        total,
        paidAmount: paymentMethod === 'credit' ? 0 : total,
        paymentMethod,
        type: 'sales',
        status: paymentMethod === 'credit' ? 'unpaid' : 'paid',
        userId: profile.id || user.uid,
        companyId: profile.companyId
      };

      let savedInvoice;
      if (editingInvoice) {
        // 1. Update Invoice
        await updateInCollection<Invoice>(profile.companyId, 'invoices', editingInvoice.id!, invoiceData);
        savedInvoice = { ...invoiceData, id: editingInvoice.id };
      } else {
        // 1. Save New Invoice
        savedInvoice = await addToCollection<Invoice>(profile.companyId, 'invoices', invoiceData);
      }

      // 2. Record Accounting Entry and handle stock via transaction in accountingService
      await recordSalesInvoice(profile.companyId, savedInvoice, selectedAccountId || undefined);
      
      // 5. Log Action
      await logAction({
        userId: profile.id || user.uid,
        companyId: profile.companyId,
        userName: profile.name || user.displayName || user.email || 'Unknown',
        action: editingInvoice ? 'UPDATED_INVOICE' : 'CREATED_INVOICE',
        module: 'Sales',
        details: `${editingInvoice ? 'Updated' : 'Created'} invoice ${invoiceNumber} for ${invoiceData.customerName} - Total: ${currencySymbol} ${total}`
      });

      // Print after save
      setViewingInvoice(savedInvoice as any);
      
      setCart([]);
      setSelectedCustomerId('');
      setSelectedAccountId('');
      setDiscount(0);
      setIsModalOpen(false);
      setEditingInvoice(null);
      
      setTimeout(() => {
        window.print();
      }, 500);

    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(lang === 'ar' ? 'خطأ في إتمام العملية' : 'Checkout error');
    }
  };

  const handleDelete = async (id: string) => {
    setInvoiceToDelete(id);
    setIsConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!invoiceToDelete || !profile?.companyId) return;
    try {
      await deleteInvoice(profile.companyId, invoiceToDelete, profile.id || profile.uid);
      setInvoices(prev => prev.filter(inv => inv.id !== invoiceToDelete));
      toast.success(lang === 'ar' ? 'تم حذف الفاتورة' : 'Invoice deleted');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(lang === 'ar' ? 'خطأ في الحذف' : 'Delete error');
    } finally {
      setIsConfirmDeleteOpen(false);
      setInvoiceToDelete(null);
    }
  };

  const exportToPDF = async (invoice: Invoice) => {
    const doc = await initArabicPdf();
    const isAr = lang === 'ar';
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;
    
    // Header Section
    doc.setFillColor(248, 250, 252); // Light gray background for header
    doc.rect(0, 0, pageWidth, 60, 'F');
    
    // Company Logo (Placeholder)
    doc.setFillColor(16, 185, 129); // Emerald-600
    doc.roundedRect(isAr ? pageWidth - 40 : margin, 15, 20, 20, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(14);
    doc.text('M', isAr ? pageWidth - 30 : margin + 10, 29, { align: 'center' });
    
    // Company Name
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.setFontSize(18);
    doc.text(fixArabic(t.brand), isAr ? pageWidth - 45 : margin + 25, 28, { align: isAr ? 'right' : 'left' });
    doc.setFontSize(10);
    doc.setFont('Cairo', 'normal');
    doc.text(fixArabic(isAr ? 'نظام المحاسبة المتكامل' : 'Integrated Accounting System'), isAr ? pageWidth - 45 : margin + 25, 35, { align: isAr ? 'right' : 'left' });
    
    // Invoice Title & Details
    doc.setFontSize(22);
    doc.setFont('Cairo', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(fixArabic(isAr ? 'فاتورة ضريبية' : 'Tax Invoice'), isAr ? margin : pageWidth - margin, 28, { align: isAr ? 'left' : 'right' });
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.setFont('Cairo', 'normal');
    doc.text(fixArabic(`${isAr ? 'رقم الفاتورة' : 'Invoice #'}: ${invoice.number}`), isAr ? margin : pageWidth - margin, 38, { align: isAr ? 'left' : 'right' });
    doc.text(fixArabic(`${isAr ? 'التاريخ' : 'Date'}: ${new Date(invoice.date).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}`), isAr ? margin : pageWidth - margin, 44, { align: isAr ? 'left' : 'right' });
    
    // Customer Section
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('Cairo', 'bold');
    doc.text(fixArabic(isAr ? 'معلومات العميل' : 'Customer Information'), isAr ? pageWidth - margin : margin, 80, { align: isAr ? 'right' : 'left' });
    
    doc.setFont('Cairo', 'normal');
    doc.setFontSize(10);
    doc.text(fixArabic(`${isAr ? 'الاسم' : 'Name'}: ${invoice.customerName}`), isAr ? pageWidth - margin : margin, 88, { align: isAr ? 'right' : 'left' });
    
    // Products Table
    const tableData = invoice.items.map(item => [
      fixArabic(item.name),
      item.quantity,
      `${currencySymbol} ${item.price.toLocaleString()}`,
      `${currencySymbol} ${item.total.toLocaleString()}`
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
        fontSize: 9,
        cellPadding: 6,
        halign: isAr ? 'right' : 'left' 
      },
      headStyles: { 
        fillColor: [30, 41, 59], 
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: isAr ? 'right' : 'left' 
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: margin, right: margin },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold' }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 150;
    
    // Totals Section
    const totalsX = isAr ? margin : pageWidth - margin;
    const align = isAr ? 'left' : 'right';

    doc.setFontSize(10);
    doc.setFont('Cairo', 'normal');
    doc.setTextColor(100);
    doc.text(fixArabic(`${isAr ? 'المجموع الفرعي' : 'Subtotal'}: ${currencySymbol} ${invoice.subtotal.toLocaleString()}`), totalsX, finalY + 15, { align });
    doc.text(fixArabic(`${isAr ? 'الخصم' : 'Discount'}: ${currencySymbol} ${invoice.discount.toLocaleString()}`), totalsX, finalY + 22, { align });
    doc.text(fixArabic(`${isAr ? 'الضريبة' : 'Tax'}: ${currencySymbol} ${invoice.tax.toLocaleString()}`), totalsX, finalY + 29, { align });

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, finalY + 35, pageWidth - margin, finalY + 35);

    doc.setFontSize(14);
    doc.setFont('Cairo', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(fixArabic(`${isAr ? 'الإجمالي النهائي' : 'Final Total'}: ${currencySymbol} ${invoice.total.toLocaleString()}`), totalsX, finalY + 45, { align });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(fixArabic(isAr ? 'شكراً لتعاملكم معنا! تم إنشاء هذه الفاتورة إلكترونياً.' : 'Thank you for your business! This is an electronically generated invoice.'), pageWidth / 2, 285, { align: 'center' });

    doc.save(`Invoice-${invoice.number}.pdf`);
  };

  const exportReceiptPDF = async (invoice: Invoice) => {
    // 80mm width for thermal printers
    const doc = await initArabicPdf();
    const isAr = lang === 'ar';
    const width = 80;
    const margin = 5;
    
    // Set custom page size
    (doc as any).internal.pageSize.width = width;
    (doc as any).internal.pageSize.height = 150; 

    const centerX = width / 2;
    
    // Company Header
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(14);
    doc.text(fixArabic(t.brand), centerX, 10, { align: 'center' });
    
    doc.setFont('Cairo', 'normal');
    doc.setFontSize(8);
    doc.text(fixArabic(isAr ? 'فاتورة مبسطة' : 'Simplified Invoice'), centerX, 15, { align: 'center' });
    
    doc.setDrawColor(200);
    doc.line(margin, 18, width - margin, 18);
    
    // Invoice Info
    doc.setFontSize(7);
    doc.text(fixArabic(`${isAr ? 'رقم الفاتورة' : 'Invoice #'}: ${invoice.number}`), isAr ? width - margin : margin, 25, { align: isAr ? 'right' : 'left' });
    doc.text(fixArabic(`${isAr ? 'التاريخ' : 'Date'}: ${new Date(invoice.date).toLocaleString(isAr ? 'ar-SA' : 'en-US')}`), isAr ? width - margin : margin, 29, { align: isAr ? 'right' : 'left' });
    doc.text(fixArabic(`${isAr ? 'العميل' : 'Customer'}: ${invoice.customerName}`), isAr ? width - margin : margin, 33, { align: isAr ? 'right' : 'left' });
    
    // Items Table
    const tableData = invoice.items.map(item => [
      fixArabic(item.name),
      item.quantity,
      item.total.toFixed(2)
    ]);

    autoTable(doc, {
      startY: 38,
      margin: { left: margin, right: margin },
      tableWidth: width - (margin * 2),
      head: [[
        fixArabic(isAr ? 'المنتج' : 'Item'), 
        fixArabic(isAr ? 'الكمية' : 'Qty'), 
        fixArabic(isAr ? 'الإجمالي' : 'Total')
      ]],
      body: tableData,
      theme: 'plain',
      styles: { 
        font: 'Cairo', 
        fontSize: 7,
        cellPadding: 1,
        halign: isAr ? 'right' : 'left' 
      },
      headStyles: { 
        fontStyle: 'bold',
        lineWidth: 0.1,
        lineColor: 200
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 60;
    
    // Totals
    doc.setFontSize(8);
    doc.setFont('Cairo', 'bold');
    doc.text(fixArabic(`${isAr ? 'الإجمالي' : 'Total'}:`), isAr ? width - margin : margin, finalY + 10, { align: isAr ? 'right' : 'left' });
    doc.text(`${invoice.total.toFixed(2)} ${currencySymbol}`, isAr ? margin : width - margin, finalY + 10, { align: isAr ? 'left' : 'right' });
    
    // Footer
    doc.setFont('Cairo', 'normal');
    doc.setFontSize(6);
    doc.text(fixArabic(isAr ? 'شكراً لزيارتكم' : 'Thank you for visiting'), centerX, finalY + 20, { align: 'center' });
    
    doc.save(`Receipt-${invoice.number}.pdf`);
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(invoices.map(inv => ({
      Number: inv.number,
      Date: new Date(inv.date).toLocaleDateString(),
      Customer: inv.customerName,
      Total: inv.total,
      Status: inv.status
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices");
    XLSX.writeFile(workbook, "Invoices_Report.xlsx");
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchesCustomer = customerFilter === 'all' || inv.customerId === customerFilter;
    
    const invDate = new Date(inv.date);
    const matchesStartDate = !startDate || invDate >= new Date(startDate);
    const matchesEndDate = !endDate || invDate <= new Date(endDate + 'T23:59:59');

    return matchesSearch && matchesStatus && matchesCustomer && matchesStartDate && matchesEndDate;
  });

  const totalPages = Math.ceil(filteredInvoices.length / pageSize);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

    const categories = ['all', ...new Set(products.map(p => p.categoryId).filter(Boolean))];
    const filteredProducts = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(posSearchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(posSearchTerm.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(posSearchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    });

  return (
    <div className="space-y-10">
      {isScanning && (
        <BarcodeScanner 
          lang={lang}
          onScan={handleBarcodeScan}
          onClose={() => setIsScanning(false)}
        />
      )}
      {/* Printable Invoice (Hidden) */}
      <div id="printable-invoice" className="hidden print:block p-10 bg-white text-black font-sans">
        {viewingInvoice && (
          <div className="max-w-4xl mx-auto border p-10">
            <div className="flex justify-between items-start mb-10">
              <div>
                <h1 className="text-4xl font-black mb-2">{t.storeName}</h1>
                <p className="text-zinc-500">الرياض، المملكة العربية السعودية</p>
                <p className="text-zinc-500">هاتف: 966500000000+</p>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold text-emerald-600 mb-4">{lang === 'ar' ? 'فاتورة ضريبية' : 'Tax Invoice'}</h2>
                <p className="font-bold">{t.invoiceNumber}: {viewingInvoice.number}</p>
                <p>{t.date}: {new Date(viewingInvoice.date).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="mb-10 p-6 bg-zinc-50 rounded-2xl">
              <h3 className="font-bold mb-2">{t.customerName}:</h3>
              <p className="text-xl">{viewingInvoice.customerName}</p>
            </div>

            <table className="w-full mb-10">
              <thead>
                <tr className="border-b-2 border-zinc-200">
                  <th className="py-4 text-left">{t.productName}</th>
                  <th className="py-4 text-center">{t.quantity}</th>
                  <th className="py-4 text-right">{lang === 'ar' ? 'السعر' : 'Price'}</th>
                  <th className="py-4 text-right">{t.total}</th>
                </tr>
              </thead>
              <tbody>
                {viewingInvoice.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-zinc-100">
                    <td className="py-4">{item.name}</td>
                    <td className="py-4 text-center">{item.quantity}</td>
                    <td className="py-4 text-right">{currencySymbol} {item.price.toFixed(2)}</td>
                    <td className="py-4 text-right">{currencySymbol} {item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-80 space-y-3">
                <div className="flex justify-between">
                  <span className="text-zinc-500">{t.subtotal}</span>
                  <span className="font-bold">{currencySymbol} {viewingInvoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">{t.discount}</span>
                  <span className="font-bold text-red-500">- {currencySymbol} {viewingInvoice.discount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">{t.taxValue} ({viewingInvoice.taxRate}%)</span>
                  <span className="font-bold">{currencySymbol} {viewingInvoice.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-2xl font-black border-t pt-4">
                  <span>{t.finalTotal}</span>
                  <span className="text-emerald-600">{currencySymbol} {viewingInvoice.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="mt-20 text-center text-zinc-400 text-sm">
              شكراً لتعاملكم معنا!
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6 no-print">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-[450px] group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
              <input 
                type="text" 
                placeholder={lang === 'ar' ? 'بحث عن فاتورة أو عميل...' : 'Search invoices or customers...'}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-14 pr-6 py-4.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none shadow-sm font-medium"
              />
            </div>
            <Button 
              variant={showFilters ? "icon-primary" : "icon"}
              onClick={() => setShowFilters(!showFilters)}
              className="p-4.5"
            >
              <Filter className="w-6 h-6" />
              <span className="hidden md:inline font-bold">{t.filter}</span>
            </Button>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Button 
              variant="icon"
              onClick={exportToExcel}
              className="p-4.5"
            >
              <Download className="w-6 h-6" />
            </Button>
            {hasPermission('create_invoices') && (
              <Button 
                onClick={() => setIsModalOpen(true)}
                className="flex-1 md:flex-none px-10 py-4.5 rounded-[1.5rem]"
                leftIcon={<Plus className="w-6 h-6" />}
              >
                {lang === 'ar' ? 'فاتورة جديدة' : 'New Invoice'}
              </Button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] grid grid-cols-1 md:grid-cols-4 gap-6 shadow-sm">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t.status}</label>
                  <select 
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl text-sm outline-none focus:ring-2 ring-emerald-500/20 font-bold"
                  >
                    <option value="all">{t.all}</option>
                    <option value="paid">{t.paid}</option>
                    <option value="pending">{t.pending}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t.customerName}</label>
                  <select 
                    value={customerFilter}
                    onChange={(e) => {
                      setCustomerFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl text-sm outline-none focus:ring-2 ring-emerald-500/20 font-bold"
                  >
                    <option value="all">{t.all}</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t.startDate}</label>
                  <input 
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl text-sm outline-none focus:ring-2 ring-emerald-500/20 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t.endDate}</label>
                  <div className="flex gap-2">
                    <input 
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="flex-1 px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl text-sm outline-none focus:ring-2 ring-emerald-500/20 font-bold"
                    />
                    <Button 
                      variant="icon"
                      onClick={() => {
                        setStatusFilter('all');
                        setCustomerFilter('all');
                        setStartDate('');
                        setEndDate('');
                        setCurrentPage(1);
                      }}
                      className="p-3"
                      title={t.reset}
                    >
                      <RotateCcw className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden no-print">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left responsive-table">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t.invoiceNumber}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t.customerName}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t.date}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t.total}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {paginatedInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                  <td className="px-10 py-8" data-label={t.invoiceNumber}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-[1rem] bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-all duration-500">
                        <FileText className="w-6 h-6" />
                      </div>
                      <span className="font-black text-zinc-900 dark:text-white group-hover:text-emerald-600 transition-colors">{inv.number}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-sm font-black text-zinc-600 dark:text-zinc-400" data-label={t.customerName}>{inv.customerName}</td>
                  <td className="px-10 py-8 text-sm text-zinc-500 font-medium" data-label={t.date}>{new Date(inv.date).toLocaleDateString()}</td>
                  <td className="px-10 py-8 font-black text-emerald-600" data-label={t.total}>{currencySymbol} {inv.total.toLocaleString()}</td>
                  <td className="px-10 py-8" data-label={lang === 'ar' ? 'الحالة' : 'Status'}>
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      inv.status === 'paid' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20' : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <Button 
                        variant="icon"
                        onClick={() => setViewingInvoice(inv)}
                        className="p-2"
                        title={t.view}
                      >
                        <Eye className="w-5 h-5" />
                      </Button>
                      {hasPermission('edit_invoices') && (
                        <Button 
                          variant="icon-primary"
                          onClick={() => editInvoice(inv)}
                          className="p-3"
                          title={t.edit}
                        >
                          <Edit2 className="w-5 h-5" />
                        </Button>
                      )}
                      <Button 
                        variant="icon-primary"
                        onClick={() => setViewingInvoice(inv)}
                        className="p-3"
                        title={lang === 'ar' ? 'عرض الفاتورة' : 'View Invoice'}
                      >
                        <Eye className="w-5 h-5" />
                      </Button>
                      <Button 
                        variant="icon-primary"
                        onClick={() => exportToPDF(inv)}
                        className="p-3"
                        title={lang === 'ar' ? 'تصدير PDF' : 'Export PDF'}
                      >
                        <Download className="w-5 h-5" />
                      </Button>
                      <Button 
                        variant="icon-primary"
                        onClick={() => exportReceiptPDF(inv)}
                        className="p-3"
                        title={lang === 'ar' ? 'تصدير إيصال' : 'Export Receipt'}
                      >
                        <Banknote className="w-5 h-5" />
                      </Button>
                      <Button 
                        variant="icon-primary"
                        onClick={() => {
                          setViewingInvoice(inv);
                          setTimeout(() => window.print(), 500);
                        }}
                        className="p-3"
                      >
                        <Printer className="w-5 h-5" />
                      </Button>
                      {hasPermission('delete_invoices') && (
                        <Button 
                          variant="icon-danger"
                          onClick={() => inv.id && handleDelete(inv.id)}
                          className="p-3"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      )}
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

      {/* POS Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingInvoice ? (lang === 'ar' ? 'تعديل فاتورة' : 'Edit Invoice') : (lang === 'ar' ? 'فاتورة جديدة' : 'New Invoice')}
        size="xl"
        footer={
          <div className="flex gap-3 w-full max-w-md mx-auto">
            <Button
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-4 rounded-2xl"
            >
              {t.cancel}
            </Button>
            <Button 
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="flex-[2] py-4 rounded-2xl"
              leftIcon={<ShoppingCart className="w-6 h-6" />}
            >
              {t.checkout}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col md:flex-row gap-0 -m-6 md:-m-8 h-[calc(95vh-140px)] overflow-hidden">
          {/* LEFT SIDE: Product Selection */}
          <div className="w-full md:w-[60%] flex flex-col h-full overflow-hidden bg-zinc-50/50 dark:bg-zinc-900/50 border-r border-zinc-100 dark:border-zinc-800">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black tracking-tight">{lang === 'ar' ? 'اختيار المنتجات' : 'Select Products'}</h2>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="icon"
                    onClick={() => setIsScanning(true)}
                    className="p-3"
                    title={t.scanBarcode}
                  >
                    <ScanBarcode className="w-6 h-6" />
                  </Button>
                  <Button 
                    variant={isListening ? "icon-danger" : "icon"}
                    onClick={isListening ? stopListening : startListening}
                    className={`p-3 ${isListening ? 'animate-pulse' : ''}`}
                    title={lang === 'ar' ? 'بحث صوتي' : 'Voice Search'}
                  >
                    {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-primary transition-colors" />
                  <input 
                    type="text" 
                    placeholder={t.searchProduct}
                    value={posSearchTerm}
                    onChange={(e) => setPosSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                  />
                </div>
                <form onSubmit={handleBarcodeSubmit} className="relative w-full md:w-48 group">
                  <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-primary transition-colors" />
                  <input 
                    ref={barcodeRef}
                    type="text" 
                    placeholder={t.barcode}
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 ring-primary/20 transition-all font-medium"
                  />
                </form>
              </div>

              {/* Category Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {categories.map(cat => (
                  <Button
                    key={cat}
                    variant={selectedCategory === cat ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat || 'all')}
                    className="px-4 py-2 rounded-xl whitespace-nowrap"
                  >
                    {cat === 'all' ? t.all : cat}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-0 custom-scrollbar">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map(product => (
                  <motion.button
                    key={product.id}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => addToCart(product)}
                    className="flex flex-col text-right bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl p-4 hover:shadow-xl hover:border-primary/30 transition-all group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-all" />
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${
                        product.quantity <= (product.minStock || 5) 
                          ? 'bg-red-100 text-red-600' 
                          : 'bg-emerald-100 text-emerald-600'
                      }`}>
                        {product.quantity} {t.records}
                      </span>
                      <Package className="w-5 h-5 text-zinc-300 group-hover:text-primary transition-colors" />
                    </div>
                    <h4 className="font-bold text-zinc-900 dark:text-white mb-1 line-clamp-1">{product.name}</h4>
                    <p className="text-xs text-zinc-400 mb-3">{product.categoryId}</p>
                    <div className="mt-auto pt-3 border-t border-zinc-50 dark:border-zinc-700 flex items-center justify-between">
                      <span className="text-primary font-black">{currencySymbol} {product.sellingPrice.toLocaleString()}</span>
                      <div className="w-8 h-8 rounded-lg bg-zinc-50 dark:bg-zinc-700 flex items-center justify-center text-zinc-400 group-hover:bg-primary group-hover:text-white transition-all">
                        <PlusIcon className="w-4 h-4" />
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT SIDE: Cart & Checkout */}
          <div className="w-full md:w-[40%] flex flex-col h-full bg-white dark:bg-zinc-950">
            <div className="p-6 space-y-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t.date}</label>
                  <input 
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}</label>
                  <input 
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t.selectCustomer}</label>
                  <select 
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl text-sm font-bold outline-none focus:ring-2 ring-primary/20"
                  >
                    <option value="">{lang === 'ar' ? 'عميل نقدي' : 'Cash Customer'}</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar invoice-items-scroll">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-4 opacity-50">
                  <ShoppingCart className="w-16 h-16 stroke-[1]" />
                  <p className="font-bold">{t.noProductsSelected}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item, idx) => (
                    <div key={`${item.id}-${item.selectedPriceType}`} className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 group">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h5 className="font-bold text-zinc-900 dark:text-white">{item.name}</h5>
                          <div className="flex items-center gap-2 mt-1">
                            <select
                              value={item.selectedPriceType}
                              onChange={(e) => updateCartPriceType(item.id!, e.target.value as any)}
                              className="text-[10px] font-black bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-1 py-0.5 outline-none"
                            >
                              <option value="sellingPrice">{t.price1}</option>
                              <option value="wholesalePrice">{t.price2}</option>
                              <option value="vipPrice">{t.price3}</option>
                            </select>
                            <span className="text-xs text-zinc-400">{currencySymbol} {item.selectedPrice.toLocaleString()}</span>
                          </div>
                        </div>
                        <Button 
                          variant="icon-danger"
                          onClick={() => removeFromCart(item.id!)} 
                          className="p-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-1">
                          <Button 
                            variant="icon"
                            onClick={() => updateCartQuantity(item.id!, item.cartQuantity - 1)}
                            className="w-8 h-8"
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <input 
                            type="number" 
                            value={item.cartQuantity}
                            onChange={(e) => updateCartQuantity(item.id!, parseInt(e.target.value) || 0)}
                            className="w-12 text-center font-black text-sm bg-transparent outline-none"
                          />
                          <Button 
                            variant="icon"
                            onClick={() => updateCartQuantity(item.id!, item.cartQuantity + 1)}
                            className="w-8 h-8"
                          >
                            <PlusIcon className="w-4 h-4" />
                          </Button>
                        </div>
                        <span className="font-black text-primary">{currencySymbol} {(item.selectedPrice * item.cartQuantity).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 bg-zinc-50 dark:bg-zinc-900/80 border-t border-zinc-100 dark:border-zinc-800 space-y-4 sticky bottom-0 z-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t.discount}</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      className="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none"
                    />
                    <Button 
                      variant="secondary"
                      onClick={() => setDiscountType(discountType === 'percentage' ? 'fixed' : 'percentage')}
                      className="px-3 py-2 rounded-xl"
                    >
                      {discountType === 'percentage' ? '%' : currencySymbol}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'الضريبة (15%)' : 'Tax (15%)'}</label>
                  <Button 
                    variant={isVatEnabled ? "primary" : "secondary"}
                    onClick={() => setIsVatEnabled(!isVatEnabled)}
                    className="w-full px-3 py-2 rounded-xl text-xs"
                  >
                    {isVatEnabled ? (lang === 'ar' ? 'مفعل' : 'Enabled') : (lang === 'ar' ? 'معطل' : 'Disabled')}
                  </Button>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t.paymentMethod}</label>
                  <select 
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none"
                  >
                    <option value="cash">{t.cash}</option>
                    <option value="card">{t.card}</option>
                    <option value="bank_transfer">{t.bankTransfer}</option>
                    <option value="credit">{lang === 'ar' ? 'آجل' : 'Credit'}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'ملاحظات' : 'Notes'}</label>
                  <input 
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={lang === 'ar' ? 'أضف ملاحظة...' : 'Add a note...'}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">{t.subtotal}</span>
                  <span className="font-bold">{currencySymbol} {subtotal.toLocaleString()}</span>
                </div>
                {discountValue > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">{t.discount}</span>
                    <span className="font-bold text-red-500">- {currencySymbol} {discountValue.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">{t.taxValue} ({effectiveTaxRate}%)</span>
                  <span className="font-bold">{currencySymbol} {taxValue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xl font-black pt-2">
                  <span>{t.finalTotal}</span>
                  <span className="text-primary">{currencySymbol} {total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* View Invoice Modal */}
      <Modal
        isOpen={!!viewingInvoice && !isModalOpen}
        onClose={() => setViewingInvoice(null)}
        title={`${t.invoiceNumber}: ${viewingInvoice?.number}`}
        size="lg"
        footer={
          <div className="flex gap-3 w-full">
            <Button 
              variant="secondary"
              onClick={() => viewingInvoice && exportToPDF(viewingInvoice)}
              className="flex-1 py-4 rounded-xl"
              leftIcon={<Download className="w-5 h-5" />}
            >
              PDF
            </Button>
            <Button 
              onClick={() => window.print()}
              className="flex-1 py-4 rounded-xl"
              leftIcon={<Printer className="w-5 h-5" />}
            >
              {t.printInvoice}
            </Button>
          </div>
        }
      >
        {viewingInvoice && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-6 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-100 dark:border-zinc-700/50">
                <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">{t.customerName}</div>
                <div className="font-black text-lg">{viewingInvoice.customerName}</div>
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
