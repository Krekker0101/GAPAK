/**
 * GAPAK Security Subcomponent: SecurityFlagsSection
 * Enterprise Security Policies & Automated Defense Flags
 */

import React from 'react';
import { Sliders, ShieldCheck, Globe, Bell, Lock, AlertOctagon } from 'lucide-react';
import { SecurityFlags } from '../../../shared/types/security';
import { SecurityService } from '../SecurityService';
import { Badge } from '../../../shared/design-system/primitives';

interface SecurityFlagsSectionProps {
  flags: SecurityFlags;
}

export const SecurityFlagsSection: React.FC<SecurityFlagsSectionProps> = ({ flags }) => {
  const flagItems = [
    {
      key: 'sessionStrictIpChecking' as const,
      label: 'Strict Geolocation & IP Subnet Checking',
      description: 'Automatically invalidate sessions if a request originates from an unrecognized IP range or distant geo-location.',
      icon: <Globe className="w-5 h-5 text-indigo-400" />,
      value: flags.sessionStrictIpChecking,
    },
    {
      key: 'unrecognizedDeviceAlerts' as const,
      label: 'Unrecognized Device Login Alerts',
      description: 'Dispatch immediate push and email alerts whenever a new user-agent logs into your GAPAK account.',
      icon: <Bell className="w-5 h-5 text-amber-400" />,
      value: flags.unrecognizedDeviceAlerts,
    },
    {
      key: 'enforce2FaForSensitiveActions' as const,
      label: 'Enforce 2FA Step-Up for Sensitive Operations',
      description: 'Require TOTP re-verification before revoking trust rooms, modifying API keys, or executing panic operations.',
      icon: <Lock className="w-5 h-5 text-emerald-400" />,
      value: flags.enforce2FaForSensitiveActions,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-[var(--radius-2xl)] bg-surface border border-subtle flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-primary flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            Security Flags & Policy Enforcement
          </h2>
          <p className="text-xs text-tertiary mt-0.5">
            Configure platform security behavior, strict access verification, and automated alert parameters.
          </p>
        </div>
      </div>

      {/* Flag Items List */}
      <div className="space-y-3">
        {flagItems.map((item) => (
          <div
            key={item.key}
            className="p-5 rounded-[var(--radius-2xl)] bg-surface border border-subtle flex items-center justify-between gap-4 hover:border-default transition-all"
          >
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-[var(--radius-xl)] bg-app border border-subtle shrink-0">
                {item.icon}
              </div>

              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-primary">{item.label}</h3>
                <p className="text-xs text-tertiary max-w-xl leading-relaxed">{item.description}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void SecurityService.toggleFlag(item.key)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-[var(--radius-pill)] border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                item.value ? 'bg-indigo-600' : 'bg-surface-muted'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-[var(--radius-pill)] bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  item.value ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
