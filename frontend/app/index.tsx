import React, { useState, useEffect } from 'react';
import { 
  Alert, StyleSheet, View, Text, TextInput, TouchableOpacity, 
  SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace('/(tabs)'); 
      }
    });
  }, []);

  async function signIn() {
    if (!email || !password) return Alert.alert('Hold up', 'Please enter both email and password.');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      Alert.alert('Login Failed', error.message);
    } else {
      router.replace('/(tabs)');
    }
    setLoading(false);
  }

  async function signUp() {
    if (!email || !password) return Alert.alert('Hold up', 'Please enter both email and password.');
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    
    if (error) {
      Alert.alert('Signup Failed', error.message);
    } else if (data.user) {
      await supabase.from('profiles').insert({ 
        id: data.user.id, 
        full_name: 'UTP Student',
        student_id: 'PENDING'
      });
      Alert.alert('Success 🎉', 'Account created! You can now log in.');
    }
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Branding Section */}
        <View style={styles.headerContainer}>
          <View style={styles.logoCircle}>
            <MaterialIcons name="school" size={50} color="#FFF" />
          </View>
          <Text style={styles.title}>CampusHub</Text>
          <Text style={styles.subtitle}>Universiti Teknologi PETRONAS</Text>
        </View>

        {/* Form Section */}
        <View style={styles.card}>
          <Text style={styles.welcomeText}>Welcome back</Text>

          <View style={styles.inputWrapper}>
            <MaterialIcons name="email" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Student Email (@utp.edu.my)"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputWrapper}>
            <MaterialIcons name="lock" size={20} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity 
            style={styles.primaryBtn} 
            onPress={signIn} 
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Sign In</Text>}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity 
            style={styles.secondaryBtn} 
            onPress={signUp} 
            disabled={loading}
          >
            <Text style={styles.secondaryBtnText}>Create Student Account</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  keyboardView: { flex: 1, justifyContent: 'center', padding: 20 },
  
  // Header Styles
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginBottom: 16, elevation: 5, shadowColor: '#2563EB', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  title: { fontSize: 32, fontWeight: '900', color: '#1F2937', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 1 },
  
  // Card & Form Styles
  card: { backgroundColor: '#FFF', padding: 24, borderRadius: 24, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 15, shadowOffset: { width: 0, height: 10 } },
  welcomeText: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 20 },
  
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, marginBottom: 16, paddingHorizontal: 14 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: '#1F2937' },
  
  // Button Styles
  primaryBtn: { backgroundColor: '#2563EB', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 8, elevation: 2, shadowColor: '#2563EB', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  
  secondaryBtn: { backgroundColor: '#F3F4F6', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  secondaryBtnText: { color: '#4B5563', fontSize: 16, fontWeight: 'bold' },
  
  // Divider Styles
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  divider: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { marginHorizontal: 12, color: '#9CA3AF', fontSize: 12, fontWeight: 'bold' },
});