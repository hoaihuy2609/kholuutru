import { create } from 'zustand';
import { GradeLevel } from '../../types';
import { verifyAdminToken, setAdminToken, clearAdminToken } from '../lib/crypto';

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface UIStore {
  // Modal / overlay states
  isSettingsOpen: boolean;
  isMobileMenuOpen: boolean;
  showAdminDashboard: boolean;
  showGitHubSync: boolean;

  // Toast
  toasts: ToastMessage[];

  // Admin & preview
  isAdmin: boolean;
  previewMode: GradeLevel | null;

  // Access screens
  isKicked: boolean;

  // Notification badge
  notificationUnreadCount: number;

  // Actions
  setSettingsOpen: (v: boolean) => void;
  setMobileMenuOpen: (v: boolean) => void;
  setShowAdminDashboard: (v: boolean) => void;
  setShowGitHubSync: (v: boolean) => void;

  showToast: (message: string, type?: ToastMessage['type'], duration?: number) => void;
  removeToast: (id: string) => void;

  toggleAdmin: (status: boolean) => void;
  setPreviewMode: (mode: GradeLevel | null) => void;

  setKicked: (v: boolean) => void;
  setNotificationUnreadCount: (n: number) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  isSettingsOpen: false,
  isMobileMenuOpen: false,
  showAdminDashboard: false,
  showGitHubSync: false,

  toasts: [],

  isAdmin: verifyAdminToken(),
  previewMode: null,

  isKicked: false,
  notificationUnreadCount: 0,

  setSettingsOpen: (v) => set({ isSettingsOpen: v }),
  setMobileMenuOpen: (v) => set({ isMobileMenuOpen: v }),
  setShowAdminDashboard: (v) => set({ showAdminDashboard: v }),
  setShowGitHubSync: (v) => set({ showGitHubSync: v }),

  showToast: (message, type = 'success', duration = 4000) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    // Auto-dismiss sau duration ms
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  toggleAdmin: (status) => {
    if (status) setAdminToken();
    else clearAdminToken();
    set({ isAdmin: status });
  },

  setPreviewMode: (mode) => set({ previewMode: mode }),

  setKicked: (v) => set({ isKicked: v }),
  setNotificationUnreadCount: (n) => set({ notificationUnreadCount: n }),
}));
