import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

// 1. Physically open or create the SQLite database embedded on the phone
export const expoDb = SQLite.openDatabaseSync('expense_tracker.db', { enableChangeListener: true });

// 2. Wrap the physical databse connection with our Drizzle ORM Type Schemas
// This allows us to use robust Typescript commands instead of raw SQL strings!
export const db = drizzle(expoDb, { schema });
