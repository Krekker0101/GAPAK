import type { MentionType } from "@/shared/types/notification";

export interface MentionPrivacySettings {
  allowMentionsFrom: "everyone" | "followers" | "none";
  allowMentionsIn: MentionType[];
  notifyOnMention: boolean;
  showMentionCount: boolean;
}

export const DEFAULT_PRIVACY_SETTINGS: MentionPrivacySettings = {
  allowMentionsFrom: "everyone",
  allowMentionsIn: ["chat", "comment", "post", "story", "room", "community"],
  notifyOnMention: true,
  showMentionCount: true,
};

/**
 * Check if a user can be mentioned based on privacy settings
 */
export function canUserBeMentioned(
  privacySettings: MentionPrivacySettings,
  isFollower: boolean,
  mentionType: MentionType
): boolean {
  // Check if mentions are allowed at all
  if (privacySettings.allowMentionsFrom === "none") {
    return false;
  }

  // Check if mentions are only allowed from followers
  if (privacySettings.allowMentionsFrom === "followers" && !isFollower) {
    return false;
  }

  // Check if mentions are allowed in this context
  if (!privacySettings.allowMentionsIn.includes(mentionType)) {
    return false;
  }

  return true;
}

/**
 * Check if a user has permission to view content with mentions
 */
export function canViewMentionedContent(
  contentPrivacy: "public" | "followers" | "private",
  isFollower: boolean,
  isAuthor: boolean
): boolean {
  if (isAuthor) {
    return true;
  }

  if (contentPrivacy === "public") {
    return true;
  }

  if (contentPrivacy === "followers" && isFollower) {
    return true;
  }

  return false;
}

/**
 * Filter mentions based on privacy settings
 */
export function filterMentionsByPrivacy(
  mentions: Array<{ type: MentionType; isPublic: boolean }>,
  privacySettings: MentionPrivacySettings
): Array<{ type: MentionType; isPublic: boolean }> {
  return mentions.filter((mention) => {
    // Check if mentions are allowed in this context
    if (!privacySettings.allowMentionsIn.includes(mention.type)) {
      return false;
    }

    // For private mentions, only show if user has permission
    if (!mention.isPublic && privacySettings.allowMentionsFrom !== "everyone") {
      return false;
    }

    return true;
  });
}

/**
 * Validate mention privacy settings
 */
export function validatePrivacySettings(settings: Partial<MentionPrivacySettings>): boolean {
  if (settings.allowMentionsFrom && !["everyone", "followers", "none"].includes(settings.allowMentionsFrom)) {
    return false;
  }

  if (settings.allowMentionsIn) {
    const validTypes: MentionType[] = ["chat", "comment", "post", "story", "room", "community", "project", "ai_collaboration"];
    const hasInvalidType = settings.allowMentionsIn.some((type) => !validTypes.includes(type));
    if (hasInvalidType) {
      return false;
    }
  }

  return true;
}
