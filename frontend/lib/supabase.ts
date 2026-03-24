// lib/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// You will get these two URLs from your Supabase dashboard once you create a free account
const supabaseUrl = 'https://ljpauczbimcjqjehxadd.supabase.co';
const supabaseAnonKey = 'sb_publishable_-It4f5zQ0D0mSY4P9mHpLw_yPks5ulm';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
