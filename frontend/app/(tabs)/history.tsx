import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Image, SafeAreaView } from 'react-native';

const HISTORY_DATA = [
  { id: '1', title: 'Study Room 101', time: 'March 20, 2024 - 2:00 PM', status: 'Confirmed', color: '#16A34A', bg: '#DCFCE7', img: 'https://picsum.photos/200/200?random=4' },
  { id: '2', title: 'Sports Court', time: 'March 18, 2024 - 4:30 PM', status: 'Pending', color: '#EA580C', bg: '#FFEDD5', img: 'https://picsum.photos/200/200?random=5' },
  { id: '3', title: 'Conference Room A', time: 'March 15, 2024 - 10:00 AM', status: 'Cancelled', color: '#DC2626', bg: '#FEE2E2', img: 'https://picsum.photos/200/200?random=6' },
];

export default function HistoryPage() {
  const [filter, setFilter] = useState('All');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>History</Text>
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

      <ScrollView contentContainerStyle={styles.list}>
        {HISTORY_DATA.map(item => (
          <View key={item.id} style={styles.card}>
            <Image source={{ uri: item.img }} style={styles.cardImage} />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardTime}>{item.time}</Text>
              <View style={[styles.statusBadge, { backgroundColor: item.bg }]}>
                <Text style={[styles.statusText, { color: item.color }]}>{item.status}</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
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
  list: { padding: 16, gap: 16 },
  card: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 12, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  cardImage: { width: 80, height: 80, borderRadius: 12 },
  cardBody: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937', marginBottom: 4 },
  cardTime: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '600' },
});