import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobalState } from '../context/GlobalState';

export default function MonthlyScreen() {
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + currentMonthIndex);
  const currentTitle = targetDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const amountRef = useRef<TextInput>(null);

  const { monthlyCats, addTransaction, historyData } = useGlobalState();

  const flatEntries = historyData.reduce((acc, g) => acc.concat(g.entries || []), [] as any[]);

  const monthEntries = flatEntries.filter(e => {
    const d = new Date(e.createdAt);
    return d.getMonth() === targetDate.getMonth() && d.getFullYear() === targetDate.getFullYear();
  });

  const parseAmount = (str: string) => Number(str.replace(/[^0-9.]/g, '')) || 0;

  const monthDailyIncome = monthEntries
    .filter(e => e.period === 'daily' && e.type === 'income')
    .reduce((acc, e) => acc + parseAmount(e.amount), 0);

  const monthDailyExpense = monthEntries
    .filter(e => e.period === 'daily' && e.type === 'expense')
    .reduce((acc, e) => acc + parseAmount(e.amount), 0);

  const monthMonthlyIncome = monthEntries
    .filter(e => e.period === 'monthly' && e.type === 'income')
    .reduce((acc, e) => acc + parseAmount(e.amount), 0);

  const monthMonthlyExpense = monthEntries
    .filter(e => e.period === 'monthly' && e.type === 'expense')
    .reduce((acc, e) => acc + parseAmount(e.amount), 0);

  const totalCombinedIncome = monthDailyIncome + monthMonthlyIncome;
  const totalExpenses = monthDailyExpense + monthMonthlyExpense;
  const netSavings = totalCombinedIncome - totalExpenses;

  // Form States (Analogous to Daily Tab)
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Rent');
  const [note, setNote] = useState('');

  // Status & UI States
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const categories = monthlyCats.filter(c => !c.isArchived).map(c => c.name);

  // Flattened classes for NativeWind V4 AST parser safety
  const isExp = type === 'expense';

  const handleSaveMonthly = () => {
    if (!amount) return;

    const saveEntry = async () => {
      try {
        const parsedAmount = Number(amount.replace(/[^0-9.]/g, ''));

        await addTransaction({
          id: Math.random().toString(),
          category: category,
          amount: `${isExp ? '-' : '+'}₹${parsedAmount.toLocaleString()}`,
          note: note || '',
          type: type,
          period: 'monthly',
          createdAt: new Date()
        }, parsedAmount);

        setIsSaving(false);
        setShowSuccess(true);
        setAmount('');
        setNote('');

        setTimeout(() => {
          setShowSuccess(false);
        }, 1500);
      } catch (e) {
        setIsSaving(false);
        Alert.alert("Error", "Could not save entry.");
      }
    };

    saveEntry();
  };

  return (
    <SafeAreaView className="flex-1 bg-bgLight">
      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-5 pt-4"
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ----- DASHBOARD TOP ----- */}
          <Text className="text-textMain text-2xl font-extrabold mb-4">Monthly Statements</Text>

          <View className="flex-row justify-between items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-100 mb-6">
            <Pressable onPress={() => setCurrentMonthIndex(-1)} className="p-2 active:bg-slate-50 rounded-lg">
              <Ionicons name="chevron-back" size={20} color={currentMonthIndex === -1 ? "#cbd5e1" : "#1e293b"} />
            </Pressable>
            <Text className="text-textMain font-bold text-lg">{currentTitle}</Text>
            <Pressable onPress={() => setCurrentMonthIndex(0)} className="p-2 active:bg-slate-50 rounded-lg">
              <Ionicons name="chevron-forward" size={20} color={currentMonthIndex === 0 ? "#cbd5e1" : "#1e293b"} />
            </Pressable>
          </View>

          <View className="bg-white rounded-3xl p-5 mb-8 shadow-sm border border-slate-100">
            <Text className="text-textMuted font-bold text-xs uppercase mb-4 text-center tracking-wider">Statement Summary</Text>

            <View className="flex-row justify-between mb-3">
              <Text className="text-textMuted font-medium">Daily Income</Text>
              <Text className="text-primary font-bold">+₹{monthDailyIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            </View>

            <View className="flex-row justify-between mb-3">
              <Text className="text-textMuted font-medium">Monthly Income</Text>
              <Text className="text-primary font-bold">+₹{monthMonthlyIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            </View>

            <View className="flex-row justify-between mb-3">
              <Text className="text-textMuted font-medium">Daily Expenses</Text>
              <Text className="text-danger font-bold">-₹{monthDailyExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            </View>

            <View className="flex-row justify-between mb-4 border-b border-slate-100 pb-4">
              <Text className="text-textMuted font-medium">Monthly Expenses</Text>
              <Text className="text-danger font-bold">-₹{monthMonthlyExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            </View>

            <View className="flex-row justify-between mb-3 pt-3 border-t border-slate-200">
              <Text className="text-textMain font-bold">Total Income</Text>
              <Text className="text-primary font-bold">+₹{totalCombinedIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            </View>

            <View className="flex-row justify-between mb-4">
              <Text className="text-textMain font-bold">Total Expenses</Text>
              <Text className="text-danger font-bold">-₹{totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            </View>

            <View className="flex-row justify-between items-center pt-3 border-t border-slate-200">
              <Text className="text-textMain font-extrabold text-lg">Net Savings</Text>
              <Text className={`font-extrabold text-xl ${netSavings >= 0 ? 'text-primary' : 'text-danger'}`}>
                {netSavings >= 0 ? '+' : '-'}₹{Math.abs(netSavings).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>

          {/* ----- LOG MONTHLY ITEM SECTION ----- */}
          <Text className="text-textMain text-xl font-extrabold mb-5 px-1">Log Monthly Item</Text>

          {/* Toggle Type */}
          <View className="flex-row bg-slate-200 rounded-xl p-1 mb-8">
            <Pressable
              onPress={() => { setType('expense'); setCategory('Rent'); }}
              className="flex-1 py-3 rounded-lg items-center"
              style={isExp ? { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 } : { backgroundColor: 'transparent' }}
            >
              <Text className="font-semibold" style={{ color: isExp ? '#ef4444' : '#64748b' }}>Add Bill</Text>
            </Pressable>
            <Pressable
              onPress={() => { setType('income'); setCategory('Salary'); }}
              className="flex-1 py-3 rounded-lg items-center"
              style={!isExp ? { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 } : { backgroundColor: 'transparent' }}
            >
              <Text className="font-semibold" style={{ color: !isExp ? '#10b981' : '#64748b' }}>Add Income</Text>
            </Pressable>
          </View>

          {/* Amount input block */}
          <View className="mb-10 w-full">
            <Pressable
              onPress={() => amountRef.current?.focus()}
              className="bg-white border border-slate-100 shadow-sm rounded-3xl w-full py-8 items-center justify-center active:bg-slate-50 transition-colors"
            >
              <Text className="text-textMuted font-bold text-xs uppercase tracking-wider mb-2 text-center">Entry Amount</Text>
              <View className="flex-row items-center justify-center">
                <Text className="text-4xl font-bold mr-1" style={{ color: isExp ? '#ef4444' : '#10b981' }}>₹</Text>
                <TextInput
                  ref={amountRef}
                  className="text-5xl font-extrabold outline-none"
                  style={{ color: isExp ? '#ef4444' : '#10b981', outlineStyle: 'none', minWidth: 60 } as any}
                  placeholderTextColor="#cbd5e1"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                  maxLength={8}
                />
              </View>
            </Pressable>
          </View>

          {/* Categories */}
          <Text className="text-textMuted font-bold text-xs uppercase mb-3 ml-1 tracking-wider">Classification</Text>
          <View className="flex-row flex-wrap gap-3 mb-6">
            {categories.map((cat) => {
              const isActive = category === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  className="px-4 py-3 rounded-full border-2"
                  style={{
                    backgroundColor: isActive ? (isExp ? '#fee2e2' : '#d1fae5') : 'white',
                    borderColor: isActive ? (isExp ? '#ef4444' : '#10b981') : '#e2e8f0',
                  }}
                >
                  <Text className="font-bold" style={{ color: isActive ? (isExp ? '#ef4444' : '#059669') : '#64748b' }}>{cat}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Note */}
          <View className="mb-24">
            <TextInput
              value={note}
              onChangeText={setNote}
              className="bg-white px-5 py-4 rounded-2xl text-textMain border border-slate-100 shadow-sm font-medium"
              placeholder="Recurring description (Optional)"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </ScrollView>

        {/* Save Button */}
        <View className="px-5 pb-6 pt-2">
          <Pressable
            onPress={handleSaveMonthly}
            disabled={isSaving}
            className="py-4 flex-row justify-center rounded-full shadow-lg items-center active:scale-95 transition-transform"
            style={{ backgroundColor: isExp ? '#ef4444' : '#10b981' }}
          >
            {isSaving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-lg">Commit to Ledger</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* -- Success Modal -- */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black px-5" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
          <View className="bg-white p-6 rounded-3xl items-center w-64 shadow-2xl">
            <View className="w-16 h-16 rounded-full bg-incomeLight items-center justify-center mb-4">
              <Ionicons name="documents-outline" size={32} color="#10b981" />
            </View>
            <Text className="text-xl font-extrabold text-textMain mb-1">Monthly Saved!</Text>
            <Text className="text-center text-textMuted font-medium text-sm">
              Applied to overall statement.
            </Text>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
