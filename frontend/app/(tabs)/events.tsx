import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, SafeAreaView, Image, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase'; // Make sure this path points to where you saved your supabase.ts file!

export default function EventsPage() {
  const router = useRouter();
  
  // 1. Create state to hold the live data
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // 2. Fetch data the moment the screen loads
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      // Reach out to Supabase and grab everything from the 'events' table
      const { data, error } = await supabase.from('events').select('*');
      
      if (error) {
        console.error("Supabase Error:", error.message);
        return;
      }
      
      if (data) {
        setEvents(data); // Save the database rows into our app's memory
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoToMap = (event) => {
    router.navigate({
      pathname: '/',
      params: { 
        destLat: event.latitude, 
        destLon: event.longitude, 
        destName: event.location 
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>Campus Events</Text>
      </View>

      {/* 3. Show a loading spinner while waiting for the database */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={{ marginTop: 10, color: '#6B7280' }}>Fetching live events...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {/* 4. Map over the live 'events' state instead of the hardcoded array */}
          {events.map(event => (
            <View key={event.id} style={styles.card}>
              <Image source={{ uri: event.image_url }} style={styles.cardImage} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{event.title}</Text>
                <Text style={styles.cardSubtitle}>
                  <MaterialIcons name="location-on" size={14} color="#6B7280" /> {event.location}
                </Text>
                <Text style={styles.cardSubtitle}>
                  <MaterialIcons name="event" size={14} color="#6B7280" /> {event.date}
                </Text>
                
                <TouchableOpacity 
                  style={styles.actionButton} 
                  onPress={() => handleGoToMap(event)}
                >
                  <MaterialIcons name="directions" size={18} color="#FFF" />
                  <Text style={styles.actionButtonText}>Go To Event</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  appBar: { padding: 16, backgroundColor: '#FFF' },
  appBarTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  cardImage: { width: '100%', height: 140 },
  cardBody: { padding: 16 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 8 },
  cardSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  actionButton: { flexDirection: 'row', backgroundColor: '#2563EB', paddingVertical: 10, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  actionButtonText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8 },
});