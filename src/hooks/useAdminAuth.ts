import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface AdminAuth {
    isAdmin: boolean;
    adminEmail: string | null;
    adminLoading: boolean;
    adminLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    adminLogout: () => Promise<void>;
}

export const useAdminAuth = (): AdminAuth => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminEmail, setAdminEmail] = useState<string | null>(null);
    const [adminLoading, setAdminLoading] = useState(true);

    // Check existing session on mount
    useEffect(() => {
        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    const { data } = await supabase
                        .from('admins')
                        .select('email, role')
                        .eq('id', session.user.id)
                        .single();

                    if (data) {
                        setIsAdmin(true);
                        setAdminEmail(session.user.email || null);
                    }
                }
            } catch {
                // Silent — user is not admin
            } finally {
                setAdminLoading(false);
            }
        };

        checkSession();

        // Listen for auth state changes (login/logout from other tabs etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === 'SIGNED_OUT' || !session) {
                    setIsAdmin(false);
                    setAdminEmail(null);
                    return;
                }

                if (event === 'SIGNED_IN' && session?.user) {
                    try {
                        const { data } = await supabase
                            .from('admins')
                            .select('email, role')
                            .eq('id', session.user.id)
                            .single();

                        if (data) {
                            setIsAdmin(true);
                            setAdminEmail(session.user.email || null);
                        }
                    } catch {
                        // Not an admin
                    }
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const adminLogin = async (
        email: string,
        password: string
    ): Promise<{ success: boolean; error?: string }> => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                // Translate common Supabase errors to Vietnamese
                if (error.message.includes('Invalid login credentials')) {
                    return { success: false, error: 'Email hoặc mật khẩu không đúng!' };
                }
                return { success: false, error: error.message };
            }

            if (!data.user) {
                return { success: false, error: 'Không tìm thấy tài khoản' };
            }

            // Verify user is in admins table
            const { data: adminData, error: adminError } = await supabase
                .from('admins')
                .select('email, role')
                .eq('id', data.user.id)
                .single();

            if (adminError || !adminData) {
                // User exists in auth but not in admins table → not an admin
                await supabase.auth.signOut();
                return {
                    success: false,
                    error: 'Tài khoản này không có quyền Quản trị viên!',
                };
            }

            setIsAdmin(true);
            setAdminEmail(data.user.email || null);
            return { success: true };
        } catch (err: any) {
            return {
                success: false,
                error: err.message || 'Lỗi kết nối đến máy chủ',
            };
        }
    };

    const adminLogout = async () => {
        try {
            await supabase.auth.signOut();
        } catch {
            // Even if signOut fails, clear local state
        }
        setIsAdmin(false);
        setAdminEmail(null);
    };

    return { isAdmin, adminEmail, adminLoading, adminLogin, adminLogout };
};
