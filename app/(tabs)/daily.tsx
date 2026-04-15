import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobalState } from '../context/GlobalState';

export default function DailyScreen() {
  const { dailyCats, addTransaction } = useGlobalState();
  const amountRef = useRef<TextInput>(null);
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [note, setNote] = useState('');

  // Feedback States
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const categories = dailyCats.filter(c => !c.isArchived).map(c => c.name);

  const isExp = type === 'expense';

  const handleSaveEntry = () => {
    if (!amount) return; // Prevent empty saves

    const parsedAmount = Number(amount.replace(/[^0-9.]/g, ''));

    const saveEntry = async () => {
      setIsSaving(true);
      try {
        await addTransaction({
          id: Math.random().toString(),
          category: category,
          amount: `${isExp ? '-' : '+'}₹${parsedAmount.toLocaleString()}`,
          note: note || '',
          type: type,
          period: 'daily',
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
          className="flex-1 px-5 pt-6"
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Text className="text-textMain text-2xl font-extrabold mb-6 text-center">Quick Entry</Text>

          {/* Toggle Type */}
          <View className="flex-row bg-slate-200 rounded-xl p-1 mb-10">
            <Pressable
              onPress={() => { setType('expense'); setCategory('Food'); }}
              className="flex-1 py-3 rounded-lg items-center"
              style={isExp ? { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 } : { backgroundColor: 'transparent' }}
            >
              <Text className="font-semibold" style={{ color: isExp ? '#ef4444' : '#64748b' }}>Expense</Text>
            </Pressable>
            <TouchableOpacity
              onPress={() => { setType('income'); setCategory('Other'); }}
              className="flex-1 py-3 rounded-lg items-center"
              style={!isExp ? { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 } : { backgroundColor: 'transparent' }}
            >
              <Text className="font-semibold" style={{ color: !isExp ? '#10b981' : '#64748b' }}>Income</Text>
            </TouchableOpacity>
          </View>

          {/* Amount input */}
          <View className="mb-10 w-full">
            <Pressable
              onPress={() => amountRef.current?.focus()}
              className="bg-white border border-slate-100 shadow-sm rounded-3xl w-full py-8 items-center justify-center active:bg-slate-50 transition-colors"
            >
              <Text className="text-textMuted font-bold text-xs uppercase tracking-wider mb-2">Entry Amount</Text>
              <View className="flex-row items-center justify-center">
                <Text className="text-4xl font-bold mr-1" style={{ color: isExp ? '#ef4444' : '#10b981' }}>₹</Text>
                <TextInput
                  ref={amountRef}
                  className="text-5xl font-extrabold outline-none"
                  style={{ color: isExp ? '#ef4444' : '#10b981', outlineStyle: 'none', minWidth: 60 } as any}
                  placeholder="0"
                  placeholderTextColor="#cbd5e1"
                  keyboardType="numeric"
                  autoFocus
                  value={amount}
                  onChangeText={setAmount}
                  maxLength={8}
                />
              </View>
            </Pressable>
          </View>

          {/* Categories */}
          <Text className="text-textMain font-bold mb-3 mt-2">Category</Text>
          <View className="flex-row flex-wrap gap-3 mb-6">
            {categories.map((cat) => {
              // Pre-calculate to avoid Nested Ternary compiler crashes in NativeWind
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
          <View>
            <TextInput
              value={note}
              onChangeText={setNote}
              className="bg-white px-5 py-4 rounded-2xl text-textMain border border-slate-100 shadow-sm font-medium"
              placeholder="Add Note (Optional)"
              placeholderTextColor="#94a3b8"
            />
          </View>
        </ScrollView>

        {/* Save Button */}
        <View className="px-5 pb-6 pt-2">
          <Pressable
            onPress={handleSaveEntry}
            disabled={isSaving}
            className="py-4 flex-row justify-center rounded-full shadow-lg items-center active:scale-95 transition-transform"
            style={{ backgroundColor: isExp ? '#ef4444' : '#10b981' }}
          >
            {isSaving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-lg">Save Entry</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* -- Success Modal -- */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/60 px-5">
          <View className="bg-white p-6 rounded-3xl items-center w-64 shadow-2xl">
            <View className="w-16 h-16 rounded-full bg-incomeLight items-center justify-center mb-4">
              <Ionicons name="checkmark" size={36} color="#10b981" />
            </View>
            <Text className="text-xl font-extrabold text-textMain mb-1">Logged!</Text>
            <Text className="text-center text-textMuted font-medium text-sm">
              Entry safely saved.
            </Text>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
