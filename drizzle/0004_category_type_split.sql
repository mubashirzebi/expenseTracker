-- Migrate existing categories to split income/expense tab contexts
-- 'Daily' → 'Daily_Expense' (existing daily cats were expense-oriented)
-- 'Monthly' → 'Monthly_Expense' (existing monthly cats were expense-oriented)
UPDATE `categories` SET `tab_context` = 'Daily_Expense' WHERE `tab_context` = 'Daily';
UPDATE `categories` SET `tab_context` = 'Monthly_Expense' WHERE `tab_context` = 'Monthly';
