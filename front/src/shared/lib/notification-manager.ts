import type { Notification } from "@/shared/types/notification";

export class NotificationManager {
  private audioContext: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private pushEnabled: boolean = false;

  constructor() {
    this.initAudioContext();
    this.checkNotificationPermission();
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.log("AudioContext not supported");
    }
  }

  private async checkNotificationPermission() {
    if (!("Notification" in window)) {
      return;
    }

    if (Notification.permission === "granted") {
      this.pushEnabled = true;
    } else if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      this.pushEnabled = permission === "granted";
    }
  }

  /**
   * Play notification sound with premium audio
   */
  playNotificationSound(type: "mention" | "like" | "comment" | "follow" | "system" = "system") {
    if (!this.soundEnabled) {
      return;
    }

    try {
      const audio = new Audio(`/sounds/${type}-notification.mp3`);
      audio.volume = 0.5;
      audio.play().catch((error) => {
        console.log("Failed to play notification sound:", error);
      });
    } catch (error) {
      console.log("Failed to create audio element:", error);
    }
  }

  /**
   * Show browser notification with premium styling
   */
  showBrowserNotification(notification: Notification) {
    if (!this.pushEnabled || !("Notification" in window)) {
      return;
    }

    const notificationOptions: NotificationOptions = {
      body: notification.body,
      icon: "/icons/notification-icon.png",
      badge: "/icons/badge-icon.png",
      tag: notification.id,
      requireInteraction: false,
      silent: false,
    };

    // Add vibration pattern for mobile
    if ("vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    const browserNotification = new Notification(notification.title, notificationOptions);

    // Click handler to navigate to the notification
    browserNotification.onclick = () => {
      window.focus();
      if (notification.actionUrl) {
        window.location.href = notification.actionUrl;
      }
      browserNotification.close();
    };

    // Auto-close after 5 seconds
    setTimeout(() => {
      browserNotification.close();
    }, 5000);
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission(): Promise<boolean> {
    if (!("Notification" in window)) {
      return false;
    }

    if (Notification.permission === "granted") {
      this.pushEnabled = true;
      return true;
    }

    if (Notification.permission === "denied") {
      return false;
    }

    const permission = await Notification.requestPermission();
    this.pushEnabled = permission === "granted";
    return this.pushEnabled;
  }

  /**
   * Toggle sound notifications
   */
  toggleSound(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  /**
   * Toggle push notifications
   */
  togglePush(enabled: boolean) {
    this.pushEnabled = enabled;
  }

  /**
   * Check if push notifications are enabled
   */
  isPushEnabled(): boolean {
    return this.pushEnabled;
  }

  /**
   * Check if sound is enabled
   */
  isSoundEnabled(): boolean {
    return this.soundEnabled;
  }
}

// Singleton instance
export const notificationManager = new NotificationManager();
