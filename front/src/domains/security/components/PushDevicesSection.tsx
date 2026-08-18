import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Trash2 } from 'lucide-react';
import type { PushDevice } from '../../../shared/api/backendContracts';
import { env } from '../../../shared/config/env';
import { PageError, PageLoading } from '../../../pages/common';
import { pushApi } from '../../notifications/api/pushApi';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const decodeBase64Url = (value: string): Uint8Array => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/g, '');
  if (!normalized || normalized.length % 4 === 1 || /[^A-Za-z0-9+/]/.test(normalized)) {
    throw new Error('The Web Push public key is not valid Base64URL.');
  }
  const output: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of normalized) {
    buffer = (buffer << 6) | BASE64_ALPHABET.indexOf(character);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(output);
};

const encodeBuffer = (buffer: ArrayBuffer | null): string => {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let encoded = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    encoded += BASE64_ALPHABET[first >> 2];
    encoded += BASE64_ALPHABET[((first & 0x03) << 4) | ((second ?? 0) >> 4)];
    encoded += second === undefined ? '=' : BASE64_ALPHABET[((second & 0x0f) << 2) | ((third ?? 0) >> 6)];
    encoded += third === undefined ? '=' : BASE64_ALPHABET[third & 0x3f];
  }
  return encoded;
};

const getBrowserDeviceId = (): string => {
  const storageKey = 'gapak.push.device-id';
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(storageKey, created);
  return created;
};

const unsubscribeMatchingBrowserSubscription = async (device: PushDevice): Promise<void> => {
  if (!device.endpoint || !('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription?.endpoint === device.endpoint) await subscription.unsubscribe();
};

export const PushDevicesSection: React.FC = () => {
  const queryClient = useQueryClient();
  const devices = useQuery({
    queryKey: ['push-devices'],
    queryFn: ({ signal }) => pushApi.list(signal),
  });

  const register = useMutation({
    mutationFn: async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('This browser does not support Web Push.');
      }
      if (!env.webPushPublicKey) {
        throw new Error('VITE_WEB_PUSH_PUBLIC_KEY is not configured for this deployment.');
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notification permission was not granted.');

      const registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeBase64Url(env.webPushPublicKey),
      });
      const json = subscription.toJSON();
      const endpoint = json.endpoint ?? subscription.endpoint;
      const publicKey = json.keys?.p256dh ?? encodeBuffer(subscription.getKey('p256dh'));
      const authKey = json.keys?.auth ?? encodeBuffer(subscription.getKey('auth'));
      if (!endpoint || !publicKey || !authKey) {
        throw new Error('The browser returned an incomplete push subscription.');
      }

      return pushApi.register({
        deviceId: getBrowserDeviceId(),
        platform: 'web',
        provider: 'webpush',
        endpoint,
        publicKey,
        authKey,
        ...(subscription.expirationTime
          ? { expiration: new Date(subscription.expirationTime).toISOString() }
          : {}),
      }, crypto.randomUUID());
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['push-devices'] }),
  });

  const revoke = useMutation({
    mutationFn: async (device: PushDevice) => {
      await pushApi.revoke(device.id, crypto.randomUUID());
      await unsubscribeMatchingBrowserSubscription(device);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['push-devices'] }),
  });

  if (devices.isPending) return <PageLoading label="Loading notification devices…" />;
  if (devices.isError) return <PageError error={devices.error} onRetry={() => void devices.refetch()} />;

  const active = devices.data.devices.filter((device) => !device.revokedAt);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-subtle bg-surface p-5">
        <div>
          <h2 className="flex items-center gap-2 font-bold">
            <BellRing size={19} className="text-indigo-400" />
            Push notification devices
          </h2>
          <p className="mt-1 text-xs text-muted">Browser subscriptions are registered with the backend Web Push outbox.</p>
        </div>
        <button
          type="button"
          disabled={register.isPending}
          onClick={() => register.mutate()}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {register.isPending ? 'Enabling…' : 'Enable this browser'}
        </button>
      </header>

      {register.isError && (
        <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-400">{register.error.message}</p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {active.map((device) => (
          <article key={device.id} className="rounded-2xl border border-subtle bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{device.platform} · {device.provider}</p>
                <p className="mt-1 break-all text-xs text-muted">{device.deviceId}</p>
                <p className="mt-2 text-xs text-muted">Registered {new Date(device.createdAt).toLocaleString()}</p>
              </div>
              <button
                type="button"
                disabled={revoke.isPending}
                aria-label="Revoke push device"
                onClick={() => revoke.mutate(device)}
                className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))}
        {!active.length && (
          <p className="rounded-2xl border border-dashed border-subtle p-8 text-center text-sm text-muted md:col-span-2">
            No active push devices.
          </p>
        )}
      </div>

      {revoke.isError && <p role="alert" className="text-sm text-rose-400">{revoke.error.message}</p>}
    </div>
  );
};
