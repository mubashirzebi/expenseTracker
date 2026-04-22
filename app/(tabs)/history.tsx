import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type FetchTransactionsParams, type HistoryGroup, useGlobalState } from '../context/GlobalState';

const PAGE_SIZE = 15;

export default function HistoryScreen() {
  const { fetchTransactions, updateTransaction, deleteTransaction, onTransactionAdded, offTransactionAdded, getBusinessDateString } = useGlobalState();

  // --- Filter state ---
  const [activeRange, setActiveRange] = useState('All Time');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeType, setActiveType] = useState('Both');
  const [searchQuery, setSearchQuery] = useState('');

  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);

  const ranges = ['All Time', 'This Week', 'This Month', 'Last 6 Months', 'Last 1 Year', 'Custom Range...'];
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState<'start' | 'end' | null>(null);

  // --- Pagination & data state ---
  const [groups, setGroups] = useState<HistoryGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // All categories seen in current result set (for filter dropdown)
  const [knownCategories, setKnownCategories] = useState<string[]>([]);

  // --- Edit state ---
  const [editModal, setEditModal] = useState<{
    id: string; groupIdx: number; entryIdx: number; title: string; type: string;
  } | null>(null);
  const [tempValue, setTempValue] = useState('');

  // Debounce search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Build query params from current filter state ---
  const buildParams = useCallback((currentOffset: number): FetchTransactionsParams => {
    const { start, end } = getRangeDates();
    return {
      startDate: start,
      endDate: end,
      type: activeType === 'Both' ? undefined : (activeType.toLowerCase() as 'income' | 'expense'),
      category: activeCategory === 'All' ? undefined : activeCategory,
      searchQuery: searchQuery.trim() || undefined,
      limit: PAGE_SIZE,
      offset: currentOffset,
    };
  }, [activeRange, activeCategory, activeType, searchQuery, customStartDate, customEndDate]);

  // --- Initial / filter-change load ---
  const loadPage = useCallback(async (resetOffset = true) => {
    setIsLoading(true);
    const currentOffset = resetOffset ? 0 : offset;
    const result = await fetchTransactions(buildParams(currentOffset));

    if (resetOffset) {
      setGroups(result.groups);
      setOffset(PAGE_SIZE);
      // Collect all categories from this result for the filter dropdown
      const cats = [...new Set(result.groups.flatMap(g => g.entries.map(e => e.category)))].sort();
      setKnownCategories(cats);
    }
    setTotal(result.total);
    setHasMore(result.hasMore);
    setIsLoading(false);
  }, [buildParams, fetchTransactions]);

  // --- Load more (append) ---
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    const result = await fetchTransactions(buildParams(offset));
    setGroups(prev => {
      // Merge new groups into existing ones
      const merged = [...prev];
      result.groups.forEach(newGroup => {
        const existing = merged.find(g => g.date === newGroup.date);
        if (existing) {
          existing.entries.push(...newGroup.entries);
        } else {
          merged.push(newGroup);
        }
      });
      return merged;
    });
    setOffset(prev => prev + PAGE_SIZE);
    setHasMore(result.hasMore);
    setIsLoadingMore(false);
  }, [hasMore, isLoadingMore, offset, buildParams, fetchTransactions]);

  // Reload when filters change
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadPage(true), 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [activeRange, activeCategory, activeType, searchQuery, customStartDate, customEndDate]);

  // Initial load on mount
  useEffect(() => {
    if (isInitialLoad) {
      loadPage(true);
      setIsInitialLoad(false);
    }
  }, []);

  // Subscribe to new transactions for optimistic updates
  useEffect(() => {
    const handleNewTransaction = (entry: any) => {
      // Add to the top of the list optimistically
      const bDateStr = getBusinessDateString(entry.createdAt);
      const groupLabel = `Business Date: ${bDateStr}`;

      setGroups(prev => {
        const existingGroupIdx = prev.findIndex(g => g.date === groupLabel);
        if (existingGroupIdx === -1) {
          // New group at the top
          return [{ date: groupLabel, entries: [entry] }, ...prev];
        }
        // Add to existing group
        const newGroups = [...prev];
        const targetGroup = { ...newGroups[existingGroupIdx] };
        // Check if entry already exists (upsert case)
        const existingEntryIdx = targetGroup.entries.findIndex(e => e.id === entry.id);
        if (existingEntryIdx !== -1) {
          targetGroup.entries = [...targetGroup.entries];
          targetGroup.entries[existingEntryIdx] = entry;
        } else {
          targetGroup.entries = [entry, ...targetGroup.entries];
        }
        newGroups[existingGroupIdx] = targetGroup;
        return newGroups;
      });
      setTotal(prev => prev + 1);
    };

    onTransactionAdded(handleNewTransaction);
    return () => offTransactionAdded(handleNewTransaction);
  }, [onTransactionAdded, offTransactionAdded, getBusinessDateString]);

  // --- Date range helpers ---
  const getRangeDates = (): { start: Date; end: Date } => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();

    if (activeRange === 'All Time') {
      start.setFullYear(2000);
    } else if (activeRange === 'This Week') {
      const day = start.getDay();
      start.setDate(start.getDate() - day + (day === 0 ? -6 : 1));
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
      start.setFullYear(2000);
    }
    return { start, end };
  };

  const onChangeDate = (event: any, selectedDate?: Date) => {
    if (event.type === 'dismissed') { setShowPicker(null); return; }
    if (showPicker === 'start' && selectedDate) {
      setCustomStartDate(selectedDate);
      setShowPicker('end');
    } else if (showPicker === 'end' && selectedDate) {
      setCustomEndDate(selectedDate);
      setShowPicker(null);
      setActiveRange('Custom Range...');
    }
  };

  // --- Edit / Delete ---
  const handleEditSave = () => {
    if (!editModal || !tempValue) { setEditModal(null); return; }
    const cleanVal = Number(tempValue.replace(/[^0-9.]/g, '')) || 0;
    const prefix = editModal.type === 'expense' ? '-₹' : '+₹';

    setGroups(prev => prev.map((group, gi) => {
      if (gi !== editModal.groupIdx) return group;
      return {
        ...group,
        entries: group.entries.map((e, ei) => {
          if (ei !== editModal.entryIdx) return e;
          return { ...e, amount: `${prefix}${cleanVal.toLocaleString(undefined, { minimumFractionDigits: 2 })}` };
        }),
      };
    }));
    updateTransaction(editModal.id, { amount: cleanVal });
    setEditModal(null);
    setTempValue('');
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Transaction', 'Permanently remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          deleteTransaction(id);
          setGroups(prev =>
            prev.map(g => ({ ...g, entries: g.entries.filter(e => e.id !== id) }))
              .filter(g => g.entries.length > 0)
          );
        },
      },
    ]);
  };

  const isLocked = (date: any) => {
    const d = date instanceof Date ? date : new Date(date);
    return (Date.now() - d.getTime()) > 14 * 24 * 60 * 60 * 1000;
  };

  const formatDate = (date: any) => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  const formatTime = (date: any) => {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Visible total from current loaded groups
  const parseAmount = (str: string) => Number(str.replace(/[^0-9.]/g, '')) || 0;
  let visibleTotal = 0;
  groups.forEach(g => g.entries.forEach(e => {
    visibleTotal += e.type === 'expense' ? -parseAmount(e.amount) : parseAmount(e.amount);
  }));

  const categories = ['All', ...knownCategories];
  const types = ['Both', 'Income', 'Expense'];

  return (
    <SafeAreaView className="flex-1 bg-bgLight">
      {/* Header */}
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
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </Pressable>
          )}
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-1 pt-1 pb-2" contentContainerStyle={{ paddingRight: 20 }}>
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
            <Ionicons name="chevron-down" size={14} color="#059669" style={{ marginLeft: 4 }} />
          </Pressable>

          <Pressable
            onPress={() => setShowTypeDropdown(true)}
            className="bg-slate-100 flex-row items-center px-4 py-2 rounded-full mr-2 border border-slate-200"
          >
            <Text className="text-textMain font-bold mr-1">Type: {activeType}</Text>
            <Ionicons name="chevron-down" size={14} color="#64748b" />
          </Pressable>

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

          {/* Summary bar */}
          <View className="bg-primaryDark rounded-2xl p-4 mb-6 shadow-sm flex-row items-center justify-between">
            <View>
              <Text className="text-white text-xs font-semibold uppercase mb-1">
                {total > 0 ? `Showing ${Math.min(offset, total)} of ${total}` : 'No results'}
              </Text>
              <Text className="text-white text-2xl font-extrabold">
                {visibleTotal < 0 ? '-' : ''}₹{Math.abs(visibleTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <View className="bg-white/20 px-3 py-2 rounded-lg">
              <Ionicons name="stats-chart" size={24} color="white" />
            </View>
          </View>

          {/* Loading state */}
          {isLoading ? (
            <View className="items-center py-20">
              <ActivityIndicator size="large" color="#10b981" />
              <Text className="text-textMuted font-medium mt-3">Loading transactions...</Text>
            </View>
          ) : groups.length === 0 ? (
            <View className="items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
              <Ionicons name="receipt-outline" size={64} color="#cbd5e1" />
              <Text className="text-textMuted font-bold text-lg mt-4">No Transactions Found</Text>
              <Text className="text-slate-400 text-sm mt-1">Try adjusting your filters</Text>
            </View>
          ) : (
            <>
              {groups.map((group, groupIndex) => (
                <View key={group.date} className="mb-6">
                  <Text className="text-textMuted font-bold text-sm mb-3 ml-1">{group.date}</Text>
                  <View className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm">
                    {group.entries.map((entry, entryIndex) => (
                      <Pressable
                        key={entry.id}
                        onPress={() => {
                          if (isLocked(entry.createdAt)) {
                            Alert.alert('Locked Record', 'This transaction is older than 14 days and cannot be modified.');
                            return;
                          }
                          setTempValue(entry.amount.replace(/[^0-9.]/g, ''));
                          setEditModal({ id: entry.id, groupIdx: groupIndex, entryIdx: entryIndex, title: entry.category, type: entry.type });
                        }}
                        className="flex-row justify-between items-center px-5 py-4 active:bg-slate-50"
                        style={[
                          entryIndex !== group.entries.length - 1 ? { borderBottomWidth: 1, borderBottomColor: '#f8fafc' } : {},
                          isLocked(entry.createdAt) ? { opacity: 0.8 } : {},
                        ]}
                      >
                        <View className="flex-row items-center flex-1">
                          <View
                            className="w-10 h-10 rounded-full justify-center items-center mr-4"
                            style={{ backgroundColor: entry.type === 'expense' ? '#fee2e2' : '#d1fae5' }}
                          >
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
                            {entry.note ? <Text className="text-textMuted text-xs font-medium">{entry.note}</Text> : null}
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
                            <Pressable hitSlop={10} onPress={() => handleDelete(entry.id)} className="p-1">
                              <Ionicons name="trash-outline" size={18} color="#ef4444" />
                            </Pressable>
                          )}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}

              {/* Load More */}
              {hasMore && (
                <Pressable
                  onPress={loadMore}
                  disabled={isLoadingMore}
                  className="bg-white border border-slate-200 py-4 rounded-2xl items-center mb-4 shadow-sm active:bg-slate-50"
                >
                  {isLoadingMore ? (
                    <ActivityIndicator size="small" color="#10b981" />
                  ) : (
                    <View className="flex-row items-center">
                      <Ionicons name="chevron-down" size={18} color="#10b981" />
                      <Text className="text-primaryDark font-bold ml-2">Load More ({total - offset} remaining)</Text>
                    </View>
                  )}
                </Pressable>
              )}

              {!hasMore && groups.length > 0 && (
                <Text className="text-center text-slate-400 text-xs font-bold uppercase tracking-widest py-4">
                  All {total} transactions loaded
                </Text>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* --- Modals --- */}

      {/* Date Range */}
      <Modal visible={showRangeDropdown} transparent animationType="fade">
        <Pressable className="flex-1 justify-center items-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setShowRangeDropdown(false)}>
          <View className="bg-white w-3/4 rounded-3xl overflow-hidden p-2 shadow-lg">
            <Text className="text-center font-bold text-textMuted py-3 border-b border-slate-100 mb-2">Select Date Range</Text>
            {ranges.map(r => (
              <Pressable
                key={r}
                onPress={() => {
                  if (r === 'Custom Range...') { setShowRangeDropdown(false); setShowPicker('start'); }
                  else { setActiveRange(r); setShowRangeDropdown(false); }
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

      {/* Date Pickers */}
      {showPicker === 'start' && (
        <DateTimePicker value={customStartDate || new Date()} mode="date" display="default" onChange={onChangeDate} maximumDate={new Date()} />
      )}
      {showPicker === 'end' && (
        <DateTimePicker value={customEndDate || new Date()} mode="date" display="default" onChange={onChangeDate} minimumDate={customStartDate || undefined} maximumDate={new Date()} />
      )}

      {/* Type */}
      <Modal visible={showTypeDropdown} transparent animationType="fade">
        <Pressable className="flex-1 justify-center items-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setShowTypeDropdown(false)}>
          <View className="bg-white w-2/3 rounded-3xl overflow-hidden p-2 shadow-lg">
            <Text className="text-center font-bold text-textMuted py-3 border-b border-slate-100 mb-2">Select Type</Text>
            {types.map(t => (
              <Pressable key={t} onPress={() => { setActiveType(t); setShowTypeDropdown(false); }} className="py-4 px-4 rounded-xl" style={activeType === t ? { backgroundColor: '#d1fae5' } : {}}>
                <Text className="text-center font-bold text-lg" style={{ color: activeType === t ? '#059669' : '#1e293b' }}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Category */}
      <Modal visible={showCategoryDropdown} transparent animationType="fade">
        <Pressable className="flex-1 justify-center items-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setShowCategoryDropdown(false)}>
          <View className="bg-white w-3/4 rounded-3xl overflow-hidden p-2 shadow-lg" style={{ maxHeight: '70%' }}>
            <Text className="text-center font-bold text-textMuted py-3 border-b border-slate-100 mb-2">Select Category</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {categories.map(c => (
                <Pressable key={c} onPress={() => { setActiveCategory(c); setShowCategoryDropdown(false); }} className="py-4 px-4 rounded-xl mb-1" style={activeCategory === c ? { backgroundColor: '#d1fae5' } : {}}>
                  <Text className="text-center font-bold text-lg" style={{ color: activeCategory === c ? '#059669' : '#1e293b' }}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Edit Modal */}
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
                  className="flex-1 text-xl font-bold text-textMain text-center"
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
