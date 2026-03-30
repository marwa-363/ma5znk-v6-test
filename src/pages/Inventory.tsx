import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Mic, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Package,
  ScanBarcode,
  X,
  AlertTriangle,
  Download,
  Upload,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Product } from '../types';
import { translations } from '../translations';
import { parseVoiceCommand } from '../services/gemini';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { getCurrencySymbol } from '../utils/currency';
import { 
  addToCollection, 
  updateInCollection, 
  deleteProduct,
  subscribeToCollection 
} from '../services/accountingService';
import { useAuth } from '../hooks/useAuth';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import Button from '../components/Button';
import { Filter, RotateCcw } from 'lucide-react';

interface Props {
  lang: 'ar' | 'en';
  profile: any;
}

export default function Inventory({ lang, profile }: Props) {
  const { hasPermission } = useAuth();
  const t = translations[lang];
  const currencySymbol = getCurrencySymbol(profile?.currency, lang);
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update'>('skip');
  const [importStats, setImportStats] = useState({ success: 0, failed: 0, errors: [] as string[] });
  const [isImporting, setIsImporting] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    purchasePrice: 0,
    sellingPrice: 0,
    wholesalePrice: 0,
    vipPrice: 0,
    quantity: 0,
    minStock: 5,
    category: '',
    description: '',
    expiryDate: ''
  });

  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    if (!profile?.companyId) return;

    const unsubProducts = subscribeToCollection<Product>(profile.companyId, 'products', (data) => {
      setProducts(data);
    });

    const unsubCategories = subscribeToCollection<{id: string, name: string}>(profile.companyId, 'categories', (data) => {
      setCategories(data);
    });

    return () => {
      unsubProducts();
      unsubCategories();
    };
  }, [profile?.companyId]);

  const handleVoiceEntry = async () => {
    if (!('webkitSpeechRecognition' in window)) {
      toast.error(lang === 'ar' ? 'متصفحك لا يدعم التعرف على الكلام' : "Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = async (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        const parsed = await parseVoiceCommand(transcript);
        if (parsed && parsed.name) {
        if (!profile?.companyId) return;
        await addToCollection<Product>(profile.companyId, 'products', {
          name: parsed.name,
          purchasePrice: parsed.price || 0,
          sellingPrice: (parsed.price || 0) * 1.2,
          quantity: parsed.quantity || 0,
          sku: `VOICE-${Date.now()}`,
          minStock: 5,
          companyId: profile.companyId
        } as any);
        toast.success(lang === 'ar' ? 'تم إضافة المنتج صوتياً' : 'Product added via voice');
        }
      }
    };

    recognition.start();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const productData = {
        name: formData.name,
        sku: formData.sku,
        barcode: formData.barcode,
        purchasePrice: formData.purchasePrice,
        sellingPrice: formData.sellingPrice,
        wholesalePrice: formData.wholesalePrice,
        vipPrice: formData.vipPrice,
        quantity: formData.quantity,
        minStock: formData.minStock,
        categoryId: formData.category,
        description: formData.description,
        expiryDate: formData.expiryDate,
        companyId: profile.companyId
      };

      if (editingProduct?.id) {
        await updateInCollection<Product>(profile.companyId, 'products', editingProduct.id, productData as any);
        toast.success(lang === 'ar' ? 'تم تحديث المنتج بنجاح' : 'Product updated successfully');
      } else {
        await addToCollection<Product>(profile.companyId, 'products', productData as any);
        toast.success(lang === 'ar' ? 'تم إضافة المنتج بنجاح' : 'Product added successfully');
      }
      closeModal();
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error(lang === 'ar' ? 'حدث خطأ أثناء الحفظ' : 'Error saving product');
    }
  };

  const handleDelete = async (id: string) => {
    if (!profile?.companyId) return;
    setProductToDelete(id);
    setIsConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete || !profile?.companyId) return;
    try {
      await deleteProduct(profile.companyId, productToDelete, profile.id || profile.uid);
      toast.success(lang === 'ar' ? 'تم حذف المنتج' : 'Product deleted');
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error(lang === 'ar' ? 'حدث خطأ أثناء الحذف' : 'Error deleting product');
    } finally {
      setProductToDelete(null);
      setIsConfirmDeleteOpen(false);
    }
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode || '',
        purchasePrice: product.purchasePrice,
        sellingPrice: product.sellingPrice,
        wholesalePrice: product.wholesalePrice || 0,
        vipPrice: product.vipPrice || 0,
        quantity: product.quantity,
        minStock: product.minStock,
        category: product.categoryId || '',
        description: product.description || '',
        expiryDate: product.expiryDate || ''
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        sku: `SKU-${Date.now()}`,
        barcode: '',
        purchasePrice: 0,
        sellingPrice: 0,
        wholesalePrice: 0,
        vipPrice: 0,
        quantity: 0,
        minStock: 5,
        category: '',
        description: '',
        expiryDate: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || p.categoryId === categoryFilter;
    const matchesLowStock = !lowStockOnly || p.quantity <= p.minStock;

    // Expiry Filters
    const today = new Date();
    const expiryDate = p.expiryDate ? new Date(p.expiryDate) : null;
    const isExpired = expiryDate && expiryDate < today;
    const isNearExpiry = expiryDate && !isExpired && (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) <= 30;

    if (categoryFilter === 'expired' && !isExpired) return false;
    if (categoryFilter === 'near_expiry' && !isNearExpiry) return false;

    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !profile?.companyId) return;
    try {
      await addToCollection<{id?: string, name: string}>(profile.companyId, 'categories', { name: newCategoryName });
      setNewCategoryName('');
      setIsCategoryModalOpen(false);
      toast.success(lang === 'ar' ? 'تم إضافة القسم' : 'Category added');
    } catch (error) {
      console.error("Error adding category:", error);
      toast.error(lang === 'ar' ? 'حدث خطأ أثناء إضافة القسم' : 'Error adding category');
    }
  };

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const uniqueCategoryIds = Array.from(new Set(products.map(p => p.categoryId))).filter(Boolean);

  const handleExportExcel = () => {
    try {
      const exportData = products.map(p => ({
        [lang === 'ar' ? 'اسم المنتج' : 'Product Name']: p.name,
        'SKU': p.sku,
        [lang === 'ar' ? 'الباركود' : 'Barcode']: p.barcode || '',
        [lang === 'ar' ? 'الفئة' : 'Category']: p.categoryId || '',
        [lang === 'ar' ? 'سعر الشراء' : 'Cost Price']: p.purchasePrice,
        [lang === 'ar' ? 'سعر البيع' : 'Selling Price']: p.sellingPrice,
        [lang === 'ar' ? 'الكمية' : 'Stock']: p.quantity,
        [lang === 'ar' ? 'تاريخ الإضافة' : 'Created Date']: (p as any).createdAt ? new Date((p as any).createdAt).toLocaleDateString() : '-'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Products");
      XLSX.writeFile(wb, `makhzanak-products-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(lang === 'ar' ? 'تم تصدير البيانات بنجاح' : 'Data exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(lang === 'ar' ? 'فشل تصدير البيانات' : 'Failed to export data');
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Product Name': 'Example Product',
        'SKU': 'SKU-001',
        'Barcode': '123456789',
        'Category': 'Electronics',
        'Cost Price': 100,
        'Selling Price': 150,
        'Stock Quantity': 50,
        'Description': 'Optional description here'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "makhzanak-import-template.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames?.[0];
        if (!wsname) {
          toast.error(lang === 'ar' ? 'ملف غير صالح' : 'Invalid file');
          return;
        }
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          toast.error(lang === 'ar' ? 'الملف فارغ' : 'File is empty');
          return;
        }

        setImportData(data);
        setIsImportModalOpen(true);
        setImportStats({ success: 0, failed: 0, errors: [] });
      } catch (error) {
        console.error('Import error:', error);
        toast.error(lang === 'ar' ? 'فشل قراءة الملف' : 'Failed to read file');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const confirmImport = async () => {
    setIsImporting(true);
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      if (!profile?.companyId) throw new Error('Company ID not found');

      for (const row of importData) {
        const name = row['Product Name'] || row['اسم المنتج'];
        const sku = row['SKU'] || row['رمز المنتج'];
        const sellingPrice = Number(row['Selling Price'] || row['سعر البيع']);

        if (!name || isNaN(sellingPrice)) {
          failed++;
          errors.push(`${lang === 'ar' ? 'صف' : 'Row'} ${importData.indexOf(row) + 1}: ${lang === 'ar' ? 'الاسم أو السعر مفقود' : 'Name or Price missing'}`);
          continue;
        }

        const productData: Partial<Product> = {
          name,
          sku: sku || `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          barcode: row['Barcode'] || row['الباركود'] || '',
          categoryId: row['Category'] || row['الفئة'] || 'General',
          purchasePrice: Number(row['Cost Price'] || row['سعر الشراء'] || 0),
          sellingPrice: sellingPrice,
          wholesalePrice: Number(row['Wholesale Price'] || row['سعر الجملة'] || 0),
          vipPrice: Number(row['VIP Price'] || row['سعر VIP'] || 0),
          quantity: Number(row['Stock Quantity'] || row['الكمية'] || 0),
          description: row['Description'] || row['الوصف'] || '',
          minStock: 5,
          companyId: profile.companyId,
          updatedAt: new Date().toISOString()
        };

        const existingProduct = products.find(p => p.sku === sku);

        if (existingProduct) {
          if (duplicateStrategy === 'skip') {
            failed++;
            errors.push(`${lang === 'ar' ? 'تخطي' : 'Skip'} SKU: ${sku}`);
            continue;
          } else {
            await updateInCollection(profile.companyId, 'products', existingProduct.id, { ...productData });
            success++;
          }
        } else {
          await addToCollection(profile.companyId, 'products', {
            ...productData,
            createdAt: new Date().toISOString()
          } as Product);
          success++;
        }
      }

      setImportStats({ success, failed, errors });
      toast.success(lang === 'ar' ? `تم استيراد ${success} منتج` : `Imported ${success} products`);
      if (failed > 0) {
        toast.error(lang === 'ar' ? `فشل استيراد ${failed} منتج` : `Failed to import ${failed} products`);
      }
      setImportData([]);
    } catch (error) {
      console.error('Import processing error:', error);
      toast.error(lang === 'ar' ? 'حدث خطأ أثناء الاستيراد' : 'Error during import');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-[450px] group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
              <input 
                type="text" 
                placeholder={t.searchProduct}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-14 pr-6 py-4.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none shadow-sm font-medium"
              />
            </div>
            <Button 
              variant="secondary"
              size="lg"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800' : ''}
              leftIcon={<Filter className="w-6 h-6" />}
            >
              <span className="hidden md:inline font-bold">{t.filter}</span>
            </Button>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <Button 
              variant={isListening ? 'danger' : 'secondary'}
              size="lg"
              onClick={handleVoiceEntry}
              className={isListening ? 'animate-pulse' : ''}
              leftIcon={<Mic className="w-6 h-6" />}
            />
            <Button 
              variant="secondary"
              size="lg"
              leftIcon={<ScanBarcode className="w-6 h-6" />}
            />
            {hasPermission('add_products') && (
              <Button 
                variant="primary"
                size="xl"
                onClick={() => openModal()}
                leftIcon={<Plus className="w-6 h-6" />}
              >
                {lang === 'ar' ? 'إضافة منتج' : 'Add Product'}
              </Button>
            )}
          </div>
        </div>

        {/* Excel Actions */}
        <div className="flex flex-wrap items-center gap-4">
          <Button 
            variant="secondary"
            onClick={handleExportExcel}
            leftIcon={<Download className="w-4 h-4 text-emerald-500" />}
          >
            {lang === 'ar' ? 'تصدير إكسل' : 'Export Excel'}
          </Button>
          <label className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold hover:bg-zinc-50 transition-all cursor-pointer">
            <Upload className="w-4 h-4 text-emerald-500" />
            {lang === 'ar' ? 'استيراد إكسل' : 'Import Excel'}
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
          </label>
          <Button 
            variant="secondary"
            onClick={handleDownloadTemplate}
            leftIcon={<FileSpreadsheet className="w-4 h-4 text-amber-500" />}
          >
            {lang === 'ar' ? 'تحميل القالب' : 'Download Template'}
          </Button>
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
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t.category}</label>
                  <select 
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl text-sm outline-none focus:ring-2 ring-emerald-500/20 font-bold"
                  >
                    <option value="all">{t.all}</option>
                    <option value="near_expiry">{lang === 'ar' ? 'قاربت على الانتهاء' : 'Near Expiry'}</option>
                    <option value="expired">{lang === 'ar' ? 'منتهية الصلاحية' : 'Expired'}</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    variant={lowStockOnly ? 'danger' : 'secondary'}
                    onClick={() => {
                      setLowStockOnly(!lowStockOnly);
                      setCurrentPage(1);
                    }}
                    className="flex-1"
                  >
                    {t.lowStockOnly}
                  </Button>
                  <Button 
                    variant="secondary"
                    onClick={() => {
                      setCategoryFilter('all');
                      setLowStockOnly(false);
                      setCurrentPage(1);
                    }}
                    leftIcon={<RotateCcw className="w-5 h-5" />}
                    title={t.reset}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Inventory Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left responsive-table">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{lang === 'ar' ? 'المنتج' : 'Product'}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{lang === 'ar' ? 'الباركود' : 'SKU/Barcode'}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{lang === 'ar' ? 'السعر' : 'Price'}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{lang === 'ar' ? 'الكمية' : 'Stock'}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {paginatedProducts.map((product) => (
                <tr key={product.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                  <td className="px-10 py-8" data-label={lang === 'ar' ? 'المنتج' : 'Product'}>
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-[1.25rem] bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-all duration-500">
                        <Package className="w-7 h-7" />
                      </div>
                      <div>
                        <div className="font-black text-zinc-900 dark:text-white group-hover:text-emerald-600 transition-colors">{product.name}</div>
                        <div className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">{product.categoryId || 'General'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8" data-label={lang === 'ar' ? 'الباركود' : 'SKU/Barcode'}>
                    <div className="text-sm font-black text-zinc-900 dark:text-white tracking-tight">{product.sku}</div>
                    <div className="text-xs text-zinc-500 font-medium mt-1">{product.barcode || 'No Barcode'}</div>
                  </td>
                  <td className="px-10 py-8" data-label={lang === 'ar' ? 'السعر' : 'Price'}>
                    <div className="text-sm font-black text-emerald-600">{currencySymbol} {product.sellingPrice.toLocaleString()}</div>
                    <div className="text-xs text-zinc-400 font-bold mt-1">{lang === 'ar' ? 'التكلفة' : 'Cost'}: {currencySymbol} {product.purchasePrice.toLocaleString()}</div>
                  </td>
                  <td className="px-10 py-8" data-label={lang === 'ar' ? 'الكمية' : 'Stock'}>
                    <div className="flex items-center gap-3">
                      <div className={`text-sm font-black ${product.quantity <= product.minStock ? 'text-red-500' : 'text-zinc-900 dark:text-white'}`}>
                        {product.quantity}
                      </div>
                      {product.quantity <= product.minStock && (
                        <div className="px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-600 text-[10px] font-black rounded-lg uppercase tracking-widest">Low</div>
                      )}
                    </div>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      {hasPermission('edit_products') && (
                        <Button 
                          variant="icon-primary"
                          onClick={() => openModal(product)}
                          leftIcon={<Edit className="w-5 h-5" />}
                        />
                      )}
                      {hasPermission('delete_products') && (
                        <Button 
                          variant="icon-danger"
                          onClick={() => product.id && handleDelete(product.id)}
                          leftIcon={<Trash2 className="w-5 h-5" />}
                        />
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
          totalRecords={filteredProducts.length}
          pageSize={pageSize}
          lang={lang}
        />
      </div>

      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={confirmDelete}
        title={lang === 'ar' ? 'حذف منتج' : 'Delete Product'}
        message={lang === 'ar' ? 'هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this product? This action cannot be undone.'}
        lang={lang}
      />

      {/* Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => !isImporting && setIsImportModalOpen(false)}
        title={lang === 'ar' ? 'استيراد المنتجات' : 'Import Products'}
        size="lg"
        footer={
          importData.length > 0 ? (
            <div className="flex gap-4 w-full">
              <Button 
                variant="secondary"
                onClick={() => setIsImportModalOpen(false)}
                disabled={isImporting}
                className="flex-1"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button 
                onClick={confirmImport}
                loading={isImporting}
                className="flex-1"
              >
                {lang === 'ar' ? 'تأكيد الاستيراد' : 'Confirm Import'}
              </Button>
            </div>
          ) : importStats.success || importStats.failed ? (
            <Button 
              variant="black"
              onClick={() => setIsImportModalOpen(false)}
              className="w-full"
            >
              {lang === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
          ) : null
        }
      >
        <div className="flex flex-col">
          {importData.length > 0 ? (
            <>
              <div className="mb-6 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-3xl">
                <div className="flex items-center gap-6">
                  <div className="text-sm font-bold text-zinc-500">
                    {lang === 'ar' ? 'استراتيجية التكرار:' : 'Duplicate Strategy:'}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant={duplicateStrategy === 'skip' ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setDuplicateStrategy('skip')}
                    >
                      {lang === 'ar' ? 'تخطي المكرر' : 'Skip Duplicates'}
                    </Button>
                    <Button 
                      variant={duplicateStrategy === 'update' ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setDuplicateStrategy('update')}
                    >
                      {lang === 'ar' ? 'تحديث المكرر' : 'Update Duplicates'}
                    </Button>
                  </div>
                </div>
                <div className="text-sm font-black text-emerald-600">
                  {importData.length} {lang === 'ar' ? 'منتج جاهز للاستيراد' : 'Products ready to import'}
                </div>
              </div>

              <div className="flex-1 overflow-auto rounded-2xl border border-zinc-100 dark:border-zinc-800 mb-8">
                <table className="w-full text-sm text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-800 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 font-black text-zinc-400 uppercase text-[10px]">{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                      <th className="px-4 py-3 font-black text-zinc-400 uppercase text-[10px]">SKU</th>
                      <th className="px-4 py-3 font-black text-zinc-400 uppercase text-[10px]">{lang === 'ar' ? 'السعر' : 'Price'}</th>
                      <th className="px-4 py-3 font-black text-zinc-400 uppercase text-[10px]">{lang === 'ar' ? 'الكمية' : 'Stock'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                    {importData.slice(0, 50).map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 font-bold">{row['Product Name'] || row['اسم المنتج'] || '-'}</td>
                        <td className="px-4 py-3 text-zinc-500">{row['SKU'] || row['رمز المنتج'] || '-'}</td>
                        <td className="px-4 py-3 font-black text-emerald-600">{row['Selling Price'] || row['سعر البيع'] || 0}</td>
                        <td className="px-4 py-3">{row['Stock Quantity'] || row['الكمية'] || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importData.length > 50 && (
                  <div className="p-4 text-center text-xs text-zinc-400 font-bold">
                    {lang === 'ar' ? `و ${importData.length - 50} منتج آخر...` : `And ${importData.length - 50} more products...`}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-8">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-8 rounded-3xl text-center">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-800 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                  <Package className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-black text-emerald-900 dark:text-emerald-100 mb-2">
                  {lang === 'ar' ? 'اكتمل الاستيراد' : 'Import Completed'}
                </h4>
                <div className="flex justify-center gap-8 mt-6">
                  <div className="text-center">
                    <div className="text-2xl font-black text-emerald-600">{importStats.success}</div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase">{lang === 'ar' ? 'ناجح' : 'Success'}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-black text-red-500">{importStats.failed}</div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase">{lang === 'ar' ? 'فشل' : 'Failed'}</div>
                  </div>
                </div>
              </div>

              {importStats.errors.length > 0 && (
                <div className="max-h-[200px] overflow-auto p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20">
                  <div className="text-xs font-black text-red-600 uppercase mb-2">{lang === 'ar' ? 'الأخطاء:' : 'Errors:'}</div>
                  <ul className="space-y-1">
                    {importStats.errors.map((err, i) => (
                      <li key={i} className="text-xs text-red-500 font-medium">• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingProduct ? (lang === 'ar' ? 'تعديل منتج' : 'Edit Product') : (lang === 'ar' ? 'إضافة منتج جديد' : 'Add New Product')}
        size="lg"
        footer={
          <div className="flex gap-4 w-full">
            <Button 
              variant="secondary"
              onClick={closeModal}
              className="flex-1"
            >
              {t.cancel}
            </Button>
            <Button 
              form="product-form" 
              type="submit" 
              className="flex-1"
            >
              {editingProduct ? t.update : t.save}
            </Button>
          </div>
        }
      >
        <form id="product-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{t.productName}</label>
              <input 
                type="text" 
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="m-input"
                placeholder={lang === 'ar' ? 'اسم المنتج' : 'Product Name'}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'الباركود' : 'Barcode'}</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="m-input pr-12"
                  placeholder={lang === 'ar' ? 'امسح أو أدخل الباركود' : 'Scan or enter barcode'}
                />
                <ScanBarcode className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'القسم' : 'Category'}</label>
              <div className="flex gap-2">
                <select 
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="m-input"
                >
                  <option value="">{lang === 'ar' ? 'اختر القسم' : 'Select Category'}</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <Button 
                  variant="secondary"
                  onClick={() => setIsCategoryModalOpen(true)}
                  leftIcon={<Plus className="w-5 h-5" />}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'تاريخ الصلاحية' : 'Expiry Date'}</label>
              <input 
                type="date" 
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                className="m-input"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{t.purchasePrice}</label>
              <input 
                type="number" 
                required
                value={formData.purchasePrice}
                onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
                className="m-input"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{t.sellingPrice}</label>
              <input 
                type="number" 
                required
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                className="m-input"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'سعر الجملة' : 'Wholesale Price'}</label>
              <input 
                type="number" 
                value={formData.wholesalePrice}
                onChange={(e) => setFormData({ ...formData, wholesalePrice: Number(e.target.value) })}
                className="m-input"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'سعر VIP' : 'VIP Price'}</label>
              <input 
                type="number" 
                value={formData.vipPrice}
                onChange={(e) => setFormData({ ...formData, vipPrice: Number(e.target.value) })}
                className="m-input"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{t.quantity}</label>
              <input 
                type="number" 
                required
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                className="m-input"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{t.minStock}</label>
              <input 
                type="number" 
                required
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                className="m-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-2">{t.description}</label>
            <textarea 
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="m-input h-24 py-3 resize-none"
              placeholder={lang === 'ar' ? 'وصف المنتج...' : 'Product description...'}
            />
          </div>
        </form>
      </Modal>

      {/* Category Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={lang === 'ar' ? 'إضافة قسم جديد' : 'Add New Category'}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button 
              variant="secondary"
              onClick={() => setIsCategoryModalOpen(false)}
              className="flex-1"
            >
              {t.cancel}
            </Button>
            <Button 
              onClick={handleAddCategory}
              className="flex-1"
            >
              {t.save}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <input 
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="m-input"
            placeholder={lang === 'ar' ? 'اسم القسم' : 'Category Name'}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}
