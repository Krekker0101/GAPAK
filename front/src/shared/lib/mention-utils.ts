export interface MentionMatch {
  username: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Detects @mentions in text
 * @param text The text to search for mentions
 * @returns Array of mention matches with their positions
 */
export function detectMentions(text: string): MentionMatch[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: MentionMatch[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push({
      username: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return mentions;
}

/**
 * Converts @mentions to clickable profile links
 * @param text The text containing mentions
 * @returns HTML string with clickable mentions
 */
export function convertMentionsToLinks(text: string): string {
  return text.replace(/@(\w+)/g, '<a href="/@$1" class="text-blue-600 dark:text-blue-400 hover:underline font-medium">@$1</a>');
}

/**
 * Extracts all mentioned usernames from text
 * @param text The text to extract mentions from
 * @returns Array of usernames
 */
export function extractMentionedUsernames(text: string): string[] {
  const mentions = detectMentions(text);
  return mentions.map((m) => m.username);
}

/**
 * Checks if text contains any mentions
 * @param text The text to check
 * @returns True if mentions are present
 */
export function hasMentions(text: string): boolean {
  return /@\w+/.test(text);
}

/**
 * Gets the mention at the current cursor position
 * @param text The full text
 * @param cursorPosition The current cursor position
 * @returns The partial mention being typed (e.g., "@jo" -> "jo")
 */
export function getCurrentMention(text: string, cursorPosition: number): string | null {
  const textBeforeCursor = text.slice(0, cursorPosition);
  const lastAtIndex = textBeforeCursor.lastIndexOf("@");
  
  if (lastAtIndex === -1) {
    return null;
  }

  const mentionText = textBeforeCursor.slice(lastAtIndex + 1);
  
  // Check if there's a space after the @ (which would end the mention)
  if (mentionText.includes(" ")) {
    return null;
  }

  return mentionText;
}

/**
 * Replaces a mention in text with a clickable link
 * @param text The original text
 * @param username The username to replace
 * @param displayName The display name for the link
 * @returns Text with the mention replaced by a link
 */
export function replaceMentionWithLink(text: string, username: string, displayName: string): string {
  return text.replace(
    new RegExp(`@${username}`, "g"),
    `<a href="/@${username}" class="text-blue-600 dark:text-blue-400 hover:underline font-medium">@${displayName}</a>`
  );
}
