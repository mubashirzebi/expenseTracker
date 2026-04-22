import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus, View } from 'react-native';
import { db } from '../../db/client';
import * as schema from '../../db/schema';

export type Entry = {
  id: string;
  category: string;
  amount: string;
  note: string;
  type: string;
  period: string;
  createdAt: Date;
};

export type HistoryGroup = {
  date: string;
  entries: Entry[];
};

export type Category = {
  id: string;
  name: string;
  isArchived: boolean;
};

export type TabContext = 'Daily_Expense' | 'Daily_Income' | 'Monthly_Expense' | 'Monthly_Income';

export type FetchTransactionsParams = {
  startDate?: Date;
  endDate?: Date;
  type?: 'income' | 'expense';
  category?: string;
  searchQuery?: string;
  limit?: number;
  offset?: number;
};

export type FetchTransactionsResult = {
  groups: HistoryGroup[];
  total: number;
  hasMore: boolean;
};

export type TransactionAddedCallback = (entry: Entry) => void;

type GlobalStateContextType = {
  dailyIncome: number;
  dailyExpense: number;
  monthlyIncome: number;
  monthlyExpense: number;
  openingAmount: number | null;
  setOpeningAmount: (val: number | null) => void;
  closingBalance: number | null;
  setClosingBalance: (val: number | null) => void;
  // todayData is the in-memory cache for today only
  todayData: HistoryGroup[];
  // historyData kept for backward compat (today's group only now)
  historyData: HistoryGroup[];
  setHistoryData: React.Dispatch<React.SetStateAction<HistoryGroup[]>>;
  addTransaction: (entry: Entry, rawAmount: number) => void;
  onTransactionAdded: (callback: TransactionAddedCallback) => void;
  offTransactionAdded: (callback: TransactionAddedCallback) => void;
  fetchTransactions: (params: FetchTransactionsParams) => Promise<FetchTransactionsResult>;
  fetchMonthSummary: (year: number, month: number) => Promise<{
    dailyIncome: number; dailyExpense: number;
    monthlyIncome: number; monthlyExpense: number;
  }>;
  dailyExpenseCats: Category[];
  dailyIncomeCats: Category[];
  monthlyExpenseCats: Category[];
  monthlyIncomeCats: Category[];
  setDailyExpenseCats: React.Dispatch<React.SetStateAction<Category[]>>;
  setDailyIncomeCats: React.Dispatch<React.SetStateAction<Category[]>>;
  setMonthlyExpenseCats: React.Dispatch<React.SetStateAction<Category[]>>;
  setMonthlyIncomeCats: React.Dispatch<React.SetStateAction<Category[]>>;
  cutoffTime: string;
  setCutoffTime: React.Dispatch<React.SetStateAction<string>>;
  autoBackupTime: string;
  setAutoBackupTime: React.Dispatch<React.SetStateAction<string>>;
  autoBackupEnabled: boolean;
  setAutoBackupEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  lastBackupAt: Date | null;
  lastCloudBackupAt: Date | null;
  showWelcomeModal: boolean;
  setShowWelcomeModal: (show: boolean) => void;
  detectedBackupDate: Date | null;
  restoreInternalBackup: () => Promise<void>;
  getBusinessDateString: (overrideDate?: Date, overrideCutoff?: string) => string;
  getBusinessDate: (overrideDate?: Date, overrideCutoff?: string) => Date;
  updateTransaction: (id: string, updates: { amount?: number; category?: string; note?: string }) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  exportDatabase: (isAutoBackup?: boolean, skipShare?: boolean) => Promise<void>;
  importDatabase: () => Promise<void>;
  persistCategory: (name: string, tabContext: TabContext) => Promise<void>;
  removeCategory: (id: string, tabContext: TabContext) => Promise<void>;
};

const GlobalContext = createContext<GlobalStateContextType | undefined>(undefined);

