import React, { createContext, useContext, useEffect, useState } from 'react';
import { View } from 'react-native';
import { db } from '../../db/client';
import * as schema from '../../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Alert } from 'react-native';

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

type GlobalStateContextType = {
  dailyIncome: number;
  dailyExpense: number;
  monthlyIncome: number;
  monthlyExpense: number;
  openingAmount: number | null;
  setOpeningAmount: (val: number | null) => void;
  closingBalance: number | null;
  setClosingBalance: (val: number | null) => void;
  historyData: HistoryGroup[];
  setHistoryData: React.Dispatch<React.SetStateAction<HistoryGroup[]>>;
  addTransaction: (entry: Entry, rawAmount: number) => void;
  dailyCats: Category[];
  setDailyCats: React.Dispatch<React.SetStateAction<Category[]>>;
  monthlyCats: Category[];
  setMonthlyCats: React.Dispatch<React.SetStateAction<Category[]>>;
  cutoffTime: string;
  setCutoffTime: React.Dispatch<React.SetStateAction<string>>;
  getBusinessDateString: (overrideDate?: Date, overrideCutoff?: string) => string;
  updateTransaction: (id: string, updates: { amount?: number; category?: string; note?: string }) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  exportDatabase: () => Promise<void>;
  importDatabase: () => Promise<void>;
  persistCategory: (name: string, tabContext: 'Daily' | 'Monthly') => Promise<void>;
  removeCategory: (id: string, tabContext: 'Daily' | 'Monthly') => Promise<void>;
};

const GlobalContext = createContext<GlobalStateContextType | undefined>(undefined);

