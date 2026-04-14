import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { router } from 'expo-router';
import { useGlobalState } from './context/GlobalState';

export default function ManageCategoriesScreen() {
  const [activeTab, setActiveTab] = useState('Daily');
  const [newCat, setNewCat] = useState('');
  
  // Custom Modal State for Web Compatibility
  const [catToDelete, setCatToDelete] = useState<string | null>(null);

  const { dailyCats, setDailyCats, monthlyCats, setMonthlyCats, persistCategory, removeCategory } = useGlobalState();

  const activeCats = activeTab === 'Daily' ? dailyCats : monthlyCats;

  const handleAdd = () => {
    if (!newCat.trim()) return;
    persistCategory(newCat, activeTab as 'Daily' | 'Monthly');
    setNewCat('');
  };

  const confirmDelete = () => {
    if (!catToDelete) return;
    removeCategory(catToDelete, activeTab as 'Daily' | 'Monthly');
    setCatToDelete(null);
  };

  return (
    <SafeAreaView className="flex-1 bg-bgLight">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-4 bg-white shadow-sm border-b border-slate-100 z-10">
        <Pressable onPress={() => router.back()} className="p-2 mr-2">
           <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </Pressable>
        <Text className="text-textMain text-xl font-extrabold flex-1">Manage Categories</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
            
            {/* Context Notice */}
            <View className="bg-incomeLight p-4 rounded-2xl mb-6 flex-row">
               <Ionicons name="information-circle" size={24} color="#10b981" />
               <Text className="ml-3 text-textMain text-sm flex-1 leading-snug">
                  <Text className="font-bold">History Guarantee: </Text> 
                  Deleting a category only hides it from the "Add Entry" screen. Past entries utilizing deleted categories will safely remain in your History!
               </Text>
            </View>

            {/* Toggle Tab */}
            <View className="flex-row bg-slate-200/60 rounded-xl p-1 mb-6">
              <Pressable 
                onPress={() => setActiveTab('Daily')}
                className="flex-1 py-3 rounded-lg items-center"
                style={activeTab === 'Daily' ? { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 } : {}}
              >
                <Text className="font-bold" style={{ color: activeTab === 'Daily' ? '#1e293b' : '#64748b' }}>Daily Items</Text>
              </Pressable>
              <Pressable 
                onPress={() => setActiveTab('Monthly')}
                className="flex-1 py-3 rounded-lg items-center"
                style={activeTab === 'Monthly' ? { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 } : {}}
              >
                <Text className="font-bold" style={{ color: activeTab === 'Monthly' ? '#1e293b' : '#64748b' }}>Monthly Bills</Text>
              </Pressable>
            </View>

            {/* Add New Category Input */}
            <View className="flex-row mb-6">
               <TextInput 
                 value={newCat}
                 onChangeText={setNewCat}
                 placeholder={`New ${activeTab} Category...`}
                 placeholderTextColor="#94a3b8"
                 className="flex-1 bg-white px-4 py-3 rounded-l-2xl border border-slate-200 border-r-0 font-medium text-textMain"
               />
               <Pressable 
                 onPress={handleAdd}
                 className="bg-primaryDark px-5 justify-center items-center rounded-r-2xl shadow-sm active:opacity-80"
               >
                 <Text className="text-white font-bold text-base">Add</Text>
               </Pressable>
            </View>
            
            {/* Category List */}
            <Text className="text-textMuted font-bold text-xs uppercase mb-3 px-1">Active {activeTab} Categories</Text>
            
            <View className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm mb-20">
               {activeCats.map((cat, idx) => (
                  <View key={cat.id} className="flex-row justify-between items-center px-5 py-4" style={idx !== activeCats.length - 1 ? { borderBottomWidth: 1, borderBottomColor: '#f8fafc' } : {}}>
                     <View className="flex-row items-center">
                        <View className="bg-slate-50 w-8 h-8 rounded-full items-center justify-center mr-3">
                           <Ionicons name={activeTab === 'Daily' ? "pricetag" : "calendar"} size={14} color="#64748b" />
                        </View>
                        <Text className="text-textMain font-bold text-base">{cat.name}</Text>
                     </View>
                     
                     <Pressable onPress={() => setCatToDelete(cat.id)} className="p-2 -mr-2 bg-red-50 rounded-xl active:bg-red-100">
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                     </Pressable>
                  </View>
               ))}
            </View>

          </ScrollView>
      </KeyboardAvoidingView>

      {/* --- Custom Confirmation Modal for Web Compatibility --- */}
      <Modal visible={!!catToDelete} transparent animationType="fade">
        <View className="flex-1 bg-slate-900 justify-center items-center px-5">
            <View className="bg-white w-full rounded-3xl overflow-hidden p-6 shadow-xl">
                <View className="items-center mb-4">
                   <View className="bg-red-100 w-16 h-16 rounded-full justify-center items-center mb-4">
                      <Ionicons name="warning" size={32} color="#ef4444" />
                   </View>
                   <Text className="text-xl font-extrabold text-textMain mb-2 text-center">Archive Category?</Text>
                   <Text className="text-center text-textMuted font-medium leading-relaxed">
                     This category will be hidden from your forms, but past expenses using it will STILL be maintained in your History & Summaries.
                   </Text>
                </View>

                <View className="flex-row mt-4 gap-3">
                   <Pressable 
                     onPress={() => setCatToDelete(null)}
                     className="flex-1 bg-slate-100 py-4 rounded-xl items-center"
                   >
                     <Text className="font-bold text-textMain">Cancel</Text>
                   </Pressable>
                   <Pressable 
                     onPress={confirmDelete}
                     className="flex-1 bg-danger py-4 rounded-xl items-center shadow-sm shadow-danger/30"
                   >
                     <Text className="font-bold text-white">Archive</Text>
                   </Pressable>
                </View>
            </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
