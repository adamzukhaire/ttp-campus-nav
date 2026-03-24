import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase'; // Important: Import your database!

export default function ProfilePage() {
  const router = useRouter();
  
  // Start with empty strings instead of fake data
  const [user, setUser] = useState({ id: '', name: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Fetch the real user data when the screen opens
  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      // Get the currently logged-in user's Auth info
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Now fetch their public profile (like their name) from our profiles table
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', session.user.id)
          .single();

        setUser({
          id: session.user.id,
          email: session.user.email,
          name: profileData?.full_name || 'UTP Student'
        });
      }
    } catch (error) {
      console.error("Error loading profile", error);
    } finally {
      setLoading(false);
    }
  };

  // 2. Actually save changes to the database
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: user.name })
        .eq('id', user.id);

      if (error) throw error;
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 3. The REAL Logout function
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut(); // Tell Supabase to kill the session
      router.replace('/'); // Send them back to the login screen
    } catch (error) {
      Alert.alert('Logout Error', error.message);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

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
              <Text style={styles.avatarText}>{user.name ? user.name.substring(0, 2).toUpperCase() : 'UT'}</Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.nameText}>{user.name}</Text>
              <Text style={styles.emailText}>{user.email}</Text>
              <View style={styles.pill}>
                <MaterialIcons name="location-on" size={14} color="#2563EB" />
                <Text style={styles.pillText}> UTP</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Your details</Text>
        <View style={styles.card}>
          <View style={styles.inputContainer}>
            <MaterialIcons name="person" size={20} color="#2563EB" />
            <TextInput style={styles.input} value={user.name} onChangeText={(t) => setUser({...user, name: t})} />
          </View>
          <View style={[styles.inputContainer, { marginTop: 12, backgroundColor: '#F3F4F6' }]}>
            <MaterialIcons name="mail" size={20} color="#9CA3AF" />
            <TextInput style={[styles.input, { color: '#9CA3AF' }]} value={user.email} editable={false} /> 
            {/* Note: Made email uneditable because changing Auth emails requires a complex verification process */}
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <MaterialIcons name="save" size={20} color="#FFF" />
            <Text style={styles.saveBtnText}>{isSaving ? 'Saving...' : 'Save changes'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Session</Text>
        <View style={styles.card}>
          {/* Replaced the dummy router.replace with our real handleLogout function */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <MaterialIcons name="logout" size={20} color="#DC2626" />
            <Text style={styles.logoutBtnText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ... Keep your exact same styles from before down here!
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  appBar: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#F3F4F6' },
  appBarTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  content: { padding: 16 },
  card: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 24, elevation: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
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