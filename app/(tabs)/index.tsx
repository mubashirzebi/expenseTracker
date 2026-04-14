import { View, Text, Pressable, ScrollView, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useGlobalState } from '../context/GlobalState';

export default function HomeScreen() {
  const { 
     dailyIncome,
     dailyExpense,
     monthlyIncome,
     monthlyExpense,
     openingAmount, setOpeningAmount,
     closingBalance, setClosingBalance,
     addTransaction,
     getBusinessDateString
  } = useGlobalState();

  // Modals
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [tempValue, setTempValue] = useState('');
  
  // Custom Alert Modal & Edit Modal
  const [alertInfo, setAlertInfo] = useState<{title: string, message: string} | null>(null);
  const [editModal, setEditModal] = useState<{title: string, value: string, onSave: (val: number) => void} | null>(null);

  const handleSetOpening = () => {
    if (!tempValue) return;
    setOpeningAmount(Number(tempValue.replace(/[^0-9.]/g, '')));
    setShowOpeningModal(false);
    setTempValue('');
  };

  const handleSetClosing = () => {
    if (!tempValue) return;
    const closeAmt = Number(tempValue.replace(/[^0-9.]/g, ''));
    setClosingBalance(closeAmt);
    setShowClosingModal(false);
    
    // Automatically calculate sales and log as daily income
    if (openingAmount !== null) {
       const calculatedSale = closeAmt - openingAmount;
       const bDate = getBusinessDateString();
       
       if (calculatedSale > 0) {
          // Dispatch full contextual mapping via Global Engine
          addTransaction({
             id: `sale_${bDate.replace(/\s/g, '_')}`, // Deterministic ID for upsert
             category: 'Total Sale',
             amount: `+₹${calculatedSale.toLocaleString()}`,
             note: 'Drawer Close calculation',
             type: 'income',
             period: 'daily'
          }, calculatedSale);
          setAlertInfo({
             title: "Sales Logged!",
             message: `Closing out exactly matches a calculated profit of ₹${calculatedSale.toLocaleString()}. This has been added to your Daily Income as "Total Sale".`
          });
       } else {
          setAlertInfo({
             title: "Drawer Shortage",
             message: `The drawer was short by ₹${Math.abs(calculatedSale).toLocaleString()}. No new sales were logged.`
          });
       }
    } else {
       setAlertInfo({
         title: "Missing Opening Balance",
         message: "You set a closing balance without an opening balance. We couldn't auto-calculate your daily sales. Please set an opening balance first tomorrow!"
       });
    }
    
    setTempValue('');
  };

  const handleEditSave = () => {
    if (editModal && tempValue) {
       editModal.onSave(Number(tempValue.replace(/[^0-9.]/g, '')));
    }
    setEditModal(null);
    setTempValue('');
  };

  return (
    <SafeAreaView className="flex-1 bg-bgLight">
      <ScrollView className="flex-1 px-5 pt-4 pb-24" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-textMuted text-sm font-medium">Business Date</Text>
            <Text className="text-textMain text-2xl font-bold">{getBusinessDateString()}</Text>
          </View>

        </View>

        {/* 2x2 Grid for Daily & Monthly Tracking */}
        <Text className="text-textMain text-lg font-bold mb-3">Live Dashboard</Text>
        <View className="flex-row gap-3 mb-3">
           <View className="flex-1 bg-incomeLight p-4 rounded-2xl border border-incomeLight">
              <View className="flex-row items-center justify-between mb-2">
                 <View className="flex-row items-center">
                   <Ionicons name="trending-up" size={16} color="#10b981" />
                   <Text className="text-primaryDark text-xs font-bold uppercase ml-1">Daily Income</Text>
                 </View>
              </View>
              <Text className="text-primaryDark text-xl font-extrabold">₹{dailyIncome.toLocaleString()}</Text>
           </View>

           <View className="flex-1 bg-dangerLight p-4 rounded-2xl border border-dangerLight">
              <View className="flex-row items-center justify-between mb-2">
                 <View className="flex-row items-center">
                   <Ionicons name="trending-down" size={16} color="#ef4444" />
                   <Text className="text-danger text-xs font-bold uppercase ml-1">Daily Expense</Text>
                 </View>
              </View>
              <Text className="text-danger text-xl font-extrabold">₹{dailyExpense.toLocaleString()}</Text>
           </View>
        </View>

        <View className="flex-row gap-3 mb-8">
           <View className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <View className="flex-row items-center justify-between mb-2">
                 <View className="flex-row items-center">
                   <Ionicons name="calendar" size={14} color="#64748b" />
                   <Text className="text-textMuted text-xs font-bold uppercase ml-1">Month Income</Text>
                 </View>
              </View>
              <Text className="text-textMain text-lg font-bold">₹{monthlyIncome.toLocaleString()}</Text>
           </View>

           <View className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <View className="flex-row items-center justify-between mb-2">
                 <View className="flex-row items-center">
                   <Ionicons name="calendar-outline" size={14} color="#64748b" />
                   <Text className="text-textMuted text-xs font-bold uppercase ml-1">Month Expense</Text>
                 </View>
              </View>
              <Text className="text-textMain text-lg font-bold">₹{monthlyExpense.toLocaleString()}</Text>
           </View>
        </View>


        {/* Drawer Flow Card */}
        <Text className="text-textMain text-lg font-bold mb-3">Cash Drawer</Text>
        <View className="bg-primaryDark rounded-3xl p-6 mb-6 shadow-md">
          <View className="flex-row justify-between mb-2">
            <View>
              <View className="flex-row items-center mb-1">
                 <Text className="text-white text-xs uppercase tracking-wider font-semibold mr-1">Opening Amount</Text>
                 <Pressable onPress={() => { setTempValue(openingAmount?.toString() || ''); setEditModal({ title: 'Base Opening', value: '', onSave: setOpeningAmount }); }} className="bg-white opacity-70 p-1 rounded-full">
                    <Ionicons name="pencil" size={10} color="white" />
                 </Pressable>
              </View>
              <Text className="text-white text-2xl font-bold">{openingAmount !== null ? `₹${openingAmount.toLocaleString()}` : 'Not Set'}</Text>
            </View>
            <View className="items-end">
              <View className="flex-row items-center mb-1">
                 <Text className="text-white text-xs uppercase tracking-wider font-semibold mr-1">Closing Balance</Text>
                 <Pressable onPress={() => { setTempValue(closingBalance?.toString() || ''); setEditModal({ title: 'Base Closing', value: '', onSave: setClosingBalance }); }} className="bg-white opacity-70 p-1 rounded-full">
                    <Ionicons name="pencil" size={10} color="white" />
                 </Pressable>
              </View>
              <Text className="text-white text-2xl font-bold">{closingBalance !== null ? `₹${closingBalance.toLocaleString()}` : 'Pending'}</Text>
            </View>
          </View>
        </View>

        {/* Adjust Balance CTAs */}
        <View className="flex-row justify-between mb-8 gap-3">
            <Pressable 
              onPress={() => setShowOpeningModal(true)}
              className="flex-1 bg-white border border-slate-200 py-4 rounded-2xl items-center shadow-sm active:bg-slate-50"
            >
               <Text className="text-textMain font-bold">Set Opening</Text>
            </Pressable>
            
            <Pressable 
              onPress={() => setShowClosingModal(true)}
              className="flex-1 bg-slate-800 py-4 rounded-2xl items-center shadow-sm active:bg-slate-700"
            >
               <Text className="text-white font-bold">Set Closing</Text>
            </Pressable>
        </View>

      </ScrollView>

      {/* Floating CTA */}
      <View className="absolute bottom-6 left-5 right-5">
        <Pressable 
          onPress={() => router.push('/daily')}
          className="bg-primaryDark py-4 rounded-full shadow-lg flex-row justify-center items-center"
        >
          <Ionicons name="add" size={24} color="white" />
          <Text className="text-white font-bold text-lg ml-2">Add Expense</Text>
        </Pressable>
      </View>

      {/* -- Modals -- */}

      {/* Set Opening Modal */}
      <Modal visible={showOpeningModal} transparent animationType="slide">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View className="flex-1 justify-end" style={{backgroundColor: 'rgba(15,23,42,0.4)'}}>
              <View className="bg-white rounded-t-3xl pt-6 pb-12 px-6 shadow-xl">
                 <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-2xl font-extrabold text-textMain">Set Opening Amount</Text>
                    <Pressable onPress={() => { setShowOpeningModal(false); setTempValue(''); }}>
                       <Ionicons name="close-circle" size={28} color="#94a3b8" />
                    </Pressable>
                 </View>

                 <View className="flex-row items-center border border-slate-200 rounded-2xl px-4 py-3 mb-6 bg-slate-50">
                    <Text className="text-2xl font-bold text-textMuted mr-2">₹</Text>
                    <TextInput 
                      value={tempValue}
                      onChangeText={setTempValue}
                      keyboardType="numeric"
                      placeholder="e.g. 1500"
                      autoFocus
                      className="flex-1 text-2xl font-bold text-textMain"
                    />
                 </View>

                 <Pressable onPress={handleSetOpening} className="bg-primaryDark py-4 rounded-xl items-center shadow-sm">
                    <Text className="text-white font-bold text-lg">Confirm Opening</Text>
                 </Pressable>
              </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Set Closing Modal */}
      <Modal visible={showClosingModal} transparent animationType="slide">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View className="flex-1 justify-end" style={{backgroundColor: 'rgba(15,23,42,0.4)'}}>
              <View className="bg-white rounded-t-3xl pt-6 pb-12 px-6 shadow-xl">
                 <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-2xl font-extrabold text-textMain">Set Closing Balance</Text>
                    <Pressable onPress={() => { setShowClosingModal(false); setTempValue(''); }}>
                       <Ionicons name="close-circle" size={28} color="#94a3b8" />
                    </Pressable>
                 </View>

                 <View className="flex-row items-center border border-slate-200 rounded-2xl px-4 py-3 mb-6 bg-slate-50">
                    <Text className="text-2xl font-bold text-textMuted mr-2">₹</Text>
                    <TextInput 
                      value={tempValue}
                      onChangeText={setTempValue}
                      keyboardType="numeric"
                      placeholder="e.g. 4000"
                      autoFocus
                      className="flex-1 text-2xl font-bold text-textMain"
                    />
                 </View>

                 <Text className="text-textMuted font-medium text-xs mb-6 px-1">
                    This will automatically calculate the difference between your Opening Amount and Expenses to log your "Total Sale for Today".
                 </Text>

                 <Pressable onPress={handleSetClosing} className="bg-slate-800 py-4 rounded-xl items-center shadow-sm">
                    <Text className="text-white font-bold text-lg">Calculate & Close Drawer</Text>
                 </Pressable>
              </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Generic Edit Value Modal */}
      <Modal visible={!!editModal} transparent animationType="fade">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View className="flex-1 justify-center items-center px-5" style={{backgroundColor: 'rgba(15,23,42,0.6)'}}>
              <View className="bg-white p-6 rounded-3xl items-center w-full shadow-2xl">
                 <Text className="text-xl font-extrabold text-textMain mb-4">{editModal?.title} (Override)</Text>
                 
                 <View className="flex-row items-center border border-slate-200 rounded-2xl px-4 py-3 mb-6 bg-slate-50 w-full">
                    <Text className="text-xl font-bold text-textMuted mr-2">₹</Text>
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
                      <Text className="text-white font-bold">Save Override</Text>
                   </Pressable>
                 </View>
              </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Result Alert Modal */}
      <Modal visible={!!alertInfo} transparent animationType="fade">
        <View className="flex-1 justify-center items-center px-5" style={{backgroundColor: 'rgba(15,23,42,0.6)'}}>
            <View className="bg-white p-6 rounded-3xl items-center w-full shadow-2xl">
                <Ionicons name="checkmark-circle" size={54} color="#10b981" className="mb-4" />
                <Text className="text-2xl font-extrabold text-textMain mb-2">{alertInfo?.title}</Text>
                <Text className="text-center text-textMuted font-medium mb-6 text-base leading-relaxed">
                   {alertInfo?.message}
                </Text>
                <Pressable onPress={() => setAlertInfo(null)} className="w-full bg-slate-100 py-4 rounded-xl items-center">
                   <Text className="text-textMain font-bold test-base">Awesome</Text>
                </Pressable>
            </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
