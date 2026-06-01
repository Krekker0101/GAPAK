export type AdminOverview = {
  totalUsers: number;
  activeUsers: number;
  activeSessions: number;
  newUsers7d: number;
  admins: number;
  posts: number;
  trustRooms: number;
  securityEvents24h: number;
  signupTrend: { date: string; count: number }[];
  generatedAt: string;
};

export type AdminUser = {
  id: string;
  email?: string | null;
  username: string;
  displayName: string;
  role: "USER" | "MODERATOR" | "ADMIN" | "SECURITY_ANALYST";
  accountStatus: "ACTIVE" | "SUSPENDED" | "DELETED";
  isAnonymous: boolean;
  twoFactorEnabled: boolean;
  lastSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListAdminUsersResponse = {
  users: AdminUser[];
  total: number;
  limit: number;
  offset: number;
};

export type UpdateAdminUserRequest = {
  displayName?: string;
  role?: AdminUser["role"];
  accountStatus?: AdminUser["accountStatus"];
};

export type BuilderBlockType = "hero" | "feature" | "stats" | "cta";

export type BuilderBlock = {
  id: string;
  type: BuilderBlockType;
  props: Record<string, string | number | string[]>;
};

export type PageContent = {
  blocks: BuilderBlock[];
};

export type PageSummary = {
  id: string;
  slug: string;
  locale: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  version: number;
  updatedBy?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PageResponse = PageSummary & {
  content: PageContent;
};

export type ListPagesResponse = {
  pages: PageSummary[];
};

export type UpdatePageRequest = {
  locale: string;
  title: string;
  status: PageSummary["status"];
  content: PageContent;
};
