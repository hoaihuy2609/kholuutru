// src/utils/pushSubscription.ts

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/**
 * Convert VAPID key từ Base64 URL-safe string sang Uint8Array
 * (Web Push API yêu cầu format này)
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Đăng ký Service Worker + Push Subscription
 * Trả về PushSubscription object (chứa endpoint + keys)
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push] Browser không hỗ trợ Web Push');
    return null;
  }

  if (!VAPID_PUBLIC_KEY) {
    console.error('[Push] VITE_VAPID_PUBLIC_KEY chưa được cấu hình');
    return null;
  }

  // Bước 1: Đăng ký Service Worker TRƯỚC (bắt buộc phải có SW trước khi subscribe)
  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
    await navigator.serviceWorker.ready;
  } catch (err) {
    console.error('[Push] Đăng ký Service Worker thất bại:', err);
    return null;
  }

  // Bước 2: Xin quyền notification (phải có user gesture khi gọi hàm này)
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('[Push] User từ chối notification permission:', permission);
    return null;
  }

  // Bước 3: Subscribe push
  try {
    const existing = await registration.pushManager.getSubscription();
    if (existing) return existing; // Đã subscribe rồi, dùng lại

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    return subscription;
  } catch (err) {
    console.error('[Push] Subscribe failed:', err);
    return null;
  }
}

/**
 * Lấy subscription hiện tại (nếu đã đăng ký trước đó)
 */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/**
 * Hủy subscription (unsubscribe)
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  const subscription = await getExistingSubscription();
  if (!subscription) return true;
  return subscription.unsubscribe();
}

/**
 * Chuyển PushSubscription thành JSON để lưu vào DB
 */
export function serializeSubscription(sub: PushSubscription): {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} {
  const keys = sub.toJSON().keys!;
  return {
    endpoint: sub.endpoint,
    keys: {
      p256dh: keys.p256dh!,
      auth: keys.auth!,
    },
  };
}
