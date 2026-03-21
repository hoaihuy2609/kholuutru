import { ScheduleItem } from '../../types';

// ── Quản lý nhắc nhở lịch học bằng Browser Notification API ──
// Chỉ hoạt động khi app đang mở (không phải Web Push).

const REMINDER_MINUTES_BEFORE = 5; // Nhắc trước 5 phút
let activeTimers: ReturnType<typeof setTimeout>[] = [];

/**
 * Yêu cầu quyền notification từ browser.
 * Trả về true nếu được granted.
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
};

/**
 * Kiểm tra trạng thái permission hiện tại.
 */
export const getNotificationPermission = (): NotificationPermission | 'unsupported' => {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

/**
 * Hiển thị notification nhắc nhở với thông tin lịch học.
 */
const showReminder = (schedule: ScheduleItem) => {
  if (Notification.permission !== 'granted') return;

  const title = `📚 Sắp đến giờ học!`;
  const body = `${schedule.title}\n${schedule.start_time} - ${schedule.end_time}${schedule.description ? `\n${schedule.description}` : ''}`;

  try {
    const notification = new Notification(title, {
      body,
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      tag: `schedule-${schedule.id}`, // Tránh duplicate
      requireInteraction: false,
      silent: false,
    });

    // Tự đóng sau 8 giây
    setTimeout(() => notification.close(), 8000);

    // Click vào notification → focus app
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Silent fallback — một số browser không hỗ trợ Notification constructor
  }
};

/**
 * Tính số milliseconds từ bây giờ đến thời điểm cần nhắc.
 * Trả về -1 nếu đã qua giờ nhắc.
 */
const getDelayMs = (dateStr: string, timeStr: string, minutesBefore: number): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const scheduleDate = new Date(dateStr);
  scheduleDate.setHours(hours, minutes, 0, 0);

  // Trừ đi thời gian nhắc trước
  const reminderTime = new Date(scheduleDate.getTime() - minutesBefore * 60 * 1000);
  const now = new Date();
  const delayMs = reminderTime.getTime() - now.getTime();

  return delayMs > 0 ? delayMs : -1;
};

/**
 * Lên lịch nhắc nhở cho tất cả schedule items hôm nay.
 * Gọi hàm này khi load xong danh sách schedules.
 * Tự động clear timers cũ nếu gọi lại.
 */
export const scheduleReminders = (schedules: ScheduleItem[]): number => {
  // Clear existing timers
  clearAllReminders();

  if (Notification.permission !== 'granted') return 0;

  // Lọc chỉ lấy schedule hôm nay
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  // Cũng check bằng local date format
  const todayLocal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const todaySchedules = schedules.filter(s =>
    s.date === todayStr || s.date === todayLocal
  );

  let count = 0;
  for (const schedule of todaySchedules) {
    const delayMs = getDelayMs(schedule.date, schedule.start_time, REMINDER_MINUTES_BEFORE);
    if (delayMs > 0) {
      const timer = setTimeout(() => showReminder(schedule), delayMs);
      activeTimers.push(timer);
      count++;
    }
  }

  return count;
};

/**
 * Hủy tất cả timers đang hoạt động.
 */
export const clearAllReminders = () => {
  activeTimers.forEach(timer => clearTimeout(timer));
  activeTimers = [];
};
