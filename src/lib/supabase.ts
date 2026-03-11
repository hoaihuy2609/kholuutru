import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
if (!supabaseUrl || !supabaseKey) console.error('[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');

export class SupabaseConfigError extends Error {
    constructor() {
        super('Supabase configuration is missing. Vui lòng kiểm tra cấu hình VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY.');
        this.name = 'SupabaseConfigError';
    }
}

// Lazily create the Supabase client on first use — avoids auth init
// overhead (session rehydration, token refresh timers) at startup.
let _instance: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
    if (!_instance) {
        if (!supabaseUrl || !supabaseKey) {
            throw new SupabaseConfigError();
        }
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