export function GlobalProvider({ children }: { children: React.ReactNode }) {
  const [openingAmount, setOpeningAmountState] = useState<number | null>(null);
  const [closingBalance, setClosingBalanceState] = useState<number | null>(null);
  const [historyData, setHistoryData] = useState<HistoryGroup[]>([]);
  
  const [dailyCats, setDailyCatsState] = useState<Category[]>([]);
  const [monthlyCats, setMonthlyCatsState] = useState<Category[]>([]);
  const [cutoffTime, setCutoffTimeState] = useState('03:00 AM');

  // Hardcoded for now until Auth is implemented
  const DEFAULT_USER = 'user_123';

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

      // 1. Load Categories
      const allCats = await db.query.categories.findMany({
        where: eq(schema.categories.userId, DEFAULT_USER)
      });
      
      if (allCats.length === 0) {
        // Seed default categories if first run
        const defaults = [
          { id: '1', name: 'Food', tabContext: 'Daily' },
          { id: '2', name: 'Petrol', tabContext: 'Daily' },
          { id: '3', name: 'Material', tabContext: 'Daily' },
          { id: 'm1', name: 'Salary', tabContext: 'Monthly' },
          { id: 'm2', name: 'Rent', tabContext: 'Monthly' }
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
        setDailyCatsState(defaults.filter(d => d.tabContext === 'Daily').map(d => ({ id: d.id, name: d.name, isArchived: false })));
        setMonthlyCatsState(defaults.filter(d => d.tabContext === 'Monthly').map(d => ({ id: d.id, name: d.name, isArchived: false })));
      } else {
        setDailyCatsState(allCats.filter(c => c.tabContext === 'Daily').map(c => ({ id: c.id, name: c.name, isArchived: !!c.isArchived })));
        setMonthlyCatsState(allCats.filter(c => c.tabContext === 'Monthly').map(c => ({ id: c.id, name: c.name, isArchived: !!c.isArchived })));
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

      // 3. Load All Transactions and group them by Business Date
      const txs = await db.query.transactions.findMany({
        where: eq(schema.transactions.userId, DEFAULT_USER),
        orderBy: [desc(schema.transactions.createdAt)]
      });

      const groups: HistoryGroup[] = [];
      txs.forEach(t => {
        // Correctly calculate the Business Date label for the record
        const bDateForRecord = getBusinessDateString(t.createdAt);
        const groupLabel = `Business Date: ${bDateForRecord}`;
        
        const existing = groups.find(g => g.date === groupLabel);
        
        const entry: Entry = {
          id: t.id,
          category: t.categoryId || 'Other',
          amount: `${t.transactionType === 'expense' ? '-' : '+'}₹${t.amount.toLocaleString()}`,
          note: t.note || '',
          type: t.transactionType,
          period: t.trackingPeriod,
          createdAt: t.createdAt
        };

        if (existing) {
          existing.entries.push(entry);
        } else {
          groups.push({ date: groupLabel, entries: [entry] });
        }
      });
      setHistoryData(groups);

    } catch (e) {
      console.error("Critical DB Load Error:", e);
      // Fallback: If DB fails, we at least have an empty state
      setHistoryData([]);
    }
  };

  const getBusinessDateString = (overrideDate?: Date, overrideCutoff?: string) => {
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
    
    return businessDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const parseAmount = (str: string) => Number(str.replace(/[^0-9.]/g, '')) || 0;
  
  // High-performance dashboard calculations
  const todayLabel = `Business Date: ${getBusinessDateString()}`;
  const todayGroup = historyData.find(g => g.date === todayLabel);
  const todayEntries = todayGroup?.entries || [];

  const dailyIncome = todayEntries
    .filter(e => e.period === 'daily' && e.type === 'income')
    .reduce((acc, e) => acc + parseAmount(e.amount), 0);

  const dailyExpense = todayEntries
    .filter(e => e.period === 'daily' && e.type === 'expense')
    .reduce((acc, e) => acc + parseAmount(e.amount), 0);

  const flatEntries = historyData.reduce((acc, g) => acc.concat(g.entries || []), [] as Entry[]);

  const monthlyIncome = flatEntries
    .filter(e => e.period === 'monthly' && e.type === 'income')
    .reduce((acc, e) => acc + parseAmount(e.amount), 0);

  const monthlyExpense = flatEntries
    .filter(e => e.period === 'monthly' && e.type === 'expense')
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

  const setDailyCats = async (cats: any) => {
    // Note: We handle individual DB additions in the manage-categories screen for precision,
    // but we'll include a simple sync here as a fallback.
    setDailyCatsState(cats);
  };

  const setMonthlyCats = async (cats: any) => {
    setMonthlyCatsState(cats);
  };

  const persistCategory = async (name: string, tabContext: 'Daily' | 'Monthly') => {
    const id = Date.now().toString();
    await db.insert(schema.categories).values({
      id,
      userId: DEFAULT_USER,
      name,
      tabContext,
      isArchived: false
    });
    const newCat = { id, name, isArchived: false };
    if (tabContext === 'Daily') setDailyCatsState([...dailyCats, newCat]);
    else setMonthlyCatsState([...monthlyCats, newCat]);
  };

  const removeCategory = async (id: string, tabContext: 'Daily' | 'Monthly') => {
    await db.delete(schema.categories).where(eq(schema.categories.id, id));
    if (tabContext === 'Daily') setDailyCatsState(prev => prev.filter(c => c.id !== id));
    else setMonthlyCatsState(prev => prev.filter(c => c.id !== id));
  };

  const setCutoffTime = async (t: string) => {
    setCutoffTimeState(t);
    await db.update(schema.users)
      .set({ cutoffTime: t })
      .where(eq(schema.users.id, DEFAULT_USER));
  };

  const addTransaction = async (entry: Entry, rawAmount: number) => {
    try {
      // 1. Instant State Update (Optimistic UI)
      const bDate = getBusinessDateString();
      setHistoryData(prev => {
        const existingGroupIdx = prev.findIndex(g => g.date.includes(bDate));
        
        if (existingGroupIdx === -1) {
          return [{ date: `Business Date: ${bDate}`, entries: [entry] }, ...prev];
        }
        
        const newData = [...prev];
        const targetGroup = { ...newData[existingGroupIdx] };
        
        // If it's an upsert (e.g. Total Sale), replace the old entry in state
        const existingEntryIdx = targetGroup.entries.findIndex(e => e.id === entry.id);
        if (existingEntryIdx !== -1) {
          const newEntries = [...targetGroup.entries];
          newEntries[existingEntryIdx] = { ...entry, createdAt: new Date() };
          targetGroup.entries = newEntries;
        } else {
          targetGroup.entries = [{ ...entry, createdAt: new Date() }, ...targetGroup.entries];
        }
        
        newData[existingGroupIdx] = targetGroup;
        return newData;
      });

      // 2. Persistent Save (Upsert)
      await db.insert(schema.transactions).values({
        id: entry.id || `${Date.now()}-${Math.random()}`,
        userId: DEFAULT_USER,
        categoryId: entry.category,
        amount: rawAmount,
        transactionType: entry.type,
        trackingPeriod: entry.period,
        note: entry.note,
        createdAt: new Date()
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

  const exportDatabase = async () => {
    try {
      const dbPath = FileSystem.documentDirectory + 'SQLite/expense_tracker.db';
      const fileInfo = await FileSystem.getInfoAsync(dbPath);

      if (!fileInfo.exists) {
        Alert.alert("Error", "Database file not found. Make sure you have added some records first.");
        return;
      }

      // Ensure cache directory exists
      if (FileSystem.cacheDirectory) {
        await FileSystem.makeDirectoryAsync(FileSystem.cacheDirectory, { intermediates: true }).catch(() => {});
      }

      const backupFileName = `ExpenseTracker_Backup_${new Date().toISOString().split('T')[0]}.db`;
      const backupPath = (FileSystem.cacheDirectory || FileSystem.documentDirectory) + backupFileName;
      
      await FileSystem.copyAsync({
        from: dbPath,
        to: backupPath
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(backupPath, {
          mimeType: 'application/x-sqlite3',
          dialogTitle: 'Export Expense Tracker Data',
          UTI: 'public.database'
        });
      } else {
        Alert.alert("Error", "Sharing is not available on this device.");
      }
    } catch (e: any) {
      console.error("Export failed:", e);
      Alert.alert("Export Error", `Details: ${e.message || "Unknown error"}. Is the database busy?`);
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

  return (
    <GlobalContext.Provider value={{
      dailyIncome, dailyExpense,
      monthlyIncome, monthlyExpense,
      openingAmount, setOpeningAmount,
      closingBalance, setClosingBalance,
      historyData, setHistoryData,
      addTransaction,
      dailyCats, setDailyCats,
      monthlyCats, setMonthlyCats,
      cutoffTime, setCutoffTime,
      getBusinessDateString,
      updateTransaction, deleteTransaction,
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
