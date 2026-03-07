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

    // Check session on mount via GoTrue listener to prevent lock race conditions
    useEffect(() => {
        let isMounted = true;

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!isMounted) return;

                if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
                    if (session?.user) {
                        try {
                            const { data } = await supabase
                                .from('admins')
                                .select('email, role')
                                .eq('id', session.user.id)
                                .single();

                            if (isMounted && data) {
                                setIsAdmin(true);
                                setAdminEmail(session.user.email || null);
                            }
                        } catch {
                            // silent
                        } finally {
                            if (isMounted) setAdminLoading(false);
                        }
                    } else {
                        if (isMounted) {
                            setAdminLoading(false);
                            setIsAdmin(false);
                            setAdminEmail(null);
                        }
                    }
                } else if (event === 'SIGNED_OUT') {
                    if (isMounted) {
                        setAdminLoading(false);
                        setIsAdmin(false);
                        setAdminEmail(null);
                    }
                }
            }
        );

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
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
