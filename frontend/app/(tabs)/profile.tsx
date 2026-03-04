import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState({ name: 'UTP Student', email: 'student@utp.edu.my' });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      Alert.alert('Success', 'Profile saved successfully!');
    }, 1000); // Simulate network request
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>Profile</Text>
        <TouchableOpacity onPress={handleSave}>
          <MaterialIcons name="check-circle" size={28} color="#2563EB" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Header Card */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>UT</Text>
              <View style={styles.editIcon}><MaterialIcons name="edit" size={14} color="#FFF" /></View>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.nameText}>{user.name}</Text>
              <Text style={styles.emailText}>{user.email}</Text>
              <View style={styles.pill}><MaterialIcons name="location-on" size={14} color="#2563EB" /><Text style={styles.pillText}> UTP</Text></View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Your details</Text>
        <View style={styles.card}>
          <View style={styles.inputContainer}>
            <MaterialIcons name="person" size={20} color="#2563EB" />
            <TextInput style={styles.input} value={user.name} onChangeText={(t) => setUser({...user, name: t})} />
          </View>
          <View style={[styles.inputContainer, { marginTop: 12 }]}>
            <MaterialIcons name="mail" size={20} color="#2563EB" />
            <TextInput style={styles.input} value={user.email} onChangeText={(t) => setUser({...user, email: t})} />
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <MaterialIcons name="save" size={20} color="#FFF" />
            <Text style={styles.saveBtnText}>{isSaving ? 'Saving...' : 'Save changes'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Session</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.logoutBtn} onPress={() => router.replace('/')}>
            <MaterialIcons name="logout" size={20} color="#DC2626" />
            <Text style={styles.logoutBtnText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  appBar: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#F3F4F6' },
  appBarTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  content: { padding: 16 },
  card: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 24, elevation: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  editIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#1D4ED8', padding: 4, borderRadius: 10 },
  headerInfo: { marginLeft: 16 },
  nameText: { fontSize: 20, fontWeight: 'bold' },
  emailText: { color: '#6B7280', marginBottom: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DBEAFE', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  pillText: { color: '#2563EB', fontSize: 12, fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, marginLeft: 4 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 12, marginLeft: 8, fontSize: 16 },
  saveBtn: { flexDirection: 'row', backgroundColor: '#2563EB', marginTop: 16, padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8 },
  logoutBtn: { flexDirection: 'row', borderColor: '#DC2626', borderWidth: 1, padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  logoutBtnText: { color: '#DC2626', fontWeight: 'bold', marginLeft: 8 },
});