export function GlobalProvider({ children }: { children: React.ReactNode }) {
  const [openingAmount, setOpeningAmountState] = useState<number | null>(null);
  const [closingBalance, setClosingBalanceState] = useState<number | null>(null);
  const [historyData, setHistoryData] = useState<HistoryGroup[]>([]);

  const [dailyExpenseCats, setDailyExpenseCatsState] = useState<Category[]>([]);
  const [dailyIncomeCats, setDailyIncomeCatsState] = useState<Category[]>([]);
  const [monthlyExpenseCats, setMonthlyExpenseCatsState] = useState<Category[]>([]);
  const [monthlyIncomeCats, setMonthlyIncomeCatsState] = useState<Category[]>([]);
  const [cutoffTime, setCutoffTimeState] = useState('03:00 AM');
  const [autoBackupTime, setAutoBackupTimeState] = useState('09:00 PM');
  const [autoBackupEnabled, setAutoBackupEnabledState] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<Date | null>(null);
  const [lastCloudBackupAt, setLastCloudBackupAt] = useState<Date | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [detectedBackupDate, setDetectedBackupDate] = useState<Date | null>(null);

  // Transaction added callbacks for optimistic UI updates
  const transactionCallbacksRef = useRef<Set<TransactionAddedCallback>>(new Set());

  // Hardcoded for now until Auth is implemented
  const DEFAULT_USER = 'user_123';

  // --- AUTO BACKUP: AppState-based (reliable even when app is backgrounded) ---
  // Instead of a fragile setTimeout, we check on every app foreground resume
  // whether a backup is due. This is the only reliable approach in React Native.
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const autoBackupEnabledRef = useRef(autoBackupEnabled);
  const autoBackupTimeRef = useRef(autoBackupTime);
  const lastBackupAtRef = useRef(lastBackupAt);

  // Keep refs in sync with state so the AppState handler always has fresh values
  useEffect(() => { autoBackupEnabledRef.current = autoBackupEnabled; }, [autoBackupEnabled]);
  useEffect(() => { autoBackupTimeRef.current = autoBackupTime; }, [autoBackupTime]);
  useEffect(() => { lastBackupAtRef.current = lastBackupAt; }, [lastBackupAt]);

  const isBackupDueNow = useCallback((): boolean => {
    if (!autoBackupEnabledRef.current) return false;

    const [targetHour, targetMin] = parseTime(autoBackupTimeRef.current);
    const now = new Date();
    const nowHour = now.getHours();
    const nowMin = now.getMinutes();

    // Check if current time is past the scheduled backup time today
    const isPastScheduledTime = nowHour > targetHour || (nowHour === targetHour && nowMin >= targetMin);
    if (!isPastScheduledTime) return false;

    // Check if we already ran a backup today
    const last = lastBackupAtRef.current;
    if (last) {
      const lastDate = new Date(last);
      const sameDay =
        lastDate.getFullYear() === now.getFullYear() &&
        lastDate.getMonth() === now.getMonth() &&
        lastDate.getDate() === now.getDate();
      if (sameDay) return false; // Already backed up today
    }

    return true;
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      // Trigger check when app comes to foreground
      if ((prev === 'background' || prev === 'inactive') && nextState === 'active') {
        if (isBackupDueNow()) {
          console.log('[AutoBackup] App foregrounded — backup is due, running now.');
          exportDatabase(true);
        }
      }
    });

    // Also check immediately on mount (cold start)
    if (isBackupDueNow()) {
      console.log('[AutoBackup] Cold start — backup is due, running now.');
      exportDatabase(true);
    }

    return () => subscription.remove();
  }, [isBackupDueNow]);

  const parseTime = (timeStr: string): [number, number] => {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return [21, 0]; // Default to 9:00 PM

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const modifier = match[3]?.toUpperCase();

    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;

    return [hours, minutes];
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // 0. Ensure Default User exists and fetch settings
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, DEFAULT_USER)
      });

      if (!user) {
        await db.insert(schema.users).values({
          id: DEFAULT_USER,
          fullName: 'Default User',
          email: 'user@example.com',
          passwordHash: 'none',
          cutoffTime: '03:00 AM',
          createdAt: new Date()
        });
      } else if (user.cutoffTime) {
        setCutoffTimeState(user.cutoffTime);
      }

      if (user && user.autoBackupTime) {
        setAutoBackupTimeState(user.autoBackupTime);
      }

      if (user && user.autoBackupEnabled !== undefined && user.autoBackupEnabled !== null) {
        setAutoBackupEnabledState(user.autoBackupEnabled);
      }

      if (user && user.lastBackupAt) {
        setLastBackupAt(user.lastBackupAt);
      }

      if (user && user.lastCloudBackupAt) {
        setLastCloudBackupAt(user.lastCloudBackupAt);
      }

      // 1. Load Categories
      const allCats = await db.query.categories.findMany({
        where: eq(schema.categories.userId, DEFAULT_USER)
      });

      if (allCats.length === 0) {
        // Seed default categories if first run
        const defaults = [
          { id: '1', name: 'Food', tabContext: 'Daily_Expense' },
          { id: '2', name: 'Petrol', tabContext: 'Daily_Expense' },
          { id: '3', name: 'Material', tabContext: 'Daily_Expense' },
          { id: 'd1', name: 'Freelance', tabContext: 'Daily_Income' },
          { id: 'd2', name: 'Tips', tabContext: 'Daily_Income' },
          { id: 'm1', name: 'Salary', tabContext: 'Monthly_Income' },
          { id: 'm2', name: 'Bonus', tabContext: 'Monthly_Income' },
          { id: 'm3', name: 'Rent', tabContext: 'Monthly_Expense' },
          { id: 'm4', name: 'Utilities', tabContext: 'Monthly_Expense' }
        ];
        for (const d of defaults) {
          await db.insert(schema.categories).values({
            id: d.id,
            userId: DEFAULT_USER,
            name: d.name,
            tabContext: d.tabContext,
            isArchived: false
          });
        }
        setDailyExpenseCatsState(defaults.filter(d => d.tabContext === 'Daily_Expense').map(d => ({ id: d.id, name: d.name, isArchived: false })));
        setDailyIncomeCatsState(defaults.filter(d => d.tabContext === 'Daily_Income').map(d => ({ id: d.id, name: d.name, isArchived: false })));
        setMonthlyExpenseCatsState(defaults.filter(d => d.tabContext === 'Monthly_Expense').map(d => ({ id: d.id, name: d.name, isArchived: false })));
        setMonthlyIncomeCatsState(defaults.filter(d => d.tabContext === 'Monthly_Income').map(d => ({ id: d.id, name: d.name, isArchived: false })));
      } else {
        setDailyExpenseCatsState(allCats.filter(c => c.tabContext === 'Daily_Expense').map(c => ({ id: c.id, name: c.name, isArchived: !!c.isArchived })));
        setDailyIncomeCatsState(allCats.filter(c => c.tabContext === 'Daily_Income').map(c => ({ id: c.id, name: c.name, isArchived: !!c.isArchived })));
        setMonthlyExpenseCatsState(allCats.filter(c => c.tabContext === 'Monthly_Expense').map(c => ({ id: c.id, name: c.name, isArchived: !!c.isArchived })));
        setMonthlyIncomeCatsState(allCats.filter(c => c.tabContext === 'Monthly_Income').map(c => ({ id: c.id, name: c.name, isArchived: !!c.isArchived })));
      }

      // 2. Load Drawer State for the current Business Day
      const bDate = getBusinessDateString();
      const drawer = await db.query.cashDrawerLogs.findFirst({
        where: and(
          eq(schema.cashDrawerLogs.userId, DEFAULT_USER),
          eq(schema.cashDrawerLogs.businessDate, bDate)
        )
      });
      if (drawer) {
        setOpeningAmountState(drawer.openingAmount);
        setClosingBalanceState(drawer.closingBalance);
      }

      // 3. Load TODAY's Transactions only (in-memory cache for dashboard)
      // All other history is fetched on-demand from DB via fetchTransactions()
      const todayBDate = getBusinessDateString();
      const now2 = new Date();

      // Calculate the cutoff boundary for "today"
      const [cutH, cutM] = parseTime(user?.cutoffTime || '03:00 AM');
      const cutoffBoundary = new Date();
      cutoffBoundary.setHours(cutH, cutM, 0, 0);

      // Start of today's business day window
      const windowStart = new Date();
      if (now2 < cutoffBoundary) {
        // Before cutoff — today's business day started yesterday at cutoff
        windowStart.setDate(windowStart.getDate() - 1);
      }
      windowStart.setHours(cutH, cutM, 0, 0);

      // End of today's business day window = tomorrow's cutoff
      const windowEnd = new Date(windowStart);
      windowEnd.setDate(windowEnd.getDate() + 1);
      windowEnd.setHours(cutH, cutM, 0, 0);

      const todayTxs = await db.query.transactions.findMany({
        where: and(
          eq(schema.transactions.userId, DEFAULT_USER),
          gte(schema.transactions.createdAt, windowStart),
          lte(schema.transactions.createdAt, windowEnd)
        ),
        orderBy: [desc(schema.transactions.createdAt)]
      });

      const todayGroup: HistoryGroup = {
        date: `Business Date: ${todayBDate}`,
        entries: todayTxs.map(t => ({
          id: t.id,
          category: t.categoryId || 'Other',
          amount: `${t.transactionType === 'expense' ? '-' : '+'}₹${t.amount.toLocaleString()}`,
          note: t.note || '',
          type: t.transactionType,
          period: t.trackingPeriod,
          createdAt: t.createdAt
        }))
      };

      setHistoryData(todayGroup.entries.length > 0 ? [todayGroup] : []);

      // 4. Welcome Detection: If no data at all, check for local backup file
      const totalCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.transactions)
        .where(eq(schema.transactions.userId, DEFAULT_USER));

      if ((totalCount[0]?.count ?? 0) === 0) {
        const manualBackup = FileSystem.documentDirectory + 'ExpenseTracker_Backup.db';
        const autoBackup = FileSystem.documentDirectory + 'ExpenseTracker_AutoBackup.db';
        
        const [manualInfo, autoInfo] = await Promise.all([
          FileSystem.getInfoAsync(manualBackup),
          FileSystem.getInfoAsync(autoBackup)
        ]);

        if (manualInfo.exists || autoInfo.exists) {
          // Narrow types for safety
          const mTime = (manualInfo.exists && manualInfo.modificationTime) ? manualInfo.modificationTime : 0;
          const aTime = (autoInfo.exists && autoInfo.modificationTime) ? autoInfo.modificationTime : 0;

          const latestTime = Math.max(mTime, aTime);
          
          setDetectedBackupDate(latestTime > 0 ? new Date(latestTime * 1000) : new Date());
          setShowWelcomeModal(true);
        }
      }

    } catch (e) {
      console.error("Critical DB Load Error:", e);
      // Fallback: If DB fails, we at least have an empty state
      setHistoryData([]);
    }
  };

  const getBusinessDate = (overrideDate?: Date, overrideCutoff?: string) => {
    const activeCutoff = overrideCutoff || cutoffTime;
    const targetDate = overrideDate || new Date();

    // Robust parsing for "03:00 AM", "3:00AM", "15:00", etc.
    const timeMatch = activeCutoff.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    let hours = 3;
    let minutes = 0;

    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
      const modifier = timeMatch[3]?.toUpperCase();
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
    }

    const businessDate = new Date(targetDate);
    if (targetDate.getHours() < hours || (targetDate.getHours() === hours && targetDate.getMinutes() < minutes)) {
      businessDate.setDate(targetDate.getDate() - 1);
    }

    return businessDate;
  };

  const getBusinessDateString = (overrideDate?: Date, overrideCutoff?: string) => {
    const bDate = getBusinessDate(overrideDate, overrideCutoff);
    return bDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const parseAmount = (str: string) => Number(str.replace(/[^0-9.]/g, '')) || 0;

  // Dashboard calculations — today only (in-memory cache)
  const todayLabel = `Business Date: ${getBusinessDateString()}`;
  const todayGroup = historyData.find(g => g.date === todayLabel);
  const todayEntries = todayGroup?.entries || [];

  const dailyIncome = todayEntries
    .filter(e => e.period === 'daily' && e.type === 'income')
    .reduce((acc, e) => acc + parseAmount(e.amount), 0);

  const dailyExpense = todayEntries
    .filter(e => e.period === 'daily' && e.type === 'expense')
    .reduce((acc, e) => acc + parseAmount(e.amount), 0);

  // Monthly totals for Home dashboard — fetched from today's in-memory data
  // (Home screen shows current month; Monthly screen uses fetchMonthSummary for full DB query)
  const flatEntries = historyData.reduce((acc, g) => acc.concat(g.entries || []), [] as Entry[]);
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthlyIncome = flatEntries
    .filter(e => {
      const d = new Date(e.createdAt);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && e.type === 'income';
    })
    .reduce((acc, e) => acc + parseAmount(e.amount), 0);

  const monthlyExpense = flatEntries
    .filter(e => {
      const d = new Date(e.createdAt);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && e.type === 'expense';
    })
    .reduce((acc, e) => acc + parseAmount(e.amount), 0);

  const setOpeningAmount = async (val: number | null) => {
    setOpeningAmountState(val);
    const bDate = getBusinessDateString();
    await db.insert(schema.cashDrawerLogs).values({
      id: Math.random().toString(),
      userId: DEFAULT_USER,
      businessDate: bDate,
      openingAmount: val
    }).onConflictDoUpdate({
      target: [schema.cashDrawerLogs.userId, schema.cashDrawerLogs.businessDate],
      set: { openingAmount: val }
    });
  };

  const setClosingBalance = async (val: number | null) => {
    setClosingBalanceState(val);
    const bDate = getBusinessDateString();
    await db.insert(schema.cashDrawerLogs).values({
      id: Math.random().toString(),
      userId: DEFAULT_USER,
      businessDate: bDate,
      closingBalance: val
    }).onConflictDoUpdate({
      target: [schema.cashDrawerLogs.userId, schema.cashDrawerLogs.businessDate],
      set: { closingBalance: val }
    });
  };

  const setDailyExpenseCats = async (cats: any) => {
    setDailyExpenseCatsState(cats);
  };

  const setDailyIncomeCats = async (cats: any) => {
    setDailyIncomeCatsState(cats);
  };

  const setMonthlyExpenseCats = async (cats: any) => {
    setMonthlyExpenseCatsState(cats);
  };

  const setMonthlyIncomeCats = async (cats: any) => {
    setMonthlyIncomeCatsState(cats);
  };

  const persistCategory = async (name: string, tabContext: TabContext) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Duplicate check
    const existing = 
      tabContext === 'Daily_Expense' ? dailyExpenseCats :
      tabContext === 'Daily_Income' ? dailyIncomeCats :
      tabContext === 'Monthly_Expense' ? monthlyExpenseCats :
      monthlyIncomeCats;
    
    if (existing.find(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert("Already Exists", `A ${tabContext} category named "${trimmed}" already exists.`);
      return;
    }

    const id = Date.now().toString();
    await db.insert(schema.categories).values({
      id,
      userId: DEFAULT_USER,
      name: trimmed,
      tabContext,
      isArchived: false,
    });

    const newCat = { id, name: trimmed, isArchived: false };
    if (tabContext === 'Daily_Expense') setDailyExpenseCatsState([...dailyExpenseCats, newCat]);
    else if (tabContext === 'Daily_Income') setDailyIncomeCatsState([...dailyIncomeCats, newCat]);
    else if (tabContext === 'Monthly_Expense') setMonthlyExpenseCatsState([...monthlyExpenseCats, newCat]);
    else setMonthlyIncomeCatsState([...monthlyIncomeCats, newCat]);
  };

  const removeCategory = async (id: string, tabContext: TabContext) => {
    await db.delete(schema.categories).where(eq(schema.categories.id, id));
    if (tabContext === 'Daily_Expense') setDailyExpenseCatsState(prev => prev.filter(c => c.id !== id));
    else if (tabContext === 'Daily_Income') setDailyIncomeCatsState(prev => prev.filter(c => c.id !== id));
    else if (tabContext === 'Monthly_Expense') setMonthlyExpenseCatsState(prev => prev.filter(c => c.id !== id));
    else setMonthlyIncomeCatsState(prev => prev.filter(c => c.id !== id));
  };

  const setCutoffTime: React.Dispatch<React.SetStateAction<string>> = (action) => {
    const newValue = typeof action === 'function' ? action(cutoffTime) : action;
    setCutoffTimeState(newValue);

    // Fire and forget the DB update
    db.update(schema.users)
      .set({ cutoffTime: newValue })
      .where(eq(schema.users.id, DEFAULT_USER))
      .catch(e => console.error("Failed to update cutoff time", e));
  };

  const setAutoBackupTime: React.Dispatch<React.SetStateAction<string>> = (action) => {
    const newValue = typeof action === 'function' ? action(autoBackupTime) : action;
    setAutoBackupTimeState(newValue);

    // Fire and forget the DB update
    db.update(schema.users)
      .set({ autoBackupTime: newValue })
      .where(eq(schema.users.id, DEFAULT_USER))
      .catch(e => console.error("Failed to update auto backup time", e));
  };

  const setAutoBackupEnabled: React.Dispatch<React.SetStateAction<boolean>> = (action) => {
    const newValue = typeof action === 'function' ? action(autoBackupEnabled) : action;
    setAutoBackupEnabledState(newValue);

    // Fire and forget the DB update
    db.update(schema.users)
      .set({ autoBackupEnabled: newValue })
      .where(eq(schema.users.id, DEFAULT_USER))
      .catch(e => console.error("Failed to update auto backup enabled", e));
  };

  const addTransaction = async (entry: Entry, rawAmount: number) => {
    try {
      // Use the entry's createdAt or current time
      const entryCreatedAt = entry.createdAt || new Date();

      // 1. Instant State Update (Optimistic UI)
      const bDate = getBusinessDateString(entryCreatedAt);
      const groupLabel = `Business Date: ${bDate}`;

      setHistoryData(prev => {
        const existingGroupIdx = prev.findIndex(g => g.date === groupLabel);

        if (existingGroupIdx === -1) {
          return [{ date: groupLabel, entries: [entry] }, ...prev];
        }

        const newData = [...prev];
        const targetGroup = { ...newData[existingGroupIdx] };

        // If it's an upsert (e.g. Total Sale), replace the old entry in state
        const existingEntryIdx = targetGroup.entries.findIndex(e => e.id === entry.id);
        if (existingEntryIdx !== -1) {
          const newEntries = [...targetGroup.entries];
          newEntries[existingEntryIdx] = { ...entry, createdAt: entryCreatedAt };
          targetGroup.entries = newEntries;
        } else {
          targetGroup.entries = [{ ...entry, createdAt: entryCreatedAt }, ...targetGroup.entries];
        }

        newData[existingGroupIdx] = targetGroup;
        return newData;
      });

      // Notify History screen (optimistic update)
      transactionCallbacksRef.current.forEach(cb => cb(entry));

      // 2. Persistent Save (Upsert)
      await db.insert(schema.transactions).values({
        id: entry.id || `${Date.now()}-${Math.random()}`,
        userId: DEFAULT_USER,
        categoryId: entry.category,
        amount: rawAmount,
        transactionType: entry.type,
        trackingPeriod: entry.period,
        note: entry.note,
        createdAt: entryCreatedAt
      }).onConflictDoUpdate({
        target: schema.transactions.id,
        set: {
          amount: rawAmount,
          categoryId: entry.category,
          note: entry.note
        }
      });
    } catch (e) {
      console.error("Failed to persist transaction:", e);
    }
  };

  const onTransactionAdded = useCallback((callback: TransactionAddedCallback) => {
    transactionCallbacksRef.current.add(callback);
  }, []);

  const offTransactionAdded = useCallback((callback: TransactionAddedCallback) => {
    transactionCallbacksRef.current.delete(callback);
  }, []);

  const updateTransaction = async (id: string, updates: { amount?: number; category?: string; note?: string }) => {
    try {
      // 1. Fetch to check lock
      const tx = await db.query.transactions.findFirst({ where: eq(schema.transactions.id, id) });
      if (!tx) return;

      const diff = Date.now() - tx.createdAt.getTime();
      if (diff > 14 * 24 * 60 * 60 * 1000) {
        Alert.alert("Locked", "Transactions older than 14 days cannot be modified for audit integrity.");
        return;
      }

      // 2. Update Database
      await db.update(schema.transactions)
        .set(updates)
        .where(eq(schema.transactions.id, id));

      // 3. Refresh State to ensure UI is in sync
      setHistoryData(prev => prev.map(group => ({
        ...group,
        entries: group.entries.map(e => e.id === id ? {
          ...e,
          category: updates.category || e.category,
          amount: updates.amount !== undefined
            ? `${e.type === 'expense' ? '-' : '+'}₹${updates.amount.toLocaleString()}`
            : e.amount,
          note: updates.note !== undefined ? updates.note : e.note
        } : e)
      })));
    } catch (e) {
      console.error("Failed to update transaction:", e);
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      // 1. Fetch to check lock
      const tx = await db.query.transactions.findFirst({ where: eq(schema.transactions.id, id) });
      if (!tx) return;

      const diff = Date.now() - tx.createdAt.getTime();
      if (diff > 14 * 24 * 60 * 60 * 1000) {
        Alert.alert("Locked", "Transactions older than 14 days cannot be deleted for audit integrity.");
        return;
      }

      // 2. Remove from DB
      await db.delete(schema.transactions).where(eq(schema.transactions.id, id));

      // 3. Remove from State
      setHistoryData(prev => prev.map(group => ({
        ...group,
        entries: group.entries.filter(e => e.id !== id)
      })).filter(group => group.entries.length > 0));
    } catch (e) {
      console.error("Failed to delete transaction:", e);
    }
  };

  const exportDatabase = async (isAutoBackup: boolean = false, skipShare: boolean = false) => {
    try {
      const dbPath = FileSystem.documentDirectory + 'SQLite/expense_tracker.db';
      const fileInfo = await FileSystem.getInfoAsync(dbPath);

      if (!fileInfo.exists) {
        if (!isAutoBackup && !skipShare) {
          Alert.alert("Error", "Database file not found. Make sure you have added some records first.");
        }
        return;
      }

      // Ensure cache directory exists
      if (FileSystem.cacheDirectory) {
        await FileSystem.makeDirectoryAsync(FileSystem.cacheDirectory, { intermediates: true }).catch(() => { });
      }

      // Internal path for "Welcome Back" detection (persistent across cache clears)
      const masterBackupPath = FileSystem.documentDirectory + (isAutoBackup ? 'ExpenseTracker_AutoBackup.db' : 'ExpenseTracker_Backup.db');
      
      // Share path — same fixed name, always overwrites the previous export
      const sharePath = (FileSystem.cacheDirectory || FileSystem.documentDirectory) + (isAutoBackup ? 'ExpenseTracker_AutoBackup.db' : 'ExpenseTracker_Backup.db');

      // Save to Master location for app-detection
      await FileSystem.copyAsync({ from: dbPath, to: masterBackupPath });

      // Save to Share location for user-export
      await FileSystem.copyAsync({ from: dbPath, to: sharePath });

      const now = new Date();
      if (isAutoBackup) {
        console.log('Auto backup completed at:', now.toISOString());
      }
      
      // Update DB and State
      setLastBackupAt(now);
      const updateFields: any = { lastBackupAt: now };
      
      // If it's a manual export (not auto and not skipped), it counts as a Cloud Backup
      if (!isAutoBackup && !skipShare) {
         setLastCloudBackupAt(now);
         updateFields.lastCloudBackupAt = now;
      }

      await db.update(schema.users)
        .set(updateFields)
        .where(eq(schema.users.id, DEFAULT_USER));

      if (isAutoBackup || skipShare) {
        if (skipShare) Alert.alert("Backup Successful", "A secure copy of your database has been saved to your phone's internal memory.");
        return;
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(sharePath, {
          mimeType: 'application/x-sqlite3',
          dialogTitle: 'Export Expense Tracker Data',
          UTI: 'public.database'
        });
      } else {
        Alert.alert("Error", "Sharing is not available on this device.");
      }
    } catch (e: any) {
      console.error("Export failed:", e);
      if (!isAutoBackup) {
        Alert.alert("Export Error", `Details: ${e.message || "Unknown error"}. Is the database busy?`);
      }
    }
  };

  const importDatabase = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/x-sqlite3', 'application/octet-stream'],
        copyToCacheDirectory: true
      });

      if (result.canceled) return;

      const selectedFile = result.assets[0];
      const dbPath = FileSystem.documentDirectory + 'SQLite/expense_tracker.db';

      Alert.alert(
        "Restore Data",
        "This will permanently OVERWRITE your current data with the selected backup. Are you sure?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Yes, Restore",
            style: "destructive",
            onPress: async () => {
              try {
                // To safely overwrite, we copy to the SQLite path
                await FileSystem.copyAsync({
                  from: selectedFile.uri,
                  to: dbPath
                });
                Alert.alert("Success!", "Your data has been restored. Please CLOSE and RESTART the app to see the changes.");
              } catch (err) {
                console.error("Restore failed:", err);
                Alert.alert("Error", "Failed to overwrite database. Ensure the file is a valid backup.");
              }
            }
          }
        ]
      );
    } catch (e) {
      console.error("Import failed:", e);
      Alert.alert("Import Error", "Could not load the backup file.");
    }
  };

  const restoreInternalBackup = async () => {
    try {
      const manualBackupPath = FileSystem.documentDirectory + 'ExpenseTracker_Backup.db';
      const autoBackupPath = FileSystem.documentDirectory + 'ExpenseTracker_AutoBackup.db';
      const dbPath = FileSystem.documentDirectory + 'SQLite/expense_tracker.db';

      // Pick the newest available backup
      const [manualInfo, autoInfo] = await Promise.all([
        FileSystem.getInfoAsync(manualBackupPath),
        FileSystem.getInfoAsync(autoBackupPath)
      ]);

      let sourcePath: string | null = null;

      if (manualInfo.exists && autoInfo.exists) {
        const mTime = (manualInfo.modificationTime ?? 0);
        const aTime = (autoInfo.modificationTime ?? 0);
        sourcePath = aTime >= mTime ? autoBackupPath : manualBackupPath;
      } else if (manualInfo.exists) {
        sourcePath = manualBackupPath;
      } else if (autoInfo.exists) {
        sourcePath = autoBackupPath;
      }

      if (!sourcePath) {
        Alert.alert("Error", "No backup file found to restore.");
        return;
      }

      await FileSystem.copyAsync({ from: sourcePath, to: dbPath });
      Alert.alert("Restored!", "Your data has been successfully restored. Please restart the app.");
      setShowWelcomeModal(false);
    } catch (err) {
      console.error("Internal restore failed:", err);
      Alert.alert("Error", "Failed to restore the internal backup file.");
    }
  };

  // --- DB-backed paginated transaction fetcher ---
  const fetchTransactions = useCallback(async (params: FetchTransactionsParams): Promise<FetchTransactionsResult> => {
    const {
      startDate,
      endDate,
      type,
      category,
      searchQuery,
      limit = 15,
      offset = 0, 
    } = params;   

    try {
      const conditions: any[] = [eq(schema.transactions.userId, DEFAULT_USER)];

      if (startDate) conditions.push(gte(schema.transactions.createdAt, startDate));
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        conditions.push(lte(schema.transactions.createdAt, endOfDay));
      }
      if (type) conditions.push(eq(schema.transactions.transactionType, type));
      if (category && category !== 'All') {
        conditions.push(eq(schema.transactions.categoryId, category));
      }

      const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

      // Total count for pagination
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.transactions)
        .where(whereClause);
      const total = Number(countResult[0]?.count ?? 0);

      // Fetch page
      const txs = await db.query.transactions.findMany({
        where: whereClause,
        orderBy: [desc(schema.transactions.createdAt)],
        limit,
        offset,
      });

      // Optional in-memory search filter
      const filtered = searchQuery
        ? txs.filter(t => {
            const q = searchQuery.toLowerCase();
            return (
              (t.categoryId || '').toLowerCase().includes(q) ||
              (t.note || '').toLowerCase().includes(q) ||
              t.amount.toString().includes(q)
            );
          })
        : txs;

      // Group by business date
      const groups: HistoryGroup[] = [];
      filtered.forEach(t => {
        const bDateStr = getBusinessDateString(t.createdAt);
        const groupLabel = `Business Date: ${bDateStr}`;
        const existing = groups.find(g => g.date === groupLabel);
        const entry: Entry = {
          id: t.id,
          category: t.categoryId || 'Other',
          amount: `${t.transactionType === 'expense' ? '-' : '+'}₹${t.amount.toLocaleString()}`,
          note: t.note || '',
          type: t.transactionType,
          period: t.trackingPeriod,
          createdAt: t.createdAt,
        };
        if (existing) {
          existing.entries.push(entry);
        } else {
          groups.push({ date: groupLabel, entries: [entry] });
        }
      });

      return { groups, total, hasMore: offset + limit < total };
    } catch (e) {
      console.error('fetchTransactions error:', e);
      return { groups: [], total: 0, hasMore: false };
    }
  }, [getBusinessDateString]);

  // --- Month summary fetcher (for Monthly screen, up to 3 months back) ---
  const fetchMonthSummary = useCallback(async (year: number, month: number) => {
    try {
      const startOfMonth = new Date(year, month, 1, 0, 0, 0, 0);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

      const txs = await db.query.transactions.findMany({
        where: and(
          eq(schema.transactions.userId, DEFAULT_USER),
          gte(schema.transactions.createdAt, startOfMonth),
          lte(schema.transactions.createdAt, endOfMonth)
        ),
      });

      return {
        dailyIncome: txs.filter(t => t.trackingPeriod === 'daily' && t.transactionType === 'income').reduce((a, t) => a + (t.amount || 0), 0),
        dailyExpense: txs.filter(t => t.trackingPeriod === 'daily' && t.transactionType === 'expense').reduce((a, t) => a + (t.amount || 0), 0),
        monthlyIncome: txs.filter(t => t.trackingPeriod === 'monthly' && t.transactionType === 'income').reduce((a, t) => a + (t.amount || 0), 0),
        monthlyExpense: txs.filter(t => t.trackingPeriod === 'monthly' && t.transactionType === 'expense').reduce((a, t) => a + (t.amount || 0), 0),
      };
    } catch (e) {
      console.error('fetchMonthSummary error:', e);
      return { dailyIncome: 0, dailyExpense: 0, monthlyIncome: 0, monthlyExpense: 0 };
    }
  }, []);

  return (
    <GlobalContext.Provider value={{
      dailyIncome, dailyExpense,
      monthlyIncome, monthlyExpense,
      openingAmount, setOpeningAmount,
      closingBalance, setClosingBalance,
      todayData: historyData,
      historyData, setHistoryData,
      addTransaction,
      onTransactionAdded,
      offTransactionAdded,
      fetchTransactions,
      fetchMonthSummary,
      dailyExpenseCats, setDailyExpenseCats,
      dailyIncomeCats, setDailyIncomeCats,
      monthlyExpenseCats, setMonthlyExpenseCats,
      monthlyIncomeCats, setMonthlyIncomeCats,
      cutoffTime, setCutoffTime,
      autoBackupTime, setAutoBackupTime,
      autoBackupEnabled, setAutoBackupEnabled,
      lastBackupAt, lastCloudBackupAt,
      showWelcomeModal, setShowWelcomeModal, detectedBackupDate, restoreInternalBackup,
      getBusinessDateString,
      getBusinessDate,
      updateTransaction,
      deleteTransaction,
      exportDatabase, importDatabase,
      persistCategory, removeCategory
    }}>
      {children}
    </GlobalContext.Provider>
  );
}

export function useGlobalState() {
  const context = useContext(GlobalContext);
  if (!context) throw new Error('useGlobalState must be used within a GlobalProvider');
  return context;
}

// Required: Expo Router scans all files in app/ for routes.
// This dummy default export prevents the "missing default export" warning
// while keeping this file as a non-navigable utility module.
export default function GlobalStateRoute() {
  return <View />;
}
