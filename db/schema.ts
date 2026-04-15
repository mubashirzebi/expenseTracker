import { integer, real, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

// --- USERS TABLE ---
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  businessName: text('business_name'),
  cutoffTime: text('cutoff_time').default('03:00 AM'),
  autoBackupTime: text('auto_backup_time').default('09:00 PM'),
  autoBackupEnabled: integer('auto_backup_enabled', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// --- CATEGORIES TABLE ---
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  tabContext: text('tab_context').notNull(), // 'Daily' or 'Monthly'
  isArchived: integer('is_archived', { mode: 'boolean' }).default(false),
});

// --- TRANSACTIONS TABLE ---
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  categoryId: text('category_id'), // can be null if generic "Total Sale"
  amount: real('amount').notNull(),
  transactionType: text('transaction_type').notNull(), // 'Income' or 'Expense'
  trackingPeriod: text('tracking_period').notNull(), // 'Daily' or 'Monthly'
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// --- CASH DRAWER LOGS ---
export const cashDrawerLogs = sqliteTable('cash_drawer_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  businessDate: text('business_date').notNull(), // e.g. YYYY-MM-DD string
  openingAmount: real('opening_amount'),
  closingBalance: real('closing_balance'),
  calculatedSales: real('calculated_sales'),
  isFinalized: integer('is_finalized', { mode: 'boolean' }).default(false),
}, (t) => ({
  unq: unique().on(t.userId, t.businessDate),
}));
