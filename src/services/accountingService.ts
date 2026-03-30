import { Transaction as LedgerTransaction, Account, Product, Customer, Supplier, Invoice, Payment, JournalEntryLine } from '../types';
import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  runTransaction,
  Transaction as FirestoreTransaction
} from 'firebase/firestore';
import { logAction } from './actionTrackingService';

// Helper to manage Firestore collections
export const getCollection = async <T>(companyId: string, name: string): Promise<T[]> => {
  const path = `companies/${companyId}/${name}`;
  const q = query(collection(db, path));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
};

export const getCompanyProfile = async (companyId: string): Promise<any> => {
  const docRef = doc(db, 'companies', companyId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
};

export const updateCompanyProfile = async (companyId: string, updates: any): Promise<void> => {
  const docRef = doc(db, 'companies', companyId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
};

export const getUserProfiles = async (companyId: string): Promise<any[]> => {
  const q = query(collection(db, 'users'), where('companyId', '==', companyId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const subscribeToCollection = <T>(companyId: string, name: string, callback: (data: T[]) => void) => {
  const path = `companies/${companyId}/${name}`;
  const q = query(collection(db, path));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
    callback(data);
  });
};

export const addToCollection = async <T extends { id?: string }>(
  companyId: string, 
  name: string, 
  item: T,
  transaction?: FirestoreTransaction
): Promise<T> => {
  const path = `companies/${companyId}/${name}`;
  const docRef = doc(collection(db, path));
  const data = {
    ...item,
    companyId,
    createdAt: new Date().toISOString()
  };
  
  if (transaction) {
    transaction.set(docRef, data);
  } else {
    await setDoc(docRef, data);
  }
  return { ...item, id: docRef.id } as any;
};

export const updateInCollection = async <T extends { id?: string }>(companyId: string, name: string, id: string, updates: Partial<T>): Promise<void> => {
  const path = `companies/${companyId}/${name}`;
  const docRef = doc(db, path, id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
};

export const deleteFromCollection = async (companyId: string, name: string, id: string): Promise<void> => {
  const path = `companies/${companyId}/${name}`;
  const docRef = doc(db, path, id);
  await deleteDoc(docRef);
};

export const ensureSystemAccounts = async (companyId: string) => {
  const path = `companies/${companyId}/accounts`;
  const accounts = await getCollection<Account>(companyId, 'accounts');
  const systemAccounts = [
    { code: '1100', name: 'Cash', type: 'Asset' },
    { code: '1200', name: 'Accounts Receivable', type: 'Asset' },
    { code: '1300', name: 'Inventory', type: 'Asset' },
    { code: '1400', name: 'Notes Receivable', type: 'Asset' },
    { code: '2100', name: 'Accounts Payable', type: 'Liability' },
    { code: '2200', name: 'Notes Payable', type: 'Liability' },
    { code: '4100', name: 'Sales Revenue', type: 'Revenue' },
    { code: '5100', name: 'Cost of Goods Sold', type: 'Expense' },
  ];

  for (const acc of systemAccounts) {
    const exists = accounts.find((a: any) => a.name === acc.name);
    if (!exists) {
      await addDoc(collection(db, path), {
        ...acc,
        companyId,
        balance: 0,
        isSystem: true,
        createdAt: new Date().toISOString()
      });
    }
  }
};

const findAccount = async (companyId: string, criteria: { name?: string, type?: string }) => {
  const accounts = await getCollection<Account>(companyId, 'accounts');
  
  let account = accounts.find((a: any) => 
    (criteria.name && a.name === criteria.name) || (criteria.type && a.type === criteria.type)
  );

  if (!account) {
    await ensureSystemAccounts(companyId);
    const updatedAccounts = await getCollection<Account>(companyId, 'accounts');
    account = updatedAccounts.find((a: any) => 
      (criteria.name && a.name === criteria.name) || (criteria.type && a.type === criteria.type)
    );
  }

  return account;
};

export const createJournalEntry = async (
  companyId: string,
  date: string,
  description: string,
  lines: JournalEntryLine[],
  reference?: string,
  userId?: string,
  providedTransaction?: FirestoreTransaction
) => {
  const execute = async (transaction: FirestoreTransaction) => {
    // 1. READS: Fetch all accounts first
    const accountRefs = lines.map(line => doc(db, `companies/${companyId}/accounts`, line.accountId));
    const accountSnapshots = await Promise.all(accountRefs.map(ref => transaction.get(ref)));
    
    const accountsData: { [id: string]: Account } = {};
    accountSnapshots.forEach((snap, i) => {
      if (!snap.exists()) throw new Error(`Account ${lines[i].accountId} not found`);
      accountsData[lines[i].accountId] = snap.data() as Account;
    });

    // 2. WRITES: Create Journal Entry Document
    const journalRef = doc(collection(db, `companies/${companyId}/journal_entries`));
    transaction.set(journalRef, {
      companyId,
      date,
      description,
      reference: reference || null,
      lines,
      userId: userId || 'system',
      createdAt: new Date().toISOString()
    });

    // 3. WRITES: Process each line
    for (const line of lines) {
      const account = accountsData[line.accountId];
      const isNaturalDebit = ['Asset', 'Expense'].includes(account.type);
      
      // Record Transaction (Ledger Entry)
      const transRef = doc(collection(db, `companies/${companyId}/transactions`));
      transaction.set(transRef, {
        companyId,
        date,
        accountId: line.accountId,
        amount: Math.max(line.debit, line.credit),
        type: line.debit > 0 ? 'debit' : 'credit',
        description,
        journalEntryId: journalRef.id,
        userId: userId || 'system'
      });

      let balanceChange = 0;
      if (isNaturalDebit) {
        balanceChange = line.debit - line.credit;
      } else {
        balanceChange = line.credit - line.debit;
      }

      transaction.update(doc(db, `companies/${companyId}/accounts`, line.accountId), {
        balance: (account.balance || 0) + balanceChange
      });
    }
  };

  if (providedTransaction) {
    await execute(providedTransaction);
  } else {
    await runTransaction(db, execute);
  }

  await logAction({
    userId: userId || 'system',
    companyId,
    userName: 'System',
    action: 'CREATE_JOURNAL_ENTRY',
    module: 'Accounting',
    details: `Journal Entry: ${reference} - ${description}`
  });
};

export const createAccountingEntry = async (
  companyId: string,
  accountId: string,
  amount: number,
  type: 'debit' | 'credit',
  description: string,
  invoiceId?: string,
  userId?: string,
  transaction?: FirestoreTransaction
) => {
  const line: JournalEntryLine = {
    accountId,
    accountName: '', // Not strictly needed for the ledger
    debit: type === 'debit' ? amount : 0,
    credit: type === 'credit' ? amount : 0
  };
  
  await createJournalEntry(companyId, new Date().toISOString(), description, [line], invoiceId, userId, transaction);
};

export const recordTreasuryMovement = async (
  companyId: string,
  type: 'income' | 'expense',
  amount: number,
  description: string,
  accountId: string,
  userId?: string
) => {
  const entryType = type === 'income' ? 'debit' : 'credit';
  await createAccountingEntry(companyId, accountId, amount, entryType, description, undefined, userId);
};

export const recordSupplierPayment = async (
  companyId: string,
  supplierId: string,
  amount: number,
  description: string,
  cashAccountId: string,
  userId?: string
) => {
  const supplierRef = doc(db, `companies/${companyId}/suppliers`, supplierId);
  
  await runTransaction(db, async (transaction) => {
    const supplierDoc = await transaction.get(supplierRef);
    if (!supplierDoc.exists()) throw new Error("Supplier not found");
    
    const supplier = supplierDoc.data() as Supplier;

    // 1. Create Accounting Entry (READS then WRITES)
    await createAccountingEntry(companyId, cashAccountId, amount, 'credit', `Payment to Supplier: ${supplier.name}. ${description}`, undefined, userId, transaction);

    // 2. Update Supplier (WRITE)
    transaction.update(supplierRef, {
      balance: (supplier.balance || 0) - amount
    });
  });

  await logAction({
    userId: userId || 'system',
    companyId,
    userName: 'System',
    action: 'RECORD_SUPPLIER_PAYMENT',
    module: 'Treasury',
    details: `Payment of SAR ${amount} to supplier ${supplierId} - ${description}`
  });
};

export const recordSalesInvoice = async (
  companyId: string,
  invoice: any,
  cashAccountId?: string
) => {
  const revenueAccount = await findAccount(companyId, { name: 'Sales Revenue', type: 'Revenue' });
  const inventoryAccount = await findAccount(companyId, { name: 'Inventory', type: 'Asset' });
  const cogsAccount = await findAccount(companyId, { name: 'Cost of Goods Sold', type: 'Expense' });
  
  if (!revenueAccount || !inventoryAccount || !cogsAccount) throw new Error('System accounts not found.');

  let debitAccountId = cashAccountId;
  if (!debitAccountId) {
    const arAccount = await findAccount(companyId, { name: 'Accounts Receivable', type: 'Asset' });
    if (!arAccount) throw new Error('Accounts Receivable account not found.');
    debitAccountId = arAccount.id;
  }

  await runTransaction(db, async (transaction) => {
    // 1. READS: Fetch all products and customer
    const productRefs = invoice.items.map((item: any) => doc(db, `companies/${companyId}/products`, item.productId));
    const productSnapshots = await Promise.all(productRefs.map((ref: any) => transaction.get(ref)));
    
    const productsData: { [id: string]: Product } = {};
    productSnapshots.forEach((snap, i) => {
      if (snap.exists()) {
        productsData[invoice.items[i].productId] = snap.data() as Product;
      }
    });

    let customerData: Customer | null = null;
    let customerRef: any = null;
    if (!cashAccountId && invoice.customerId) {
      customerRef = doc(db, `companies/${companyId}/customers`, invoice.customerId);
      const customerDoc = await transaction.get(customerRef);
      if (customerDoc.exists()) {
        customerData = customerDoc.data() as Customer;
      }
    }

    // 2. Calculate COGS and prepare product updates
    let totalCost = 0;
    const productUpdates: { ref: any, quantity: number }[] = [];
    for (const item of invoice.items) {
      const product = productsData[item.productId];
      if (product) {
        totalCost += (product.purchasePrice || 0) * item.quantity;
        productUpdates.push({
          ref: doc(db, `companies/${companyId}/products`, item.productId),
          quantity: (product.quantity || 0) - item.quantity
        });
      }
    }

    // 3. WRITES: Create Journal Entries
    const lines: JournalEntryLine[] = [
      { accountId: debitAccountId!, accountName: '', debit: invoice.total, credit: 0 },
      { accountId: revenueAccount.id, accountName: '', debit: 0, credit: invoice.total }
    ];

    if (totalCost > 0) {
      lines.push({ accountId: cogsAccount.id, accountName: '', debit: totalCost, credit: 0 });
      lines.push({ accountId: inventoryAccount.id, accountName: '', debit: 0, credit: totalCost });
    }

    await createJournalEntry(
      companyId, 
      new Date().toISOString(), 
      `Sales Invoice ${invoice.number}`,
      lines,
      invoice.id,
      undefined,
      transaction
    );

    // 4. WRITES: Update Product Quantities
    for (const update of productUpdates) {
      transaction.update(update.ref, { quantity: update.quantity });
    }

    // 5. WRITES: Update Customer Balance if AR
    if (customerData && customerRef) {
      transaction.update(customerRef, {
        balance: (customerData.balance || 0) + invoice.total,
        totalPurchases: (customerData.totalPurchases || 0) + invoice.total
      });
    }
  });

  await logAction({
    userId: 'system',
    companyId,
    userName: 'System',
    action: 'RECORD_SALES_INVOICE',
    module: 'Sales',
    details: `Invoice ${invoice.number} - Total: SAR ${invoice.total}`
  });
};

export const recordPurchaseInvoice = async (
  companyId: string,
  invoice: any,
  cashAccountId?: string
) => {
  const inventoryAccount = await findAccount(companyId, { name: 'Inventory', type: 'Asset' });
  if (!inventoryAccount) throw new Error('Inventory account not found.');

  let creditAccountId = cashAccountId;
  if (!creditAccountId) {
    const apAccount = await findAccount(companyId, { name: 'Accounts Payable', type: 'Liability' });
    if (!apAccount) throw new Error('Accounts Payable account not found.');
    creditAccountId = apAccount.id;
  }

  await runTransaction(db, async (transaction) => {
    // 1. READS: Fetch all products and supplier
    const productRefs = invoice.items.map((item: any) => doc(db, `companies/${companyId}/products`, item.productId));
    const productSnapshots = await Promise.all(productRefs.map((ref: any) => transaction.get(ref)));
    
    const productsData: { [id: string]: Product } = {};
    productSnapshots.forEach((snap, i) => {
      if (snap.exists()) {
        productsData[invoice.items[i].productId] = snap.data() as Product;
      }
    });

    let supplierData: Supplier | null = null;
    let supplierRef: any = null;
    if (!cashAccountId && invoice.supplierId) {
      supplierRef = doc(db, `companies/${companyId}/suppliers`, invoice.supplierId);
      const supplierDoc = await transaction.get(supplierRef);
      if (supplierDoc.exists()) {
        supplierData = supplierDoc.data() as Supplier;
      }
    }

    // 2. Prepare product updates
    const productUpdates: { ref: any, quantity: number, purchasePrice: number }[] = [];
    for (const item of invoice.items) {
      const product = productsData[item.productId];
      if (product) {
        productUpdates.push({
          ref: doc(db, `companies/${companyId}/products`, item.productId),
          quantity: (product.quantity || 0) + item.quantity,
          purchasePrice: item.price
        });
      }
    }

    // 3. WRITES: Create Journal Entry
    await createJournalEntry(
      companyId, 
      new Date().toISOString(), 
      `Purchase Invoice ${invoice.number}`,
      [
        { accountId: inventoryAccount.id, accountName: '', debit: invoice.total, credit: 0 },
        { accountId: creditAccountId!, accountName: '', debit: 0, credit: invoice.total }
      ],
      invoice.id,
      undefined,
      transaction
    );

    // 4. WRITES: Update Product Quantities and Prices
    for (const update of productUpdates) {
      transaction.update(update.ref, { 
        quantity: update.quantity,
        purchasePrice: update.purchasePrice
      });
    }

    // 5. WRITES: Update Supplier Balance if AP
    if (supplierData && supplierRef) {
      transaction.update(supplierRef, {
        balance: (supplierData.balance || 0) + invoice.total
      });
    }
  });

  await logAction({
    userId: 'system',
    companyId,
    userName: 'System',
    action: 'RECORD_PURCHASE_INVOICE',
    module: 'Purchases',
    details: `Purchase Invoice ${invoice.number} - Total: SAR ${invoice.total}`
  });
};

export const recordSalesReturn = async (
  companyId: string,
  returnData: any
) => {
  const revenueAccount = await findAccount(companyId, { name: 'Sales Revenue', type: 'Revenue' });
  const inventoryAccount = await findAccount(companyId, { name: 'Inventory', type: 'Asset' });
  const cogsAccount = await findAccount(companyId, { name: 'Cost of Goods Sold', type: 'Expense' });
  const arAccount = await findAccount(companyId, { name: 'Accounts Receivable', type: 'Asset' });
  
  if (!revenueAccount || !inventoryAccount || !cogsAccount || !arAccount) throw new Error('System accounts not found.');

  await runTransaction(db, async (transaction) => {
    // 1. Update Product Quantities and Calculate COGS to reverse
    let totalCostToReverse = 0;
    for (const item of returnData.items) {
      const productRef = doc(db, `companies/${companyId}/products`, item.productId);
      const productDoc = await transaction.get(productRef);
      if (productDoc.exists()) {
        const product = productDoc.data() as Product;
        totalCostToReverse += (product.purchasePrice || 0) * item.quantity;
        transaction.update(productRef, {
          quantity: (product.quantity || 0) + item.quantity
        });
      }
    }

    // 2. Reverse Revenue and AR
    await createAccountingEntry(companyId, revenueAccount.id, returnData.totalAmount, 'debit', `Sales Return for Invoice ${returnData.invoiceNumber}`, returnData.id);
    await createAccountingEntry(companyId, arAccount.id, returnData.totalAmount, 'credit', `Sales Return for Invoice ${returnData.invoiceNumber}`, returnData.id);

    // 3. Reverse COGS and Inventory
    if (totalCostToReverse > 0) {
      await createAccountingEntry(companyId, inventoryAccount.id, totalCostToReverse, 'debit', `Inventory reversal for Return ${returnData.id}`, returnData.id);
      await createAccountingEntry(companyId, cogsAccount.id, totalCostToReverse, 'credit', `COGS reversal for Return ${returnData.id}`, returnData.id);
    }

    // 4. Update Customer Balance
    const invoiceRef = doc(db, `companies/${companyId}/invoices`, returnData.invoiceId);
    const invoiceDoc = await transaction.get(invoiceRef);
    if (invoiceDoc.exists()) {
      const originalInvoice = invoiceDoc.data() as Invoice;
      if (originalInvoice.customerId) {
        const customerRef = doc(db, `companies/${companyId}/customers`, originalInvoice.customerId);
        const customerDoc = await transaction.get(customerRef);
        if (customerDoc.exists()) {
          const customer = customerDoc.data() as Customer;
          transaction.update(customerRef, {
            balance: (customer.balance || 0) - returnData.totalAmount
          });
        }
      }
    }
  });

  await logAction({
    userId: 'system',
    companyId,
    userName: 'System',
    action: 'RECORD_SALES_RETURN',
    module: 'Returns',
    details: `Sales Return for Invoice ${returnData.invoiceNumber} - Total: SAR ${returnData.totalAmount}`
  });
};

export const recordPurchaseReturn = async (
  companyId: string,
  returnData: any
) => {
  const inventoryAccount = await findAccount(companyId, { name: 'Inventory', type: 'Asset' });
  const apAccount = await findAccount(companyId, { name: 'Accounts Payable', type: 'Liability' });
  
  if (!inventoryAccount || !apAccount) throw new Error('System accounts not found.');

  await runTransaction(db, async (transaction) => {
    // 1. Update Product Quantities
    for (const item of returnData.items) {
      const productRef = doc(db, `companies/${companyId}/products`, item.productId);
      const productDoc = await transaction.get(productRef);
      if (productDoc.exists()) {
        const product = productDoc.data() as Product;
        transaction.update(productRef, {
          quantity: (product.quantity || 0) - item.quantity
        });
      }
    }

    // 2. Reverse Inventory and AP
    await createAccountingEntry(companyId, apAccount.id, returnData.totalAmount, 'debit', `Purchase Return for Invoice ${returnData.invoiceNumber}`, returnData.id);
    await createAccountingEntry(companyId, inventoryAccount.id, returnData.totalAmount, 'credit', `Purchase Return for Invoice ${returnData.invoiceNumber}`, returnData.id);

    // 3. Update Supplier Balance
    const invoiceRef = doc(db, `companies/${companyId}/invoices`, returnData.invoiceId);
    const invoiceDoc = await transaction.get(invoiceRef);
    if (invoiceDoc.exists()) {
      const originalInvoice = invoiceDoc.data() as Invoice;
      if (originalInvoice.supplierId) {
        const supplierRef = doc(db, `companies/${companyId}/suppliers`, originalInvoice.supplierId);
        const supplierDoc = await transaction.get(supplierRef);
        if (supplierDoc.exists()) {
          const supplier = supplierDoc.data() as Supplier;
          transaction.update(supplierRef, {
            balance: (supplier.balance || 0) - returnData.totalAmount
          });
        }
      }
    }
  });

  await logAction({
    userId: 'system',
    companyId,
    userName: 'System',
    action: 'RECORD_PURCHASE_RETURN',
    module: 'Returns',
    details: `Purchase Return for Invoice ${returnData.invoiceNumber} - Total: SAR ${returnData.totalAmount}`
  });
};

export const recordExpense = async (
  companyId: string,
  amount: number,
  description: string,
  expenseAccountId: string,
  cashAccountId: string,
  userId?: string
) => {
  const lines: JournalEntryLine[] = [
    { accountId: expenseAccountId, accountName: '', debit: amount, credit: 0 },
    { accountId: cashAccountId, accountName: '', debit: 0, credit: amount }
  ];

  await createJournalEntry(companyId, new Date().toISOString(), description, lines, undefined, userId);

  await logAction({
    userId: userId || 'system',
    companyId,
    userName: 'System',
    action: 'RECORD_EXPENSE',
    module: 'Treasury',
    details: `Expense of SAR ${amount} - ${description}`
  });
};

export const recordCashMovement = async (
  companyId: string,
  amount: number,
  description: string,
  type: 'in' | 'out',
  cashAccountId: string,
  userId?: string
) => {
  const entryType = type === 'in' ? 'debit' : 'credit';
  await createAccountingEntry(companyId, cashAccountId, amount, entryType, description, undefined, userId);

  await logAction({
    userId: userId || 'system',
    companyId,
    userName: 'System',
    action: 'RECORD_CASH_MOVEMENT',
    module: 'Treasury',
    details: `Cash ${type} of SAR ${amount} - ${description}`
  });
};

export const recordCustomerPayment = async (
  companyId: string,
  customerId: string,
  amount: number,
  method: string,
  notes: string,
  cashAccountId: string,
  userId?: string
) => {
  const arAccount = await findAccount(companyId, { name: 'Accounts Receivable', type: 'Asset' });
  if (!arAccount) throw new Error('Accounts Receivable account not found.');

  const customerRef = doc(db, `companies/${companyId}/customers`, customerId);
  
  await runTransaction(db, async (transaction) => {
    const customerDoc = await transaction.get(customerRef);
    if (!customerDoc.exists()) throw new Error("Customer not found");
    
    const customer = customerDoc.data() as Customer;

    // 1. Create Journal Entry (READS then WRITES)
    await createJournalEntry(
      companyId, 
      new Date().toISOString(), 
      `Payment from Customer: ${customer.name}. ${notes}`,
      [
        { accountId: cashAccountId, accountName: '', debit: amount, credit: 0 },
        { accountId: arAccount.id, accountName: '', debit: 0, credit: amount }
      ],
      undefined,
      userId,
      transaction
    );

    // 2. Update Customer (WRITE)
    transaction.update(customerRef, {
      balance: (customer.balance || 0) - amount,
      totalPaid: (customer.totalPaid || 0) + amount
    });

    // 3. Create Payment Document (WRITE)
    await addToCollection<any>(companyId, 'payments', {
      customerId,
      customerName: customer.name,
      amount,
      method,
      notes,
      userId: userId || 'system'
    }, transaction);
  });

  await logAction({
    userId: userId || 'system',
    companyId,
    userName: 'System',
    action: 'RECORD_CUSTOMER_PAYMENT',
    module: 'Treasury',
    details: `Payment of SAR ${amount} from customer ${customerId} - ${notes}`
  });
};

export const recordCheque = async (
  companyId: string,
  cheque: any,
  userId?: string
) => {
  const isIncoming = cheque.type === 'incoming';
  const notesAccount = await findAccount(companyId, { 
    name: isIncoming ? 'Notes Receivable' : 'Notes Payable', 
    type: isIncoming ? 'Asset' : 'Liability' 
  });
  
  if (!notesAccount) throw new Error(`${isIncoming ? 'Notes Receivable' : 'Notes Payable'} account not found.`);

  const arAccount = isIncoming ? await findAccount(companyId, { name: 'Accounts Receivable', type: 'Asset' }) : null;
  const apAccount = !isIncoming ? await findAccount(companyId, { name: 'Accounts Payable', type: 'Liability' }) : null;

  await runTransaction(db, async (transaction) => {
    if (isIncoming) {
      if (arAccount) {
        await createJournalEntry(
          companyId,
          new Date().toISOString(),
          `Cheque received #${cheque.number}`,
          [
            { accountId: notesAccount.id, accountName: '', debit: cheque.amount, credit: 0 },
            { accountId: arAccount.id, accountName: '', debit: 0, credit: cheque.amount }
          ],
          undefined,
          userId,
          transaction
        );
      }
      
      const customerRef = doc(db, `companies/${companyId}/customers`, cheque.entityId);
      const customerDoc = await transaction.get(customerRef);
      if (customerDoc.exists()) {
        const customer = customerDoc.data() as Customer;
        transaction.update(customerRef, {
          balance: (customer.balance || 0) - cheque.amount,
          totalPaid: (customer.totalPaid || 0) + cheque.amount
        });
      }
    } else {
      if (apAccount) {
        await createJournalEntry(
          companyId,
          new Date().toISOString(),
          `Cheque issued #${cheque.number}`,
          [
            { accountId: apAccount.id, accountName: '', debit: cheque.amount, credit: 0 },
            { accountId: notesAccount.id, accountName: '', debit: 0, credit: cheque.amount }
          ],
          undefined,
          userId,
          transaction
        );
      }
      
      const supplierRef = doc(db, `companies/${companyId}/suppliers`, cheque.entityId);
      const supplierDoc = await transaction.get(supplierRef);
      if (supplierDoc.exists()) {
        const supplier = supplierDoc.data() as Supplier;
        transaction.update(supplierRef, {
          balance: (supplier.balance || 0) - cheque.amount
        });
      }
    }

    await addToCollection(companyId, 'cheques', { ...cheque, status: 'pending' }, transaction);
  });

  await logAction({
    userId: userId || 'system',
    companyId,
    userName: 'System',
    action: 'RECORD_CHEQUE',
    module: 'Cheques',
    details: `Recorded ${cheque.type} cheque #${cheque.number} - Amount: SAR ${cheque.amount}`
  });
};

export const clearCheque = async (
  companyId: string,
  chequeId: string,
  userId?: string
) => {
  const chequeRef = doc(db, `companies/${companyId}/cheques`, chequeId);
  
  let chequeNumber = '';
  await runTransaction(db, async (transaction) => {
    const chequeDoc = await transaction.get(chequeRef);
    if (!chequeDoc.exists()) throw new Error("Cheque not found");
    
    const cheque = chequeDoc.data() as any;
    chequeNumber = cheque.number;
    if (cheque.status !== 'pending') throw new Error("Cheque is already processed");

    const isIncoming = cheque.type === 'incoming';
    const notesAccount = await findAccount(companyId, { 
      name: isIncoming ? 'Notes Receivable' : 'Notes Payable', 
      type: isIncoming ? 'Asset' : 'Liability' 
    });
    
    if (!notesAccount) throw new Error(`${isIncoming ? 'Notes Receivable' : 'Notes Payable'} account not found.`);

    // 1. Create Journal Entry (READS then WRITES)
    await createJournalEntry(
      companyId,
      new Date().toISOString(),
      `Cheque cleared #${cheque.number}`,
      [
        { 
          accountId: isIncoming ? cheque.accountId : notesAccount.id, 
          accountName: '', 
          debit: cheque.amount, 
          credit: 0 
        },
        { 
          accountId: isIncoming ? notesAccount.id : cheque.accountId, 
          accountName: '', 
          debit: 0, 
          credit: cheque.amount 
        }
      ],
      undefined,
      userId,
      transaction
    );

    // 2. Update Cheque Status (WRITE)
    transaction.update(chequeRef, {
      status: 'cleared',
      updatedAt: new Date().toISOString()
    });
  });

  await logAction({
    userId: userId || 'system',
    companyId,
    userName: 'System',
    action: 'CLEAR_CHEQUE',
    module: 'Cheques',
    details: `Cleared cheque #${chequeNumber}`
  });
};

// --- Deletion and Update Functions ---

export const deleteInvoice = async (
  companyId: string,
  invoiceId: string,
  type: 'sales' | 'purchase',
  userId?: string
) => {
  await deleteFromCollection(companyId, 'invoices', invoiceId);
  
  await logAction({
    userId: userId || 'system',
    companyId,
    userName: 'System',
    action: 'DELETE_INVOICE',
    module: 'Invoices',
    details: `Deleted ${type} invoice #${invoiceId}`
  });
};

export const deletePayment = async (
  companyId: string,
  paymentId: string,
  type: 'customer' | 'supplier',
  userId?: string
) => {
  await deleteFromCollection(companyId, 'payments', paymentId);
  
  await logAction({
    userId: userId || 'system',
    companyId,
    userName: 'System',
    action: 'DELETE_PAYMENT',
    module: 'Payments',
    details: `Deleted ${type} payment #${paymentId}`
  });
};

export const deleteReturn = async (
  companyId: string,
  returnId: string,
  type: 'sales' | 'purchase',
  userId?: string
) => {
  await deleteFromCollection(companyId, 'returns', returnId);
  
  await logAction({
    userId: userId || 'system',
    companyId,
    userName: 'System',
    action: 'DELETE_RETURN',
    module: 'Returns',
    details: `Deleted ${type} return #${returnId}`
  });
};

export const deleteProduct = async (
  companyId: string,
  productId: string,
  userId?: string
) => {
  await deleteFromCollection(companyId, 'products', productId);
  
  await logAction({
    userId: userId || 'system',
    companyId,
    userName: 'System',
    action: 'DELETE_PRODUCT',
    module: 'Inventory',
    details: `Deleted product #${productId}`
  });
};

export const deleteCustomer = async (
  companyId: string,
  customerId: string,
  userId?: string
) => {
  await deleteFromCollection(companyId, 'customers', customerId);
  
  await logAction({
    userId: userId || 'system',
    companyId,
    userName: 'System',
    action: 'DELETE_CUSTOMER',
    module: 'Customers',
    details: `Deleted customer #${customerId}`
  });
};

export const deleteSupplier = async (
  companyId: string,
  supplierId: string,
  userId?: string
) => {
  await deleteFromCollection(companyId, 'suppliers', supplierId);
  
  await logAction({
    userId: userId || 'system',
    companyId,
    userName: 'System',
    action: 'DELETE_SUPPLIER',
    module: 'Suppliers',
    details: `Deleted supplier #${supplierId}`
  });
};

export const deleteCheque = async (
  companyId: string,
  chequeId: string,
  userId?: string
) => {
  await deleteFromCollection(companyId, 'cheques', chequeId);
  
  await logAction({
    userId: userId || 'system',
    companyId,
    userName: 'System',
    action: 'DELETE_CHEQUE',
    module: 'Cheques',
    details: `Deleted cheque #${chequeId}`
  });
};

export const deleteTransaction = async (
  companyId: string,
  transactionId: string,
  userId?: string
) => {
  await deleteFromCollection(companyId, 'transactions', transactionId);
  
  await logAction({
    userId: userId || 'system',
    companyId,
    userName: 'System',
    action: 'DELETE_TRANSACTION',
    module: 'Treasury',
    details: `Deleted transaction #${transactionId}`
  });
};

export const deleteJournalEntry = async (
  companyId: string,
  journalId: string,
  userId?: string
) => {
  await deleteFromCollection(companyId, 'journal_entries', journalId);
  
  await logAction({
    userId: userId || 'system',
    companyId,
    userName: 'Admin',
    action: 'DELETE_JOURNAL_ENTRY',
    module: 'Accounting',
    details: `Deleted journal entry #${journalId}`
  });
};

export const deleteUser = async (
  companyId: string,
  userIdToDelete: string,
  adminId?: string
) => {
  await deleteFromCollection(companyId, 'users', userIdToDelete);
  
  await logAction({
    userId: adminId || 'system',
    companyId,
    userName: 'Admin',
    action: 'DELETE_USER',
    module: 'Users',
    details: `Deleted user #${userIdToDelete}`
  });
};

