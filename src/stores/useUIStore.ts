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

  // Toast
  toasts: ToastMessage[];

  // Admin & preview
  isAdmin: boolean;
  previewMode: GradeLevel | null;

  // Access screens
  isKicked: boolean;

  // Notification badge
  notificationUnreadCount: number;

  // Thêm cờ Fullscreen cho bài mô phỏng
  isSimulationFullscreen: boolean;

  // Actions
  setSettingsOpen: (v: boolean) => void;
  setMobileMenuOpen: (v: boolean) => void;

  showToast: (message: string, type?: ToastMessage['type'], duration?: number) => void;
  removeToast: (id: string) => void;

  toggleAdmin: (status: boolean) => void;
  setPreviewMode: (mode: GradeLevel | null) => void;

  setKicked: (v: boolean) => void;
  setNotificationUnreadCount: (n: number) => void;
  setSimulationFullscreen: (v: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  isSettingsOpen: false,
  isMobileMenuOpen: false,

  toasts: [],

  isAdmin: verifyAdminToken(),
  previewMode: null,

  isKicked: false,
  notificationUnreadCount: 0,
  isSimulationFullscreen: false,

  setSettingsOpen: (v) => set({ isSettingsOpen: v }),
  setMobileMenuOpen: (v) => set({ isMobileMenuOpen: v }),

  showToast: (message, type = 'success', _duration = 4000) => {
    // Timer auto-dismiss được xử lý bởi Toast component (tránh 2 timer chạy song song)
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
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
  setSimulationFullscreen: (v) => set({ isSimulationFullscreen: v }),
}));
