import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Image, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase'; // Make sure this path is correct!

export default function HistoryPage() {
  const [filter, setFilter] = useState('All');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 1. Fetch live bookings for the logged-in user
  const fetchBookings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .order('id', { ascending: false }); // Shows the newest bookings first

      if (error) throw error;
      if (data) setBookings(data);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 2. Refresh the data every time this tab comes into focus
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchBookings();
    }, [])
  );

  // 3. Pull-to-refresh logic
  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  // Helper: Convert the "14" string from Supabase back into "2:00 PM"
  const formatTime = (hourString) => {
    const hour = parseInt(hourString, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:00 ${ampm}`;
  };

  // Helper: Assign the correct colors based on the status in the database
  const getStatusStyle = (status) => {
    if (status === 'Confirmed') return { color: '#16A34A', bg: '#DCFCE7' };
    if (status === 'Cancelled') return { color: '#DC2626', bg: '#FEE2E2' };
    return { color: '#EA580C', bg: '#FFEDD5' }; // Pending
  };

  // Helper: Give the facility a nice generic image based on its name
  const getFacilityImage = (name) => {
    if (name.includes('Study Room')) return 'https://picsum.photos/200/200?random=4';
    if (name.includes('Sports')) return 'https://picsum.photos/200/200?random=5';
    return 'https://picsum.photos/200/200?random=6';
  };

  // 4. Basic filtering logic
  const filteredBookings = bookings.filter(b => {
    if (filter === 'All') return true;
    if (filter === 'Upcoming') return b.status === 'Confirmed'; 
    if (filter === 'Past') return b.status === 'Cancelled'; 
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>My History</Text>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['All', 'Upcoming', 'Past'].map(f => (
            <Text
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filterPill, filter === f && styles.filterPillActive]}
            >
              {f}
            </Text>
          ))}
        </ScrollView>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading your bookings...</Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563EB"]} />
          }
        >
          {filteredBookings.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="event-busy" size={64} color="#D1D5DB" />
              <Text style={styles.emptyStateText}>No bookings found in this category.</Text>
            </View>
          ) : (
            filteredBookings.map(item => {
              const statusStyle = getStatusStyle(item.status);
              
              return (
                <View key={item.id} style={styles.card}>
                  <Image source={{ uri: getFacilityImage(item.facility_name) }} style={styles.cardImage} />
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{item.facility_name}</Text>
                    
                    {/* Displaying the REAL Date and formatted Time! */}
                    <Text style={styles.cardTime}>{item.booking_date} - {formatTime(item.time_block)}</Text>
                    
                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                      <Text style={[styles.statusText, { color: statusStyle.color }]}>{item.status}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  appBar: { padding: 16, backgroundColor: '#FFF' },
  appBarTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  filterContainer: { backgroundColor: '#FFF', paddingHorizontal: 16, paddingBottom: 12 },
  filterPill: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: '#D1D5DB', marginRight: 8, color: '#4B5563', overflow: 'hidden' },
  filterPillActive: { backgroundColor: '#2563EB', color: '#FFF', borderColor: '#2563EB' },
  loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#6B7280', fontSize: 16 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  emptyStateText: { marginTop: 16, color: '#6B7280', fontSize: 16 },
  list: { padding: 16, gap: 16 },
  card: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  cardImage: { width: 80, height: 80, borderRadius: 12 },
  cardBody: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 4 },
  cardTime: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '600' },
});