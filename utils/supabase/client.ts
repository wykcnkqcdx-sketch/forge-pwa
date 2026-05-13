import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseUrl = typeof process !== 'undefined' && process.env.EXPO_PUBLIC_SUPABASE_URL 
  ? process.env.EXPO_PUBLIC_SUPABASE_URL 
  : import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = typeof process !== 'undefined' && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY 
  ? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY 
  : import.meta.env.VITE_SUPABASE_ANON_KEY;

export const createClient = () =>
  createBrowserClient(supabaseUrl, supabaseKey);
  createBrowserClient(supabaseUrl!, supabaseKey!);
