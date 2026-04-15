import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGlobalState } from '../context/GlobalState';

export default function HistoryScreen() {
  const {
    historyData,
    setHistoryData,
    dailyCats,
    monthlyCats,
    updateTransaction,
    deleteTransaction
  } = useGlobalState();

  const [activeRange, setActiveRange] = useState('All Time');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeType, setActiveType] = useState('Both');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state for Dropdowns
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);

  const ranges = ['All Time', 'This Week', 'This Month', 'Last 6 Months', 'Last 1 Year', 'Custom Range...'];
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState<'start' | 'end' | null>(null);

  // Collect ALL categories that exist in history to ensure archived ones can still be filtered
  const historyCats = [
    ...new Set(
      historyData.flatMap(g => g.entries.map(e => e.category))
    )
  ].sort();
  
  const categories = ['All', ...historyCats];
  const types = ['Both', 'Income', 'Expense'];

  // Edit State
  const [editModal, setEditModal] = useState<{ groupIdx: number, entryIdx: number, title: string, type: string } | null>(null);
  const [tempValue, setTempValue] = useState('');

  const handleEditSave = () => {
    if (editModal && tempValue) {
      const newData = [...historyData];

      // Clean whatever they typed into a pure number
      let cleanVal = Number(tempValue.replace(/[^0-9.]/g, ''));
      if (isNaN(cleanVal) || cleanVal === 0) cleanVal = 0;

      const prefix = editModal.type === 'expense' ? '-₹' : '+₹';

      // Strict-mode React Native Deep Copy
      const targetGroup = { ...newData[editModal.groupIdx] };
      const targetEntries = [...targetGroup.entries];
      const targetEntry = { ...targetEntries[editModal.entryIdx] };

      targetEntry.amount = `${prefix}${cleanVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

      targetEntries[editModal.entryIdx] = targetEntry;
      targetGroup.entries = targetEntries;
      newData[editModal.groupIdx] = targetGroup;

      setHistoryData(newData);

      // Update Database
      updateTransaction(targetEntry.id, { amount: cleanVal });
    }
    setEditModal(null);
    setTempValue('');
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      "Delete Transaction",
      "Are you sure you want to permanently remove this entry?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteTransaction(id)
        }
      ]
    );
  };

  const getRangeDates = () => {
    const end = new Date();
    const start = new Date();

    if (activeRange === 'All Time') {
      start.setFullYear(2000);
    } else if (activeRange === 'This Week') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
    } else if (activeRange === 'This Month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else if (activeRange === 'Last 6 Months') {
      start.setMonth(start.getMonth() - 6);
    } else if (activeRange === 'Last 1 Year') {
      start.setFullYear(start.getFullYear() - 1);
    } else if (activeRange === 'Custom Range...' && customStartDate && customEndDate) {
      return { start: customStartDate, end: customEndDate };
    } else {
      // Fallback to a very old date if no filter
      start.setFullYear(2000);
    }

    // Set end date to end of day to include all transactions for today
    end.setHours(23, 59, 59, 999);

    return { start, end };
  };

  const { start: rangeStart, end: rangeEnd } = getRangeDates();

  const isWithinRange = (date: any) => {
    const d = date instanceof Date ? date : new Date(date);
    // Compare full timestamps to include time-based filtering
    return d >= rangeStart && d <= rangeEnd;
  };

  const parseAmount = (str: string) => Number(str.replace(/[^0-9.]/g, '')) || 0;

  // Dynamic Analysis Math based on current state (mock logic)
  let visibleTotal = 0;
  historyData.forEach(group => {
    group.entries.forEach(entry => {
      if (activeCategory !== 'All' && entry.category !== activeCategory) return;
      if (activeType !== 'Both' && entry.type.toLowerCase() !== activeType.toLowerCase()) return;
      if (!isWithinRange(entry.createdAt)) return;

      const query = searchQuery.trim().toLowerCase();
      const matchesSearch = !query ||
        entry.category.toLowerCase().includes(query) ||
        (entry.note && entry.note.toLowerCase().includes(query)) ||
        entry.amount.toLowerCase().includes(query);

      if (!matchesSearch) return;

      const val = parseAmount(entry.amount);
      if (entry.type === 'expense') visibleTotal -= val;
      else visibleTotal += val;
    });
  });

  const isLocked = (date: any) => {
    if (!date) return false;
    const d = date instanceof Date ? date : new Date(date);
    return (Date.now() - d.getTime()) > 14 * 24 * 60 * 60 * 1000;
  };

  // Format date for display
  const formatDate = (date: any) => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  const formatTime = (date: any) => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const onChangeDate = (event: any, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
      setShowPicker(null);
      return;
    }

    if (showPicker === 'start' && selectedDate) {
      setCustomStartDate(selectedDate);
      setShowPicker('end'); // Immediately show end picker
    } else if (showPicker === 'end' && selectedDate) {
      setCustomEndDate(selectedDate);
      setShowPicker(null);
      setActiveRange('Custom Range...');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bgLight">
      {/* Header and Search */}
      <View className="px-4 pt-4 pb-3 bg-white shadow-sm border-b border-slate-100 z-10">
        <Text className="text-textMain text-2xl font-extrabold mb-4 px-1">Transaction History</Text>

        <View className="flex-row items-center bg-slate-100 px-4 py-3 rounded-full mb-4">
          <Ionicons name="search" size={20} color="#94a3b8" />
          <TextInput
            placeholder="Search notes, categories, or amounts..."
            className="flex-1 ml-2 font-medium text-textMain"
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Dynamic Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-1 pt-1 pb-2" contentContainerStyle={{ paddingRight: 20 }}>
          {/* Date Range Picker Trigger */}
          <Pressable
            onPress={() => setShowRangeDropdown(true)}
            className="flex-row items-center bg-incomeLight px-4 py-2 rounded-full mr-2 border border-incomeLight"
          >
            <Ionicons name="calendar" size={16} color="#059669" />
            <Text className="text-primaryDark font-bold ml-2">
              {activeRange === 'Custom Range...' && customStartDate
                ? `${formatDate(customStartDate)} - ${customEndDate ? formatDate(customEndDate) : '...'}`
                : activeRange}
            </Text>
            <Ionicons name="chevron-down" size={14} color="#059669" className="ml-1" />
          </Pressable>

          {/* Type Dropdown Trigger */}
          <Pressable
            onPress={() => setShowTypeDropdown(true)}
            className="bg-slate-100 flex-row items-center px-4 py-2 rounded-full mr-2 border border-slate-200"
          >
            <Text className="text-textMain font-bold mr-1">Type: {activeType}</Text>
            <Ionicons name="chevron-down" size={14} color="#64748b" />
          </Pressable>

          {/* Category Dropdown Trigger */}
          <Pressable
            onPress={() => setShowCategoryDropdown(true)}
            className="bg-slate-100 flex-row items-center px-4 py-2 rounded-full mr-4 border border-slate-200"
          >
            <Text className="text-textMain font-bold mr-1">Cat: {activeCategory}</Text>
            <Ionicons name="chevron-down" size={14} color="#64748b" />
          </Pressable>
        </ScrollView>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="pt-4 pb-20 px-5">

          {/* Quick Analysis Overview */}
          <View className="bg-primaryDark rounded-2xl p-4 mb-6 shadow-sm flex-row items-center justify-between">
            <View>
              <Text className="text-white text-xs font-semibold uppercase mb-1">Total Funds</Text>
              <Text className="text-white text-2xl font-extrabold pb-0">
                {visibleTotal < 0 ? '-' : ''}₹{Math.abs(visibleTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View className="bg-white px-3 py-2 rounded-lg opacity-80">
              <Ionicons name="stats-chart" size={24} color="white" />
            </View>
          </View>

          {historyData.length === 0 ? (
            <View className="items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
              <Ionicons name="receipt-outline" size={64} color="#cbd5e1" />
              <Text className="text-textMuted font-bold text-lg mt-4">No Transactions Yet</Text>
              <Text className="text-slate-400 text-sm mt-1">Your ledger will appear here</Text>
            </View>
          ) : (
            historyData.map((group, groupIndex) => (
              <View key={groupIndex} className="mb-6">
                <Text className="text-textMuted font-bold text-sm mb-3 ml-1">{group.date}</Text>

                <View className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm">
                  {group.entries.map((entry, entryIndex) => {
                    if (activeCategory !== 'All' && entry.category !== activeCategory) return null;
                    if (activeType !== 'Both' && entry.type.toLowerCase() !== activeType.toLowerCase()) return null;
                    if (!isWithinRange(entry.createdAt)) return null;

                    const query = searchQuery.trim().toLowerCase();
                    const matchesSearch = !query ||
                      entry.category.toLowerCase().includes(query) ||
                      (entry.note && entry.note.toLowerCase().includes(query)) ||
                      entry.amount.toLowerCase().includes(query);

                    if (!matchesSearch) return null;

                    return (
                      <Pressable
                        key={entry.id}
                        onPress={() => {
                          if (isLocked(entry.createdAt)) {
                            Alert.alert("Locked Record", "This transaction is from more than 14 days ago and cannot be modified.");
                            return;
                          }
                          const numStr = entry.amount.replace(/[^0-9.]/g, '');
                          setTempValue(numStr);
                          setEditModal({ groupIdx: groupIndex, entryIdx: entryIndex, title: entry.category, type: entry.type });
                        }}
                        className="flex-row justify-between items-center px-5 py-4 active:bg-slate-50"
                        style={[
                          entryIndex !== group.entries.length - 1 ? { borderBottomWidth: 1, borderBottomColor: '#f8fafc' } : {},
                          isLocked(entry.createdAt) ? { opacity: 0.8 } : {}
                        ]}
                      >
                        <View className="flex-row items-center flex-1">
                          <View className="w-10 h-10 rounded-full justify-center items-center mr-4" style={{ backgroundColor: entry.type === 'expense' ? '#fee2e2' : '#d1fae5' }}>
                            <Ionicons
                              name={entry.type === 'expense' ? 'trending-down' : 'trending-up'}
                              size={18}
                              color={entry.type === 'expense' ? '#ef4444' : '#10b981'}
                            />
                          </View>
                          <View className="flex-1">
                            <View className="flex-row items-center">
                              <Text className="text-textMain font-bold text-base">{entry.category}</Text>
                              {isLocked(entry.createdAt) && (
                                <Ionicons name="lock-closed" size={12} color="#94a3b8" style={{ marginLeft: 6 }} />
                              )}
                            </View>
                            {entry.note ? (
                              <Text className="text-textMuted text-xs font-medium">{entry.note}</Text>
                            ) : null}
                            <Text className="text-textMuted text-[10px] font-bold mt-1 uppercase tracking-tighter">
                              {entry.period} • {formatDate(entry.createdAt)} • {formatTime(entry.createdAt)}
                            </Text>
                          </View>
                        </View>

                        <View className="flex-row items-center">
                          <Text className="font-bold text-base mr-3" style={{ color: entry.type === 'expense' ? '#1e293b' : '#059669' }}>
                            {entry.amount}
                          </Text>
                          {!isLocked(entry.createdAt) && (
                            <Pressable
                              hitSlop={10}
                              onPress={() => handleDelete(entry.id)}
                              className="p-1"
                            >
                              <Ionicons name="trash-outline" size={18} color="#ef4444" />
                            </Pressable>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* --- MODELS --- */}

      {/* Date Range Selection Modal */}
      <Modal visible={showRangeDropdown} transparent animationType="fade">
        <Pressable className="flex-1 bg-black justify-center items-center opacity-90" onPress={() => setShowRangeDropdown(false)}>
          <View className="bg-white w-3/4 rounded-3xl overflow-hidden p-2 shadow-lg">
            <Text className="text-center font-bold text-textMuted py-3 border-b border-slate-100 mb-2">Select Date Range</Text>
            {ranges.map(r => (
              <Pressable
                key={r}
                onPress={() => {
                  if (r === 'Custom Range...') {
                    setShowRangeDropdown(false);
                    setShowPicker('start');
                  } else {
                    setActiveRange(r);
                    setShowRangeDropdown(false);
                  }
                }}
                className="py-4 px-4 rounded-xl mb-1"
                style={activeRange === r ? { backgroundColor: '#d1fae5' } : {}}
              >
                <Text className="text-center font-bold text-lg" style={{ color: activeRange === r ? '#059669' : '#1e293b' }}>{r}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* --- DATE PICKERS --- */}
      {showPicker === 'start' && (
        <DateTimePicker
          value={customStartDate || new Date()}
          mode="date"
          display="default"
          onChange={onChangeDate}
          maximumDate={new Date()}
        />
      )}
      {showPicker === 'end' && (
        <DateTimePicker
          value={customEndDate || new Date()}
          mode="date"
          display="default"
          onChange={onChangeDate}
          minimumDate={customStartDate || undefined}
          maximumDate={new Date()}
        />
      )}

      {/* Type Selection Modal */}
      <Modal visible={showTypeDropdown} transparent animationType="fade">
        <Pressable className="flex-1 bg-black justify-center items-center opacity-90" onPress={() => setShowTypeDropdown(false)}>
          <View className="bg-white w-2/3 rounded-3xl overflow-hidden p-2 shadow-lg">
            <Text className="text-center font-bold text-textMuted py-3 border-b border-slate-100 mb-2">Select Type</Text>
            {types.map(t => (
              <Pressable
                key={t}
                onPress={() => { setActiveType(t); setShowTypeDropdown(false); }}
                className="py-4 px-4 rounded-xl"
                style={activeType === t ? { backgroundColor: '#d1fae5' } : {}}
              >
                <Text className="text-center font-bold text-lg" style={{ color: activeType === t ? '#059669' : '#1e293b' }}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Category Selection Modal */}
      <Modal visible={showCategoryDropdown} transparent animationType="fade">
        <Pressable className="flex-1 bg-black justify-center items-center opacity-90" onPress={() => setShowCategoryDropdown(false)}>
          <View className="bg-white w-3/4 max-h-[70%] rounded-3xl overflow-hidden p-2 shadow-lg">
            <Text className="text-center font-bold text-textMuted py-3 border-b border-slate-100 mb-2">Select Category</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {categories.map(c => (
                <Pressable
                  key={c}
                  onPress={() => { setActiveCategory(c); setShowCategoryDropdown(false); }}
                  className="py-4 px-4 rounded-xl mb-1"
                  style={activeCategory === c ? { backgroundColor: '#d1fae5' } : {}}
                >
                  <Text className="text-center font-bold text-lg" style={{ color: activeCategory === c ? '#059669' : '#1e293b' }}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Generic Edit Value Modal */}
      <Modal visible={!!editModal} transparent animationType="fade">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View className="flex-1 justify-center items-center px-5" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
            <View className="bg-white p-6 rounded-3xl items-center w-full shadow-2xl">
              <Text className="text-xl font-extrabold text-textMain mb-4">Edit {editModal?.title} Entry</Text>

              <View className="flex-row items-center border border-slate-200 rounded-2xl px-4 py-3 mb-6 bg-slate-50 w-full">
                <Text className="text-xl font-bold mr-2" style={{ color: editModal?.type === 'expense' ? '#ef4444' : '#10b981' }}>
                  {editModal?.type === 'expense' ? '-₹' : '+₹'}
                </Text>
                <TextInput
                  value={tempValue}
                  onChangeText={setTempValue}
                  keyboardType="numeric"
                  autoFocus
                  className="flex-1 text-xl font-bold text-textMain text-center pr-6" // pr-6 balances visual center
                />
              </View>

              <View className="flex-row w-full gap-3">
                <Pressable onPress={() => { setEditModal(null); setTempValue(''); }} className="flex-1 bg-slate-100 py-4 rounded-xl items-center">
                  <Text className="text-textMain font-bold">Cancel</Text>
                </Pressable>
                <Pressable onPress={handleEditSave} className="flex-1 bg-primaryDark py-4 rounded-xl items-center shadow-sm">
                  <Text className="text-white font-bold">Save Changes</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}
