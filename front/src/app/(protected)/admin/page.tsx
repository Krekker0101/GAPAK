"use client";

import { useMemo, useState } from "react";
import { BarChart3, FileText, ShieldCheck, UsersRound, Activity, RefreshCw } from "lucide-react";

import { AdminGuard } from "@/features/admin/components/admin-guard";
import { adminService } from "@/shared/api/services/admin.service";
import { LocaleLink } from "@/shared/i18n/locale-link";
import { useI18n } from "@/shared/i18n/provider";
import { useAsyncResource } from "@/shared/lib/hooks/use-async-resource";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import type { AdminUser } from "@/shared/types/admin";

const roles: AdminUser["role"][] = ["USER", "MODERATOR", "ADMIN", "SECURITY_ANALYST"];
const statuses: AdminUser["accountStatus"][] = ["ACTIVE", "SUSPENDED", "DELETED"];

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function UserRow({ user, onUpdated }: { user: AdminUser; onUpdated: () => void }) {
  const { t } = useI18n();
  const [role, setRole] = useState<AdminUser["role"]>(user.role);
  const [status, setStatus] = useState<AdminUser["accountStatus"]>(user.accountStatus);
  const [saving, setSaving] = useState(false);

  const dirty = role !== user.role || status !== user.accountStatus;

  async function save() {
    setSaving(true);
    try {
      await adminService.updateUser(user.id, { role, accountStatus: status });
      await onUpdated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3 border-b border-white/8 py-4 last:border-b-0 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_auto] xl:items-center">
      <div>
        <p className="font-medium">{user.displayName}</p>
        <p className="text-sm text-muted-foreground">
          @{user.username}
          {user.email ? ` · ${user.email}` : ""}
        </p>
      </div>
      <Select value={role} onValueChange={(value) => setRole(value as AdminUser["role"])}>
        <SelectTrigger className="h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {roles.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={(value) => setStatus(value as AdminUser["accountStatus"])}>
        <SelectTrigger className="h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statuses.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="text-sm text-muted-foreground">
        <p>{t("admin.joined")}: {formatDate(user.createdAt)}</p>
        <p>{t("admin.lastSeen")}: {formatDate(user.lastSeenAt)}</p>
      </div>
      <Button size="sm" onClick={() => void save()} disabled={!dirty || saving}>
        {saving ? t("common.saving") : t("common.save")}
      </Button>
    </div>
  );
}

function DashboardContent() {
  const { locale, t } = useI18n();
  const [search, setSearch] = useState("");
  const overview = useAsyncResource(() => adminService.overview(), []);
  const users = useAsyncResource(() => adminService.users({ search, limit: 20 }), [search]);
  const pages = useAsyncResource(() => adminService.pages(locale), [locale]);
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const metrics = overview.data
    ? [
        { label: t("admin.totalUsers"), value: overview.data.totalUsers, icon: UsersRound },
        { label: t("admin.activeUsers"), value: overview.data.activeUsers, icon: Activity },
        { label: t("admin.activeSessions"), value: overview.data.activeSessions, icon: ShieldCheck },
        { label: t("admin.newUsers7d"), value: overview.data.newUsers7d, icon: BarChart3 },
        { label: t("admin.securityEvents"), value: overview.data.securityEvents24h, icon: ShieldCheck },
        { label: t("admin.posts"), value: overview.data.posts, icon: FileText },
        { label: t("admin.rooms"), value: overview.data.trustRooms, icon: UsersRound },
        { label: t("admin.admins"), value: overview.data.admins, icon: ShieldCheck },
      ]
    : [];

  const maxTrend = Math.max(...(overview.data?.signupTrend.map((item) => item.count) ?? [1]), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">{t("admin.overview")}</p>
          <h1 className="mt-3 font-display text-4xl font-semibold md:text-5xl">{t("admin.title")}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{t("admin.subtitle")}</p>
        </div>
        <Button variant="outline" onClick={() => void Promise.all([overview.reload(), users.reload(), pages.reload()])}>
          <RefreshCw className="h-4 w-4" />
          {t("admin.refresh")}
        </Button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="p-5">
            <div className="mb-5 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{metric.label}</p>
              <metric.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="font-display text-4xl font-semibold">{numberFormatter.format(metric.value)}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-semibold">{t("admin.analytics")}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("admin.analyticsText")}</p>
            </div>
            <Badge variant="primary">Live</Badge>
          </div>
          <div className="mt-8 flex h-56 items-end gap-3">
            {(overview.data?.signupTrend ?? []).map((item) => (
              <div key={item.date} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-xl bg-primary/70 transition-all"
                  style={{ height: `${Math.max(10, (item.count / maxTrend) * 100)}%` }}
                  title={`${item.date}: ${item.count}`}
                />
                <span className="text-[10px] text-muted-foreground">{item.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold">{t("admin.userManagement")}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("admin.userManagementText")}</p>
            </div>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("admin.searchUsers")}
              className="md:max-w-xs"
            />
          </div>
          <div className="mt-5">
            {(users.data?.users ?? []).map((user) => (
              <UserRow key={user.id} user={user} onUpdated={users.reload} />
            ))}
            {!users.isLoading && users.data?.users.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground">{t("common.search")} · 0</p>
            ) : null}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="p-6">
          <h2 className="font-display text-2xl font-semibold">{t("admin.contentManagement")}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("admin.contentManagementText")}</p>
          <Button asChild className="mt-6" size="lg">
            <LocaleLink href="/admin/builder">{t("admin.openBuilder")}</LocaleLink>
          </Button>
        </Card>
        <Card className="p-6">
          <div className="grid gap-3">
            {(pages.data?.pages ?? []).map((page) => (
              <div key={page.id} className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{page.title}</p>
                    <Badge>{page.status}</Badge>
                    <Badge>{page.locale.toUpperCase()}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    /{page.slug} · {t("admin.updated")} {formatDate(page.updatedAt)}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <LocaleLink href={`/admin/builder?slug=${page.slug}&builderLocale=${page.locale}`}>{t("admin.openBuilder")}</LocaleLink>
                </Button>
              </div>
            ))}
            {!pages.isLoading && pages.data?.pages.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("builder.empty")}</p>
            ) : null}
          </div>
        </Card>
      </section>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminGuard>
      <DashboardContent />
    </AdminGuard>
  );
}
