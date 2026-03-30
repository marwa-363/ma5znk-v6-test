import React, { useState, useEffect } from 'react';
import Button from '../components/Button';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  FileText,
  Filter,
  Users,
  Eye,
  X,
  ShieldAlert
} from 'lucide-react';
import { motion } from 'motion/react';
import { getCollection, subscribeToCollection } from '../services/accountingService';
import { Product, Invoice, Account, Customer } from '../types';
import { translations } from '../translations';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { fixArabic, initArabicPdf } from '../utils/pdfUtils';
import { getCurrencySymbol } from '../utils/currency';
import { useAuth } from '../hooks/useAuth';
import Modal from '../components/Modal';

interface Props {
  lang: 'ar' | 'en';
  profile: any;
}

export default function Reports({ lang, profile }: Props) {
  const { hasPermission, loading: authLoading } = useAuth();
  const t = translations[lang];
  const currencySymbol = getCurrencySymbol(profile?.currency, lang);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [viewingReport, setViewingReport] = useState<{ title: string; headers: string[]; data: any[][] } | null>(null);

  useEffect(() => {
    if (!profile?.companyId) return;

    const unsubInvoices = subscribeToCollection<Invoice>(profile.companyId, 'invoices', (data) => {
      setInvoices(data);
    });

    const unsubProducts = subscribeToCollection<Product>(profile.companyId, 'products', (data) => {
      setProducts(data);
    });

    const unsubAccounts = subscribeToCollection<Account>(profile.companyId, 'accounts', (data) => {
      setAccounts(data);
    });

    const unsubCustomers = subscribeToCollection<Customer>(profile.companyId, 'customers', (data) => {
      setCustomers(data);
    });

    const unsubSuppliers = subscribeToCollection<any>(profile.companyId, 'suppliers', (data) => {
      setSuppliers(data);
    });

    return () => {
      unsubInvoices();
      unsubProducts();
      unsubAccounts();
      unsubCustomers();
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

  if (!hasPermission('view_reports')) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-2xl">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-black">{lang === 'ar' ? 'غير مصرح' : 'Unauthorized'}</h2>
        <p className="text-zinc-500">{lang === 'ar' ? 'ليس لديك صلاحية للوصول إلى التقارير' : 'You do not have permission to access reports'}</p>
      </div>
    );
  }

  const filteredInvoices = invoices.filter(inv => {
    if (!dateRange.start || !dateRange.end) return true;
    return inv.date >= dateRange.start && inv.date <= dateRange.end;
  });

  const totalSales = filteredInvoices.filter(inv => inv.type === 'sales').reduce((sum, inv) => sum + inv.total, 0);
  const totalPurchases = filteredInvoices.filter(inv => inv.type === 'purchase').reduce((sum, inv) => sum + inv.total, 0);
  
  const totalProfit = filteredInvoices.filter(inv => inv.type === 'sales').reduce((sum, inv) => {
    const cost = inv.items.reduce((acc, item) => {
      const product = products.find(p => p.id === item.productId);
      return acc + (product ? product.purchasePrice * item.quantity : 0);
    }, 0);
    return sum + (inv.total - cost);
  }, 0);

  const assets = accounts.filter(a => a.type === 'Asset');
  const liabilities = accounts.filter(a => a.type === 'Liability');
  const equity = accounts.filter(a => a.type === 'Equity');
  const revenue = accounts.filter(a => a.type === 'Revenue');
  const expenses = accounts.filter(a => a.type === 'Expense');

  const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
  const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0);
  const totalRevenue = revenue.reduce((sum, a) => sum + a.balance, 0);
  const totalExpenses = expenses.reduce((sum, a) => sum + a.balance, 0);
  const netIncome = totalRevenue - totalExpenses;

  const exportBalanceSheetPDF = async () => {
    const doc = await initArabicPdf();
    const isAr = lang === 'ar';
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    
    // Header
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Logo Placeholder
    doc.setFillColor(245, 158, 11); // Amber-500
    doc.roundedRect(margin, 15, 20, 20, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(14);
    doc.text('M', margin + 10, 29, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(20);
    doc.text(fixArabic(t.brand), isAr ? pageWidth - margin : margin + 25, 28, { align: isAr ? 'right' : 'left' });
    
    doc.setFontSize(12);
    doc.text(fixArabic(t.balanceSheet), isAr ? pageWidth - margin : margin + 25, 38, { align: isAr ? 'right' : 'left' });
    
    const tableData = [
      ...assets.map(a => [fixArabic(a.name), fixArabic(t.assets), `${currencySymbol} ${a.balance.toLocaleString()}`]),
      ['', '', ''],
      ...liabilities.map(a => [fixArabic(a.name), fixArabic(t.liabilities), `${currencySymbol} ${a.balance.toLocaleString()}`]),
      ['', '', ''],
      ...equity.map(a => [fixArabic(a.name), fixArabic(t.equity), `${currencySymbol} ${a.balance.toLocaleString()}`]),
      ['', '', ''],
      [fixArabic(isAr ? 'إجمالي الأصول' : 'Total Assets'), '', `${currencySymbol} ${totalAssets.toLocaleString()}`],
      [fixArabic(isAr ? 'إجمالي الخصوم وحقوق الملكية' : 'Total Liabilities & Equity'), '', `${currencySymbol} ${(totalLiabilities + totalEquity).toLocaleString()}`],
    ];

    const headers = [isAr ? 'الحساب' : 'Account', isAr ? 'النوع' : 'Type', t.total];
    const processedHeaders = isAr ? headers.map(h => fixArabic(h)).reverse() : headers;
    const processedBody = isAr 
      ? tableData.map(row => row.map(cell => fixArabic(cell)).reverse())
      : tableData;

    autoTable(doc, {
      head: [processedHeaders],
      body: processedBody,
      startY: 60,
      styles: { font: 'Cairo', fontSize: 10, halign: isAr ? 'right' : 'left', cellPadding: 5 },
      headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontStyle: 'bold', halign: isAr ? 'right' : 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    doc.save(`balance-sheet-${new Date().toISOString()}.pdf`);
  };

  const exportProfitLossPDF = async () => {
    const doc = await initArabicPdf();
    const isAr = lang === 'ar';
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    
    // Header
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Logo Placeholder
    doc.setFillColor(225, 29, 72); // Rose-600
    doc.roundedRect(margin, 15, 20, 20, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(14);
    doc.text('M', margin + 10, 29, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(20);
    doc.text(fixArabic(t.brand), isAr ? pageWidth - margin : margin + 25, 28, { align: isAr ? 'right' : 'left' });
    
    doc.setFontSize(12);
    doc.text(fixArabic(t.profitLoss), isAr ? pageWidth - margin : margin + 25, 38, { align: isAr ? 'right' : 'left' });
    
    const tableData = [
      ...revenue.map(a => [fixArabic(a.name), fixArabic(t.revenue), `${currencySymbol} ${a.balance.toLocaleString()}`]),
      ['', '', ''],
      ...expenses.map(a => [fixArabic(a.name), fixArabic(t.expensesCat), `${currencySymbol} ${a.balance.toLocaleString()}`]),
      ['', '', ''],
      [fixArabic(isAr ? 'صافي الدخل' : 'Net Income'), '', `${currencySymbol} ${netIncome.toLocaleString()}`],
    ];

    const headers = [isAr ? 'الحساب' : 'Account', isAr ? 'النوع' : 'Type', t.total];
    const processedHeaders = isAr ? headers.map(h => fixArabic(h)).reverse() : headers;
    const processedBody = isAr 
      ? tableData.map(row => row.map(cell => fixArabic(cell)).reverse())
      : tableData;

    autoTable(doc, {
      head: [processedHeaders],
      body: processedBody,
      startY: 60,
      styles: { font: 'Cairo', fontSize: 10, halign: isAr ? 'right' : 'left', cellPadding: 5 },
      headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: 'bold', halign: isAr ? 'right' : 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    doc.save(`profit-loss-${new Date().toISOString()}.pdf`);
  };

  const exportSalesReportPDF = async () => {
    const doc = await initArabicPdf();
    const isAr = lang === 'ar';
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    
    // Header
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Logo Placeholder
    doc.setFillColor(16, 185, 129); // Emerald-600
    doc.roundedRect(margin, 15, 20, 20, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(14);
    doc.text('M', margin + 10, 29, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(20);
    doc.text(fixArabic(t.brand), isAr ? pageWidth - margin : margin + 25, 28, { align: isAr ? 'right' : 'left' });
    
    doc.setFontSize(12);
    doc.text(fixArabic(lang === 'ar' ? 'تقرير المبيعات' : 'Sales Report'), isAr ? pageWidth - margin : margin + 25, 38, { align: isAr ? 'right' : 'left' });
    
    const tableData = filteredInvoices.map(inv => [
      inv.number,
      inv.date,
      fixArabic(inv.customerName),
      `${currencySymbol} ${inv.total.toLocaleString()}`
    ]);

    const headers = [t.invoiceNumber, t.date, t.customerName, t.total];
    const processedHeaders = isAr ? headers.map(h => fixArabic(h)).reverse() : headers;
    const processedBody = isAr 
      ? tableData.map(row => row.map(cell => fixArabic(cell)).reverse())
      : tableData;

    autoTable(doc, {
      head: [processedHeaders],
      body: processedBody,
      startY: 60,
      styles: { font: 'Cairo', fontSize: 10, halign: isAr ? 'right' : 'left', cellPadding: 5 },
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold', halign: isAr ? 'right' : 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    doc.save(`sales-report-${new Date().toISOString()}.pdf`);
  };

  const exportInventoryReportPDF = async () => {
    const doc = await initArabicPdf();
    const isAr = lang === 'ar';
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    
    // Header
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Logo Placeholder
    doc.setFillColor(16, 185, 129); // Emerald-600
    doc.roundedRect(margin, 15, 20, 20, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(14);
    doc.text('M', margin + 10, 29, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(20);
    doc.text(fixArabic(t.brand), isAr ? pageWidth - margin : margin + 25, 28, { align: isAr ? 'right' : 'left' });
    
    doc.setFontSize(12);
    doc.text(fixArabic(lang === 'ar' ? 'تقرير المخزون' : 'Inventory Report'), isAr ? pageWidth - margin : margin + 25, 38, { align: isAr ? 'right' : 'left' });
    
    const tableData = products.map(p => [
      fixArabic(p.name),
      p.sku,
      p.quantity,
      `${currencySymbol} ${p.purchasePrice.toLocaleString()}`,
      `${currencySymbol} ${(p.purchasePrice * p.quantity).toLocaleString()}`
    ]);

    const headers = [t.productName, 'SKU', t.quantity, t.purchasePrice, t.inventoryValue];
    const processedHeaders = isAr ? headers.map(h => fixArabic(h)).reverse() : headers;
    const processedBody = isAr 
      ? tableData.map(row => row.map(cell => fixArabic(cell)).reverse())
      : tableData;

    autoTable(doc, {
      head: [processedHeaders],
      body: processedBody,
      startY: 60,
      styles: { font: 'Cairo', fontSize: 10, halign: isAr ? 'right' : 'left', cellPadding: 5 },
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold', halign: isAr ? 'right' : 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    doc.save(`inventory-report-${new Date().toISOString()}.pdf`);
  };

  const exportCustomerBalancesPDF = async () => {
    const doc = await initArabicPdf();
    const isAr = lang === 'ar';
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    
    // Header
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Logo Placeholder
    doc.setFillColor(244, 63, 94); // Rose-500
    doc.roundedRect(margin, 15, 20, 20, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(14);
    doc.text('M', margin + 10, 29, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(20);
    doc.text(fixArabic(t.brand), isAr ? pageWidth - margin : margin + 25, 28, { align: isAr ? 'right' : 'left' });
    
    doc.setFontSize(12);
    doc.text(fixArabic(lang === 'ar' ? 'تقرير أرصدة العملاء المستحقة' : 'Customer Outstanding Balances Report'), isAr ? pageWidth - margin : margin + 25, 38, { align: isAr ? 'right' : 'left' });
    
    const tableData = customers.filter(c => (c.balance ?? 0) > 0).map(c => [
      fixArabic(c.name),
      c.phone || '-',
      `${currencySymbol} ${(c.totalPurchases ?? 0).toLocaleString()}`,
      `${currencySymbol} ${(c.totalPaid ?? 0).toLocaleString()}`,
      `${currencySymbol} ${(c.balance ?? 0).toLocaleString()}`
    ]);

    const headers = [
      lang === 'ar' ? 'اسم العميل' : 'Customer Name',
      lang === 'ar' ? 'الهاتف' : 'Phone',
      lang === 'ar' ? 'إجمالي المشتريات' : 'Total Purchases',
      lang === 'ar' ? 'إجمالي المدفوع' : 'Total Paid',
      lang === 'ar' ? 'الرصيد المستحق' : 'Outstanding Balance'
    ];
    const processedHeaders = isAr ? headers.map(h => fixArabic(h)).reverse() : headers;
    const processedBody = isAr 
      ? tableData.map(row => row.map(cell => fixArabic(cell)).reverse())
      : tableData;

    autoTable(doc, {
      head: [processedHeaders],
      body: processedBody,
      startY: 60,
      styles: { font: 'Cairo', fontSize: 10, halign: isAr ? 'right' : 'left', cellPadding: 5 },
      headStyles: { fillColor: [244, 63, 94], textColor: [255, 255, 255], fontStyle: 'bold', halign: isAr ? 'right' : 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    doc.save(`customer-balances-${new Date().toISOString()}.pdf`);
  };

  const exportSupplierBalancesPDF = async () => {
    const doc = await initArabicPdf();
    const isAr = lang === 'ar';
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    
    // Header
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Logo Placeholder
    doc.setFillColor(79, 70, 229); // Indigo-600
    doc.roundedRect(margin, 15, 20, 20, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(14);
    doc.text('M', margin + 10, 29, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(20);
    doc.text(fixArabic(t.brand), isAr ? pageWidth - margin : margin + 25, 28, { align: isAr ? 'right' : 'left' });
    
    doc.setFontSize(12);
    doc.text(fixArabic(lang === 'ar' ? 'تقرير أرصدة الموردين المستحقة' : 'Supplier Outstanding Balances Report'), isAr ? pageWidth - margin : margin + 25, 38, { align: isAr ? 'right' : 'left' });
    
    const tableData = suppliers.filter(s => (s.balance ?? 0) > 0).map(s => [
      fixArabic(s.name),
      s.phone || '-',
      `${currencySymbol} ${(s.totalPurchases ?? 0).toLocaleString()}`,
      `${currencySymbol} ${(s.totalPaid ?? 0).toLocaleString()}`,
      `${currencySymbol} ${(s.balance ?? 0).toLocaleString()}`
    ]);

    const headers = [
      lang === 'ar' ? 'اسم المورد' : 'Supplier Name',
      lang === 'ar' ? 'الهاتف' : 'Phone',
      lang === 'ar' ? 'إجمالي المشتريات' : 'Total Purchases',
      lang === 'ar' ? 'إجمالي المدفوع' : 'Total Paid',
      lang === 'ar' ? 'الرصيد المستحق' : 'Outstanding Balance'
    ];
    const processedHeaders = isAr ? headers.map(h => fixArabic(h)).reverse() : headers;
    const processedBody = isAr 
      ? tableData.map(row => row.map(cell => fixArabic(cell)).reverse())
      : tableData;

    autoTable(doc, {
      head: [processedHeaders],
      body: processedBody,
      startY: 60,
      styles: { font: 'Cairo', fontSize: 10, halign: isAr ? 'right' : 'left', cellPadding: 5 },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', halign: isAr ? 'right' : 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    doc.save(`supplier-balances-${new Date().toISOString()}.pdf`);
  };

  const exportPurchasesReportPDF = async () => {
    const doc = await initArabicPdf();
    const isAr = lang === 'ar';
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    
    // Header
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Logo Placeholder
    doc.setFillColor(245, 158, 11); // Amber-500
    doc.roundedRect(margin, 15, 20, 20, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(14);
    doc.text('M', margin + 10, 29, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(20);
    doc.text(fixArabic(t.brand), isAr ? pageWidth - margin : margin + 25, 28, { align: isAr ? 'right' : 'left' });
    
    doc.setFontSize(12);
    doc.text(fixArabic(lang === 'ar' ? 'تقرير المشتريات' : 'Purchases Report'), isAr ? pageWidth - margin : margin + 25, 38, { align: isAr ? 'right' : 'left' });
    
    const tableData = filteredInvoices.filter(inv => inv.type === 'purchase').map(inv => [
      inv.number,
      inv.date,
      fixArabic(inv.supplierName || inv.customerName),
      `${currencySymbol} ${inv.total.toLocaleString()}`
    ]);

    const headers = [t.invoiceNumber, t.date, lang === 'ar' ? 'المورد' : 'Supplier', t.total];
    const processedHeaders = isAr ? headers.map(h => fixArabic(h)).reverse() : headers;
    const processedBody = isAr 
      ? tableData.map(row => row.map(cell => fixArabic(cell)).reverse())
      : tableData;

    autoTable(doc, {
      head: [processedHeaders],
      body: processedBody,
      startY: 60,
      styles: { font: 'Cairo', fontSize: 10, halign: isAr ? 'right' : 'left', cellPadding: 5 },
      headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontStyle: 'bold', halign: isAr ? 'right' : 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    doc.save(`purchases-report-${new Date().toISOString()}.pdf`);
  };

  const exportTopProductsPDF = async () => {
    const doc = await initArabicPdf();
    const isAr = lang === 'ar';
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    
    // Header
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Logo Placeholder
    doc.setFillColor(139, 92, 246); // Violet-500
    doc.roundedRect(margin, 15, 20, 20, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(14);
    doc.text('M', margin + 10, 29, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(20);
    doc.text(fixArabic(t.brand), isAr ? pageWidth - margin : margin + 25, 28, { align: isAr ? 'right' : 'left' });
    
    doc.setFontSize(12);
    doc.text(fixArabic(lang === 'ar' ? 'تقرير المنتجات الأكثر مبيعاً' : 'Top Selling Products Report'), isAr ? pageWidth - margin : margin + 25, 38, { align: isAr ? 'right' : 'left' });
    
    const productSales: { [key: string]: { name: string, quantity: number, total: number } } = {};
    filteredInvoices.filter(inv => inv.type === 'sales').forEach(inv => {
      inv.items.forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = { name: item.name, quantity: 0, total: 0 };
        }
        productSales[item.productId].quantity += item.quantity;
        productSales[item.productId].total += item.total;
      });
    });

    const sortedProducts = Object.values(productSales).sort((a, b) => b.quantity - a.quantity).slice(0, 20);

    const tableData = sortedProducts.map(p => [
      fixArabic(p.name),
      p.quantity.toString(),
      `${currencySymbol} ${p.total.toLocaleString()}`
    ]);

    const headers = [t.productName, t.quantity, t.total];
    const processedHeaders = isAr ? headers.map(h => fixArabic(h)).reverse() : headers;
    const processedBody = isAr 
      ? tableData.map(row => row.map(cell => fixArabic(cell)).reverse())
      : tableData;

    autoTable(doc, {
      head: [processedHeaders],
      body: processedBody,
      startY: 60,
      styles: { font: 'Cairo', fontSize: 10, halign: isAr ? 'right' : 'left', cellPadding: 5 },
      headStyles: { fillColor: [139, 92, 246], textColor: [255, 255, 255], fontStyle: 'bold', halign: isAr ? 'right' : 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    doc.save(`top-products-${new Date().toISOString()}.pdf`);
  };

  const exportToExcel = (title: string, headers: string[], data: any[][]) => {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${title}-${new Date().toISOString()}.xlsx`);
  };

  const viewReport = (title: string, headers: string[], data: any[][]) => {
    setViewingReport({ title, headers, data });
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{t.reportsSystem}</h2>
            <p className="text-sm text-zinc-500">Generate and export detailed business reports</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-zinc-400" />
          <input 
            type="date" 
            value={dateRange.start}
            onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-2 text-sm outline-none"
          />
          <span className="text-zinc-400">to</span>
          <input 
            type="date" 
            value={dateRange.end}
            onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-2 text-sm outline-none"
          />
        </div>
        <Button
          variant="secondary"
          size="md"
          leftIcon={<Filter className="w-4 h-4" />}
          className="px-6"
        >
          {lang === 'ar' ? 'تصفية' : 'Filter'}
        </Button>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Sales Report Card */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">{lang === 'ar' ? 'تقرير المبيعات' : 'Sales Report'}</h3>
          </div>
          <div className="space-y-4 mb-8">
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}</span>
              <span className="font-bold">{currencySymbol} {totalSales.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'عدد الفواتير' : 'Invoice Count'}</span>
              <span className="font-bold">{filteredInvoices.length}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="secondary"
              size="md"
              className="flex-1"
              leftIcon={<Eye className="w-4 h-4" />}
              onClick={() => {
                const title = lang === 'ar' ? 'تقرير المبيعات' : 'Sales Report';
                const headers = [t.invoiceNumber, t.date, t.customerName, t.total];
                const data = filteredInvoices.map(inv => [
                  inv.number,
                  inv.date,
                  inv.customerName,
                  `${currencySymbol} ${inv.total.toLocaleString()}`
                ]);
                viewReport(title, headers, data);
              }}
            >
              {lang === 'ar' ? 'عرض' : 'View'}
            </Button>
            <Button 
              variant="primary"
              size="md"
              className="flex-1"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={exportSalesReportPDF}
            >
              PDF
            </Button>
          </div>
        </div>

        {/* Inventory Report Card */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">{lang === 'ar' ? 'تقرير المخزون' : 'Inventory Report'}</h3>
          </div>
          <div className="space-y-4 mb-8">
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'إجمالي المنتجات' : 'Total Products'}</span>
              <span className="font-bold">{products.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'قيمة المخزون' : 'Inventory Value'}</span>
              <span className="font-bold">{currencySymbol} {products.reduce((sum, p) => sum + (p.purchasePrice * p.quantity), 0).toLocaleString()}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="secondary"
              size="md"
              className="flex-1"
              leftIcon={<Eye className="w-4 h-4" />}
              onClick={() => {
                const title = lang === 'ar' ? 'تقرير المخزون' : 'Inventory Report';
                const headers = [t.productName, 'SKU', t.quantity, t.purchasePrice, t.inventoryValue];
                const data = products.map(p => [
                  p.name,
                  p.sku,
                  p.quantity,
                  `${currencySymbol} ${p.purchasePrice.toLocaleString()}`,
                  `${currencySymbol} ${(p.purchasePrice * p.quantity).toLocaleString()}`
                ]);
                viewReport(title, headers, data);
              }}
            >
              {lang === 'ar' ? 'عرض' : 'View'}
            </Button>
            <Button 
              variant="primary"
              size="md"
              className="flex-1"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={exportInventoryReportPDF}
            >
              PDF
            </Button>
          </div>
        </div>

        {/* Profit Report Card */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
              <TrendingDown className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">{lang === 'ar' ? 'تقرير الأرباح' : 'Profit Report'}</h3>
          </div>
          <div className="space-y-4 mb-8">
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'إجمالي الربح' : 'Total Profit'}</span>
              <span className="font-bold text-emerald-600">{currencySymbol} {totalProfit.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'هامش الربح' : 'Profit Margin'}</span>
              <span className="font-bold">{totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="secondary"
              size="md"
              className="flex-1"
              leftIcon={<Eye className="w-4 h-4" />}
              onClick={() => {
                const title = lang === 'ar' ? 'تقرير الأرباح' : 'Profit Report';
                const headers = [t.invoiceNumber, t.date, lang === 'ar' ? 'التكلفة' : 'Cost', t.total, lang === 'ar' ? 'الربح' : 'Profit'];
                const data = filteredInvoices.filter(inv => inv.type === 'sales').map(inv => {
                  const cost = inv.items.reduce((acc, item) => {
                    const product = products.find(p => p.id === item.productId);
                    return acc + (product ? product.purchasePrice * item.quantity : 0);
                  }, 0);
                  return [
                    inv.number,
                    inv.date,
                    `${currencySymbol} ${cost.toLocaleString()}`,
                    `${currencySymbol} ${inv.total.toLocaleString()}`,
                    `${currencySymbol} ${(inv.total - cost).toLocaleString()}`
                  ];
                });
                viewReport(title, headers, data);
              }}
            >
              {lang === 'ar' ? 'عرض' : 'View'}
            </Button>
            <Button 
              variant="primary"
              size="md"
              className="flex-1"
              leftIcon={<Download className="w-4 h-4" />}
            >
              {lang === 'ar' ? 'تصدير' : 'Export'}
            </Button>
          </div>
        </div>

        {/* Balance Sheet Card */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">{t.balanceSheet}</h3>
          </div>
          <div className="space-y-4 mb-8">
            <div className="flex justify-between">
              <span className="text-zinc-500">{t.assets}</span>
              <span className="font-bold">{currencySymbol} {totalAssets.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t.liabilities}</span>
              <span className="font-bold">{currencySymbol} {totalLiabilities.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="secondary"
              size="md"
              className="flex-1"
              leftIcon={<Eye className="w-4 h-4" />}
              onClick={() => {
                const title = t.balanceSheet;
                const headers = [lang === 'ar' ? 'الحساب' : 'Account', lang === 'ar' ? 'النوع' : 'Type', t.total];
                const data = [
                  ...assets.map(a => [a.name, t.assets, `${currencySymbol} ${a.balance.toLocaleString()}`]),
                  ...liabilities.map(a => [a.name, t.liabilities, `${currencySymbol} ${a.balance.toLocaleString()}`]),
                  ...equity.map(a => [a.name, t.equity, `${currencySymbol} ${a.balance.toLocaleString()}`])
                ];
                viewReport(title, headers, data);
              }}
            >
              {lang === 'ar' ? 'عرض' : 'View'}
            </Button>
            <Button 
              variant="primary"
              size="md"
              className="flex-1"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={exportBalanceSheetPDF}
            >
              PDF
            </Button>
          </div>
        </div>

        {/* P&L Card */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">{t.profitLoss}</h3>
          </div>
          <div className="space-y-4 mb-8">
            <div className="flex justify-between">
              <span className="text-zinc-500">{t.revenue}</span>
              <span className="font-bold">{currencySymbol} {totalRevenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t.expensesCat}</span>
              <span className="font-bold">{currencySymbol} {totalExpenses.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="secondary"
              size="md"
              className="flex-1"
              leftIcon={<Eye className="w-4 h-4" />}
              onClick={() => {
                const title = t.profitLoss;
                const headers = [lang === 'ar' ? 'الحساب' : 'Account', lang === 'ar' ? 'النوع' : 'Type', t.total];
                const data = [
                  ...revenue.map(a => [a.name, t.revenue, `${currencySymbol} ${a.balance.toLocaleString()}`]),
                  ...expenses.map(a => [a.name, t.expensesCat, `${currencySymbol} ${a.balance.toLocaleString()}`])
                ];
                viewReport(title, headers, data);
              }}
            >
              {lang === 'ar' ? 'عرض' : 'View'}
            </Button>
            <Button 
              variant="primary"
              size="md"
              className="flex-1"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={exportProfitLossPDF}
            >
              PDF
            </Button>
          </div>
        </div>

        {/* Purchases Report Card */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
              <TrendingDown className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">{lang === 'ar' ? 'تقرير المشتريات' : 'Purchases Report'}</h3>
          </div>
          <div className="space-y-4 mb-8">
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'إجمالي المشتريات' : 'Total Purchases'}</span>
              <span className="font-bold">{currencySymbol} {totalPurchases.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'عدد الفواتير' : 'Invoice Count'}</span>
              <span className="font-bold">{filteredInvoices.filter(inv => inv.type === 'purchase').length}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="secondary"
              size="md"
              className="flex-1"
              leftIcon={<Eye className="w-4 h-4" />}
              onClick={() => {
                const title = lang === 'ar' ? 'تقرير المشتريات' : 'Purchases Report';
                const headers = [t.invoiceNumber, t.date, lang === 'ar' ? 'المورد' : 'Supplier', t.total];
                const data = filteredInvoices.filter(inv => inv.type === 'purchase').map(inv => [
                  inv.number,
                  inv.date,
                  inv.supplierName || inv.customerName,
                  `${currencySymbol} ${inv.total.toLocaleString()}`
                ]);
                viewReport(title, headers, data);
              }}
            >
              {lang === 'ar' ? 'عرض' : 'View'}
            </Button>
            <Button 
              variant="primary"
              size="md"
              className="flex-1"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={exportPurchasesReportPDF}
            >
              PDF
            </Button>
          </div>
        </div>

        {/* Top Products Report Card */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-violet-100 text-violet-600 rounded-2xl">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">{lang === 'ar' ? 'الأكثر مبيعاً' : 'Top Products'}</h3>
          </div>
          <div className="space-y-4 mb-8">
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'أفضل منتج' : 'Best Seller'}</span>
              <span className="font-bold">
                {(() => {
                  const productSales: { [key: string]: number } = {};
                  filteredInvoices.filter(inv => inv.type === 'sales').forEach(inv => {
                    inv.items.forEach(item => {
                      productSales[item.name] = (productSales[item.name] || 0) + item.quantity;
                    });
                  });
                  const top = Object.entries(productSales).sort((a, b) => b[1] - a[1])[0];
                  return top ? top[0] : '-';
                })()}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="secondary"
              size="md"
              className="flex-1"
              leftIcon={<Eye className="w-4 h-4" />}
              onClick={() => {
                const title = lang === 'ar' ? 'تقرير المنتجات الأكثر مبيعاً' : 'Top Selling Products';
                const headers = [t.productName, t.quantity, t.total];
                const productSales: { [key: string]: { name: string, quantity: number, total: number } } = {};
                filteredInvoices.filter(inv => inv.type === 'sales').forEach(inv => {
                  inv.items.forEach(item => {
                    if (!productSales[item.productId]) {
                      productSales[item.productId] = { name: item.name, quantity: 0, total: 0 };
                    }
                    productSales[item.productId].quantity += item.quantity;
                    productSales[item.productId].total += item.total;
                  });
                });
                const data = Object.values(productSales).sort((a, b) => b.quantity - a.quantity).map(p => [
                  p.name,
                  p.quantity,
                  `${currencySymbol} ${p.total.toLocaleString()}`
                ]);
                viewReport(title, headers, data);
              }}
            >
              {lang === 'ar' ? 'عرض' : 'View'}
            </Button>
            <Button 
              variant="primary"
              size="md"
              className="flex-1"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={exportTopProductsPDF}
            >
              PDF
            </Button>
          </div>
        </div>

        {/* Supplier Balances Card */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">{lang === 'ar' ? 'أرصدة الموردين' : 'Supplier Balances'}</h3>
          </div>
          <div className="space-y-4 mb-8">
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'إجمالي المستحق' : 'Total Outstanding'}</span>
              <span className="font-bold text-red-600">{currencySymbol} {suppliers.reduce((sum, s) => sum + (s.balance || 0), 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'موردون دائنون' : 'Creditor Suppliers'}</span>
              <span className="font-bold">{suppliers.filter(s => s.balance > 0).length}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="secondary"
              size="md"
              className="flex-1"
              leftIcon={<Eye className="w-4 h-4" />}
              onClick={() => {
                const title = lang === 'ar' ? 'أرصدة الموردين المستحقة' : 'Supplier Outstanding Balances';
                const headers = [
                  lang === 'ar' ? 'اسم المورد' : 'Supplier Name',
                  lang === 'ar' ? 'الهاتف' : 'Phone',
                  lang === 'ar' ? 'إجمالي المشتريات' : 'Total Purchases',
                  lang === 'ar' ? 'إجمالي المدفوع' : 'Total Paid',
                  lang === 'ar' ? 'الرصيد المستحق' : 'Outstanding Balance'
                ];
                const data = suppliers.filter(s => (s.balance ?? 0) > 0).map(s => [
                  s.name,
                  s.phone || '-',
                  `${currencySymbol} ${(s.totalPurchases ?? 0).toLocaleString()}`,
                  `${currencySymbol} ${(s.totalPaid ?? 0).toLocaleString()}`,
                  `${currencySymbol} ${(s.balance ?? 0).toLocaleString()}`
                ]);
                viewReport(title, headers, data);
              }}
            >
              {lang === 'ar' ? 'عرض' : 'View'}
            </Button>
            <Button 
              variant="primary"
              size="md"
              className="flex-1"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={exportSupplierBalancesPDF}
            >
              PDF
            </Button>
          </div>
        </div>

        {/* Customer Balances Card */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">{lang === 'ar' ? 'أرصدة العملاء' : 'Customer Balances'}</h3>
          </div>
          <div className="space-y-4 mb-8">
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'إجمالي المستحق' : 'Total Outstanding'}</span>
              <span className="font-bold text-red-600">{currencySymbol} {customers.reduce((sum, c) => sum + (c.balance || 0), 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'عملاء مدينون' : 'Debtor Customers'}</span>
              <span className="font-bold">{customers.filter(c => c.balance > 0).length}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="secondary"
              onClick={() => {
                const title = lang === 'ar' ? 'أرصدة العملاء المستحقة' : 'Customer Outstanding Balances';
                const headers = [
                  lang === 'ar' ? 'اسم العميل' : 'Customer Name',
                  lang === 'ar' ? 'الهاتف' : 'Phone',
                  lang === 'ar' ? 'إجمالي المشتريات' : 'Total Purchases',
                  lang === 'ar' ? 'إجمالي المدفوع' : 'Total Paid',
                  lang === 'ar' ? 'الرصيد المستحق' : 'Outstanding Balance'
                ];
                const data = customers.filter(c => (c.balance ?? 0) > 0).map(c => [
                  c.name,
                  c.phone || '-',
                  `${currencySymbol} ${(c.totalPurchases ?? 0).toLocaleString()}`,
                  `${currencySymbol} ${(c.totalPaid ?? 0).toLocaleString()}`,
                  `${currencySymbol} ${(c.balance ?? 0).toLocaleString()}`
                ]);
                viewReport(title, headers, data);
              }}
              leftIcon={<Eye className="w-4 h-4" />}
              className="flex-1"
            >
              {lang === 'ar' ? 'عرض' : 'View'}
            </Button>
            <Button 
              onClick={exportCustomerBalancesPDF}
              leftIcon={<Download className="w-4 h-4" />}
              className="flex-1 bg-rose-600 hover:bg-rose-700"
            >
              PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Report Viewer Modal */}
      <Modal
        isOpen={!!viewingReport}
        onClose={() => setViewingReport(null)}
        title={viewingReport?.title || ''}
        size="xl"
        footer={
          <div className="flex items-center gap-4 w-full">
            <Button 
              onClick={() => viewingReport && exportToExcel(viewingReport.title, viewingReport.headers, viewingReport.data)}
              leftIcon={<Download className="w-4 h-4" />}
              className="flex-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
            >
              Excel
            </Button>
            <Button 
              variant="secondary"
              onClick={() => setViewingReport(null)}
              className="flex-1"
            >
              {lang === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
          </div>
        }
      >
        {viewingReport && (
          <div className="flex flex-col h-full">
            <div className="mb-6">
              <p className="text-sm text-zinc-500">
                {lang === 'ar' ? 'تاريخ التقرير:' : 'Report Date:'} {new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
              </p>
            </div>
            
            <div className="flex-1 overflow-auto -mx-8 px-8">
              <table className="w-full text-sm text-left rtl:text-right border-collapse">
                <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800 z-10">
                  <tr>
                    {viewingReport.headers.map((header, i) => (
                      <th key={i} className="px-6 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px] border-b border-zinc-100 dark:border-zinc-700">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {viewingReport.data.map((row, i) => (
                    <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      {row.map((cell, j) => (
                        <td key={j} className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
