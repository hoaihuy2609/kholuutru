// src/services/pushNotificationService.ts

import { supabase } from '../lib/supabase';
import { getActivatedPhone } from '../utils/phone';
import {
  subscribeToPush,
  getExistingSubscription,
  unsubscribeFromPush,
  serializeSubscription,
} from '../utils/pushSubscription';

/**
 * Đăng ký push notification + lưu subscription vào Supabase
 */
export async function registerPushNotification(): Promise<boolean> {
  const phone = getActivatedPhone();
  if (!phone) return false;

  // Kiểm tra xem đã subscribe chưa
  const existing = await getExistingSubscription();
  if (existing) {
    const { endpoint, keys } = serializeSubscription(existing);
    await supabase.rpc('upsert_push_subscription', {
      p_phone: phone,
      p_endpoint: endpoint,
      p_p256dh: keys.p256dh,
      p_auth: keys.auth,
    });
    return true;
  }

  // Chưa subscribe → đăng ký mới
  const subscription = await subscribeToPush();
  if (!subscription) return false;

  const { endpoint, keys } = serializeSubscription(subscription);
  const { error } = await supabase.rpc('upsert_push_subscription', {
    p_phone: phone,
    p_endpoint: endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
  });

  if (error) {
    console.error('[Push] Lưu subscription thất bại:', error);
    return false;
  }

  return true;
}

/**
 * Hủy đăng ký push notification
 */
export async function unregisterPushNotification(): Promise<boolean> {
  const existing = await getExistingSubscription();
  if (existing) {
    const { endpoint } = serializeSubscription(existing);
    await supabase.rpc('admin_remove_push_subscription', {
      p_endpoint: endpoint,
    });
  }
  return unsubscribeFromPush();
}

/**
 * Kiểm tra trạng thái push notification
 */
export async function getPushStatus(): Promise<
  'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'
> {
  if (!('PushManager' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const sub = await getExistingSubscription();
  return sub ? 'subscribed' : 'unsubscribed';
}
