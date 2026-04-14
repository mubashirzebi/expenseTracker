import { View, Text, Switch, ScrollView, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { router } from 'expo-router';
import { useGlobalState } from '../context/GlobalState';

export default function SettingsScreen() {
  const { cutoffTime, setCutoffTime, exportDatabase, importDatabase } = useGlobalState();
  
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [tempTime, setTempTime] = useState('');

  // Data Export States
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  const quickTimes = ['12:00 AM', '02:00 AM', '03:00 AM', '05:00 AM'];

  const handleSaveTime = () => {
     if (tempTime) setCutoffTime(tempTime);
     setShowTimeModal(false);
  };



  return (
    <SafeAreaView className="flex-1 bg-bgLight">
      <View className="px-5 pt-4 pb-2">
        <Text className="text-textMain text-2xl font-extrabold mb-6">Settings</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        
        {/* Section 1 */}
        <Text className="px-6 text-textMuted font-bold text-xs uppercase mb-2">Preferences</Text>
        <View className="bg-white border-y border-slate-100 mb-6">
          <Pressable 
            onPress={() => { setTempTime(cutoffTime); setShowTimeModal(true); }}
            className="flex-row justify-between items-center px-5 py-4 active:bg-slate-50"
          >
             <View className="flex-row items-center">
               <View className="bg-orange-50 p-2 rounded-lg mr-3">
                 <Ionicons name="time" size={20} color="#f97316" />
               </View>
               <Text className="text-textMain font-semibold text-base">Business Day Cutoff Time</Text>
             </View>
             <View className="flex-row items-center">
                <Text className="text-textMuted font-bold mr-1">{cutoffTime}</Text>
                <Ionicons name="pencil" size={14} color="#94a3b8" />
             </View>
          </Pressable>
        </View>

        {/* Section 2 */}
        <Text className="px-6 text-textMuted font-bold text-xs uppercase mb-2">Data & Categories</Text>
        <View className="bg-white border-y border-slate-100 mb-6">
          <Pressable onPress={() => router.push('/manage-categories')} className="flex-row justify-between items-center px-5 py-4 border-b border-slate-50 active:bg-slate-50">
             <View className="flex-row items-center">
               <View className="bg-blue-50 p-2 rounded-lg mr-3">
                 <Ionicons name="list" size={20} color="#3b82f6" />
               </View>
               <Text className="text-textMain font-semibold text-base">Manage Categories</Text>
             </View>
             <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </Pressable>
          <Pressable onPress={() => exportDatabase()} className="flex-row justify-between items-center px-5 py-4 border-b border-slate-50 active:bg-slate-50">
             <View className="flex-row items-center">
               <View className="bg-emerald-50 p-2 rounded-lg mr-3">
                 <Ionicons name="cloud-upload" size={20} color="#10b981" />
               </View>
               <Text className="text-textMain font-semibold text-base">Export Data (Cloud Backup)</Text>
             </View>
             <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </Pressable>
          <Pressable onPress={() => importDatabase()} className="flex-row justify-between items-center px-5 py-4 active:bg-slate-50">
             <View className="flex-row items-center">
               <View className="bg-purple-50 p-2 rounded-lg mr-3">
                 <Ionicons name="cloud-download" size={20} color="#8b5cf6" />
               </View>
               <Text className="text-textMain font-semibold text-base">Restore Data (From File)</Text>
             </View>
             <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </Pressable>
        </View>

        {/* Test App Lock Interface */}
        <Pressable 
           onPress={() => alert("This will trigger FaceID/TouchID in the final build!")} 
           className="mt-4 mb-10 px-5 flex-row justify-center items-center active:opacity-60"
        >
          <Ionicons name="lock-closed-outline" size={20} color="#1e293b" />
          <Text className="text-textMain font-bold ml-2">Manually Lock App</Text>
        </Pressable>

        {/* Developer Credit */}
        <View className="mt-8 mb-20 items-center justify-center">
          <Text className="text-textMuted text-[10px] font-bold uppercase tracking-[3px] mb-1">Developed By</Text>
          <Text className="text-textMain text-xl font-extrabold">MUBASHIR ZEBI</Text>
          <View className="w-12 h-1 bg-primary rounded-full mt-2" />
        </View>

      </ScrollView>

      {/* --- CUTOFF TIME MODAL --- */}
      <Modal visible={showTimeModal} transparent animationType="slide">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View className="flex-1 justify-end bg-black" style={{backgroundColor: 'rgba(15,23,42,0.4)'}}>
              <View className="bg-white rounded-t-3xl pt-6 pb-12 px-6 shadow-xl">
                 <View className="flex-row justify-between items-center mb-6">
                    <Text className="text-2xl font-extrabold text-textMain">Set Cutoff Time</Text>
                    <Pressable onPress={() => { setShowTimeModal(false); setTempTime(''); }}>
                       <Ionicons name="close-circle" size={28} color="#94a3b8" />
                    </Pressable>
                 </View>

                 <Text className="text-textMuted font-medium text-xs mb-4 leading-relaxed">
                    Transactions logged after this hour will roll over into the NEXT business day's sales tracker.
                 </Text>

                 {/* Quick Time Toggles */}
                 <View className="flex-row flex-wrap gap-2 mb-6">
                    {quickTimes.map(qt => (
                       <Pressable 
                         key={qt}
                         onPress={() => setTempTime(qt)}
                         className="px-4 py-3 rounded-xl border-2"
                         style={{ 
                            backgroundColor: tempTime === qt ? '#d1fae5' : '#ffffff',
                            borderColor: tempTime === qt ? '#10b981' : '#f1f5f9'
                         }}
                       >
                         <Text className="font-bold" style={{ color: tempTime === qt ? '#059669' : '#1e293b' }}>{qt}</Text>
                       </Pressable>
                    ))}
                 </View>

                 <Text className="text-textMuted font-bold text-xs uppercase mb-2 ml-1">Or Type Custom Box</Text>
                 <View className="flex-row items-center border border-slate-200 rounded-2xl px-5 py-4 mb-8 bg-slate-50">
                    <Ionicons name="time-outline" size={20} color="#64748b" className="mr-3" />
                    <TextInput 
                      value={tempTime}
                      onChangeText={setTempTime}
                      placeholder="e.g. 04:30 AM"
                      className="flex-1 text-lg font-bold text-textMain ml-2"
                    />
                 </View>

                 <Pressable onPress={handleSaveTime} className="bg-primaryDark py-4 rounded-xl items-center shadow-sm">
                    <Text className="text-white font-bold text-lg">Save Preference</Text>
                 </Pressable>
              </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- EXPORT MODAL --- */}
      <Modal visible={isExporting || exportComplete} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black px-5" style={{backgroundColor: 'rgba(15,23,42,0.6)'}}>
            <View className="bg-white p-6 rounded-3xl items-center w-64 shadow-2xl">
                {exportComplete ? (
                   <>
                      <View className="w-16 h-16 rounded-full bg-incomeLight items-center justify-center mb-4">
                         <Ionicons name="checkmark-done" size={36} color="#10b981" />
                      </View>
                      <Text className="text-xl font-extrabold text-textMain mb-1">Exported!</Text>
                      <Text className="text-center text-textMuted font-medium text-sm">
                         transactions_2026.csv downloaded securely.
                      </Text>
                   </>
                ) : (
                   <>
                      <View className="w-16 h-16 rounded-full bg-slate-100 items-center justify-center mb-4 border border-slate-200">
                         <Ionicons name="cloud-download-outline" size={32} color="#1e293b" />
                      </View>
                      <Text className="text-xl font-extrabold text-textMain mb-2">Compiling...</Text>
                      <View className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                         <View className="w-2/3 h-full bg-primaryDark rounded-full"></View>
                      </View>
                      <Text className="text-center text-textMuted font-semibold text-xs mt-3">
                         Gathering ledger records
                      </Text>
                   </>
                )}
            </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
