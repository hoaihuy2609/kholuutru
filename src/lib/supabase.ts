import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ndhcwrczwbehyznnxzou.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kaGN3cmN6d2JlaHl6bm54em91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzk0OTEsImV4cCI6MjA4NzY1NTQ5MX0.-LAbz_xMZdPlHlvyaYrotonX_sKoTLwNMEpHss5fun4';

// Lazily create the Supabase client on first use — avoids auth init
// overhead (session rehydration, token refresh timers) at startup.
let _instance: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
    if (!_instance) {
        _instance = createClient(supabaseUrl, supabaseKey, {
            auth: {
                flowType: 'implicit',
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false,
            },
        });
    }
    return _instance;
}

// Transparent Proxy — existing `import { supabase }` call-sites work
// unchanged while the real client is deferred until first property access.
export const supabase: SupabaseClient = new Proxy(
    Object.create(null) as SupabaseClient,
    {
        get(_t, prop, _r) {
            const client = getSupabase();
            const value = Reflect.get(client, prop, client);
            return typeof value === 'function'
                ? (value as (...a: unknown[]) => unknown).bind(client)
                : value;
        },
        set(_t, prop, value) {
            return Reflect.set(getSupabase(), prop, value);
        },
        has(_t, prop) {
            return Reflect.has(getSupabase(), prop);
        },
        ownKeys(_t) {
            return Reflect.ownKeys(getSupabase());
        },
        getOwnPropertyDescriptor(_t, prop) {
            return Reflect.getOwnPropertyDescriptor(getSupabase(), prop);
        },
    },
);
