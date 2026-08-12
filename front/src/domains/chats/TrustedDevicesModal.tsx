/**
 * Trusted Devices & Security UI Modal
 * GAPAK Realtime E2EE Messenger
 *
 * Full device security management: trusted devices list, device identity key fingerprints,
 * signing key state, pre-key availability, device verification, revocation dialog, and security warnings.
 */

import React, { useState } from 'react';
import {
  Shield,
  Smartphone,
  Laptop,
  Monitor,
  CheckCircle2,
  AlertTriangle,
  Key,
  X,
  Trash2,
  Sparkles,
  QrCode,
} from 'lucide-react';
import { TrustedDevice } from '../../shared/types';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Badge,
  IconButton,
  ConfirmDialog,
} from '../../shared/design-system/primitives';
import { useToast } from '../../shared/ux/ToastContext';

interface TrustedDevicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: TrustedDevice[];
  onRegisterDevice: () => void;
  isRegistering?: boolean;
  onRevokeDevice: (deviceId: string) => void;
  onVerifyDevice: (deviceId: string) => void;
}

export const TrustedDevicesModal: React.FC<TrustedDevicesModalProps> = ({
  isOpen,
  onClose,
  devices,
  onRegisterDevice,
  isRegistering = false,
  onRevokeDevice,
  onVerifyDevice,
}) => {
  const toast = useToast();
  const [selectedDevice, setSelectedDevice] = useState<TrustedDevice | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [revokeTargetId, setRevokeTargetId] = useState<string | null>(null);

  const getDeviceIcon = (type: TrustedDevice['type']) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-5 h-5 text-indigo-400" />;
      case 'desktop':
        return <Laptop className="w-5 h-5 text-purple-400" />;
      default:
        return <Monitor className="w-5 h-5 text-cyan-400" />;
    }
  };

  const handleConfirmRevoke = () => {
    if (revokeTargetId) {
      onRevokeDevice(revokeTargetId);
      toast.warning('Device Revoked', 'Cryptographic session keys for this device have been destroyed.');
      setRevokeTargetId(null);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-[var(--radius-xl)]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-primary">Trusted Devices & Identity Keys</h3>
              <p className="text-xs text-tertiary">Zero-Trust E2EE Device Management & Safety Numbers</p>
            </div>
          </div>
        </ModalHeader>

        <ModalBody className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Security Alert Banner */}
          <div className="p-3 bg-indigo-950/40 border border-indigo-500/20 rounded-[var(--radius-xl)] flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-indigo-200">Encrypted Messaging Cryptographic Foundation</p>
              <p className="text-tertiary leading-relaxed">
                Each device has an authenticated cryptographic identity. Verification status is controlled by the GAPAK backend; this client does not invent a local trust decision.
              </p>
            </div>
          </div>

          {/* Devices List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-tertiary">
                Active Registered Devices ({devices.length})
              </h4>
              {!devices.some((device) => device.isCurrentDevice) && (
                <Button variant="primary" size="sm" onClick={onRegisterDevice} disabled={isRegistering} leftIcon={<Key className="w-4 h-4" />}>
                  {isRegistering ? 'Registering…' : 'Register this browser'}
                </Button>
              )}
            </div>

            {devices.map((device) => (
              <div
                key={device.id}
                className={`p-4 rounded-[var(--radius-xl)] border transition-all ${
                  device.isCurrentDevice
                    ? 'bg-indigo-950/20 border-indigo-500/30'
                    : 'bg-surface border-subtle hover:border-default'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-app border border-subtle rounded-[var(--radius-xl)]">
                      {getDeviceIcon(device.type)}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-primary">{device.name}</span>
                        {device.isCurrentDevice && <Badge variant="brand">This Device</Badge>}
                        {device.verificationStatus === 'VERIFIED' ? (
                          <Badge variant="success" dot>Verified Safety Numbers</Badge>
                        ) : (
                          <Badge variant={device.verificationStatus === 'CHANGED' || device.verificationStatus === 'REVOKED' ? 'danger' : 'warning'} dot>
                            {device.verificationStatus === 'UNVERIFIED' ? 'Unverified Key' : `${device.verificationStatus} Key`}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-tertiary pt-1 font-mono">
                        <div>
                          <span className="text-muted">Identity Key:</span>{' '}
                          <span className="text-secondary">{device.identityKeyFingerprint}</span>
                        </div>
                        <div>
                          <span className="text-muted">Signing Key:</span>{' '}
                          <span className="text-emerald-400">{device.signingKeyFingerprint}</span>
                        </div>
                        <div>
                          <span className="text-muted">Pre-keys Remaining:</span>{' '}
                          <span className={device.preKeysRemaining < 50 ? 'text-amber-400' : 'text-secondary'}>
                            {device.preKeysRemaining} / 100
                          </span>
                        </div>
                        <div>
                          <span className="text-muted">Last Active:</span>{' '}
                          <span>{new Date(device.lastActiveAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {!device.isCurrentDevice && (
                    <div className="flex items-center gap-1 shrink-0">
                      {(device.verificationStatus === 'UNVERIFIED' || device.verificationStatus === 'CHANGED' || device.verificationStatus === 'UNKNOWN') && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedDevice(device);
                            setShowVerifyModal(true);
                          }}
                        >
                          Verify
                        </Button>
                      )}
                      <IconButton
                        icon={<Trash2 className="w-4 h-4 text-rose-400" />}
                        ariaLabel="Revoke device"
                        onClick={() => setRevokeTargetId(device.id)}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Close Security Console
          </Button>
        </ModalFooter>
      </Modal>

      {/* Safety Numbers Verification Modal */}
      {selectedDevice && (
        <Modal isOpen={showVerifyModal} onClose={() => setShowVerifyModal(false)} size="md">
          <ModalHeader>
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-base text-primary">Verify Safety Numbers</h3>
            </div>
          </ModalHeader>
          <ModalBody className="space-y-4 text-center py-4">
            <p className="text-xs text-tertiary">
              Compare the device identity fingerprint through a verified out-of-band channel before trusting a new device. Full E2EE requires backend-authenticated key bundles and revocation.
            </p>

            <div className="p-6 bg-app border border-subtle rounded-[var(--radius-2xl)] inline-block">
              <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Device identity fingerprint</p>
              <p className="font-mono text-xs text-indigo-300 break-all max-w-sm">{selectedDevice.identityKeyFingerprint}</p>
            </div>

            <div className="p-3 bg-surface border border-subtle rounded-[var(--radius-xl)] font-mono text-sm tracking-widest text-indigo-300 font-bold">
              {selectedDevice.identityKeyFingerprint}
            </div>

            <Button
              variant="primary"
              fullWidth
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
              onClick={() => {
                onVerifyDevice(selectedDevice.id);
                toast.success('Verification requested', 'The server will record the device verification state.');
                setShowVerifyModal(false);
              }}
            >
              Mark Safety Numbers as Verified
            </Button>
          </ModalBody>
        </Modal>
      )}

      {/* Revoke Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!revokeTargetId}
        onClose={() => setRevokeTargetId(null)}
        onConfirm={handleConfirmRevoke}
        title="Revoke Device Access?"
        message="Revoking this device will destroy all shared E2EE ratchet sessions. This device will immediately lose ability to decrypt future messages."
      />
    </>
  );
};
