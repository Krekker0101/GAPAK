import { useEffect, useRef, useState, useCallback } from "react";
import type { Notification } from "@/shared/types/notification";

interface WebSocketNotificationHookOptions {
  onNotification?: (notification: Notification) => void;
  onMention?: (notification: Notification) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocketNotifications(options: WebSocketNotificationHookOptions = {} as WebSocketNotificationHookOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttempts = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  // Determine env vars (support Vite and legacy NEXT_PUBLIC_* for compatibility)
  let _env: any;
  try {
    _env = (import.meta as any).env;
  } catch (e) {
    _env = typeof process !== 'undefined' ? process.env : {};
  }
  const wsEnabled = (_env.VITE_PUBLIC_WS_ENABLED === "true") || (_env.NEXT_PUBLIC_WS_ENABLED === "true");

  const connect = useCallback(() => {
    if (!wsEnabled) {
      console.log("WebSocket notifications are disabled until backend is implemented");
      return;
    }

    // TODO: Replace with actual WebSocket URL
    const wsUrl = _env.VITE_PUBLIC_WS_URL || _env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws";
    
    try {
      const ws = new WebSocket(`${wsUrl}?token=${localStorage.getItem("auth_token")}`);
      
      ws.onopen = () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        reconnectAttempts.current = 0;
        options.onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "notification") {
            const notification = data.notification as Notification;
            
            // Increment unread count
            setUnreadCount((prev) => prev + 1);
            
            // Call appropriate callback
            if (notification.type === "mention") {
              options.onMention?.(notification);
            }
            options.onNotification?.(notification);
            
            // Play notification sound (optional)
            playNotificationSound();
            
            // Show browser notification if permitted
            showBrowserNotification(notification);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        options.onError?.(new Error("WebSocket connection error"));
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        options.onDisconnect?.();
        
        // Attempt to reconnect
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      options.onError?.(error as Error);
    }
  }, [options, wsEnabled]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    unreadCount,
    setUnreadCount,
  };
}

function playNotificationSound() {
  try {
    const audio = new Audio("/sounds/notification.mp3");
    audio.volume = 0.5;
    audio.play().catch((error) => {
      console.log("Failed to play notification sound:", error);
    });
  } catch (error) {
    console.log("Failed to create audio element:", error);
  }
}

function showBrowserNotification(notification: Notification) {
  if (!("Notification" in window)) {
    return;
  }

  if (Notification.permission === "granted") {
    new Notification(notification.title, {
      body: notification.body,
      icon: "/icons/notification-icon.png",
      badge: "/icons/badge-icon.png",
      tag: notification.id,
      requireInteraction: false,
    });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission();
  }
}
