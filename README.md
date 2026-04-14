# Expense Tracker App (React Native Expo)

A premium, cross-platform financial tracking application designed for storefront cash drawer tracking and general expense accounting. Built with a modern, dynamic UX/UI and robust state synchronization.

## 🚀 Technical Stack
- **Framework:** React Native + Expo Router (v3)
- **Styling:** NativeWind (Tailwind CSS v4 Interop) + Standard Inline Styles for Stability
- **Icons:** Ionicons (`@expo/vector-icons`)
- **State Management:** Unified `GlobalProvider` (React Context) with cross-tab synchronization.

---

## 🏗️ Architecture & Component Overview

The application features a centralized state engine in `GlobalState.tsx` that ensures real-time updates across all navigation tabs.

| Route | Role / Features |
|---|---|
| `app/(tabs)/index.tsx` | **Live Dashboard:** Context-aware display of daily/monthly income and expenses. Features a **Cash Drawer** module with simplified calculation logic (`Sales = Closing - Opening`). |
| `app/(tabs)/daily.tsx` | **Daily Entry:** Rapid capture for cash/expense entries. Dynamically pulls category lists from global settings. Includes smart keyboard-aware layouts. |
| `app/(tabs)/monthly.tsx` | **Monthly Statements:** Statement overview focused on recurring bills and income. Fully synchronized with the global ledger. |
| `app/(tabs)/history.tsx` | **Analytics & Search:** Robust ledger with **Insensitive Fuzzy Search** (ignoring case and whitespace) and filtering by Category/Type. Includes direct entry editing. |
| `app/(tabs)/settings.tsx` | **App Control:** Manage custom business day cutoff times, export data simulations, and **Category Management** syncing. |
| `app/manage-categories.tsx` | **Database Settings:** Centralized panel to add/remove categories that instantly update the selector buttons on entry forms. |

---

## 🛠️ Key Product Features & UX Solves

- **Navigation Context Stability:** Bypasses NativeWind AST stringify crashes by utilizing stable inline styles for dynamic state transitions.
- **Smart Keyboard Positioning:** Uses grounded flex layouts instead of absolute positioning to ensure Android's native keyboard doesn't overlap inputs.
- **Strict Input Sanitization:** All currency inputs are strictly sanitized via regex to prevent invalid characters from entering the data layer.
- **Fuzzy Search:** The History tab uses a case-insensitive, trimmed search algorithm to find records across notes, categories, and amounts.

---

## 🔌 Scalability Blueprint

### Database Readiness
The app is architected to be **"Local-First"**. The `GlobalProvider` is structured to easily integrate a persistence layer using `expo-sqlite` and `drizzle-orm`.

### Backend Implementation Strategy
1. **Local Storage:** Use `expo-sqlite` for permanent on-device storage.
2. **Schema Migration:** Deploy the provided schema in `db/schema.ts` to transform the current `useState` ledger into a permanent relational database.
3. **Cloud Sync:** Implement `expo-file-system` for secure local-to-cloud backup exports (Google Drive/iCloud).

---

## ✒️ Attribution
**Developed By: Mubashir Zebi**
*Built with a focus on performance, stability, and premium design.*
