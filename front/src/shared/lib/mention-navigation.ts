import { useRouter } from "next/navigation";
import type { Mention } from "@/shared/types/notification";

/**
 * Navigates to the exact location of a mention
 * @param mention The mention to navigate to
 * @param router Next.js router instance
 */
export function navigateToMention(mention: Mention, router: ReturnType<typeof useRouter>) {
  const url = buildMentionURL(mention);
  if (url) {
    router.push(url);
    
    // Scroll to the specific element after navigation
    setTimeout(() => {
      scrollToMentionElement(mention);
      highlightMentionElement(mention);
    }, 100);
  }
}

/**
 * Builds the URL for a mention based on its type and metadata
 * @param mention The mention to build URL for
 * @returns The URL string or null if not applicable
 */
export function buildMentionURL(mention: Mention): string | null {
  switch (mention.type) {
    case "chat":
      if (mention.metadata?.chatId) {
        return `/chats/${mention.metadata.chatId}`;
      }
      break;
      
    case "comment":
      if (mention.metadata?.postId) {
        const url = `/posts/${mention.metadata.postId}`;
        if (mention.metadata?.commentId) {
          return `${url}#comment-${mention.metadata.commentId}`;
        }
        return url;
      }
      break;
      
    case "post":
      if (mention.metadata?.postId) {
        return `/posts/${mention.metadata.postId}`;
      }
      break;
      
    case "story":
      if (mention.metadata?.storyId) {
        return `/stories/${mention.metadata.storyId}`;
      }
      break;
      
    case "room":
      if (mention.metadata?.roomId) {
        return `/rooms/${mention.metadata.roomId}`;
      }
      break;
      
    case "community":
      if (mention.metadata?.communityId) {
        return `/communities/${mention.metadata.communityId}`;
      }
      break;
      
    case "project":
      if (mention.metadata?.projectId) {
        return `/content/projects/${mention.metadata.projectId}`;
      }
      break;
      
    case "ai_collaboration":
      if (mention.metadata?.projectId) {
        return `/projects/${mention.metadata.projectId}/collaboration`;
      }
      break;
  }
  
  return null;
}

/**
 * Scrolls to the specific element mentioned
 * @param mention The mention to scroll to
 */
function scrollToMentionElement(mention: Mention) {
  let elementId: string | null = null;
  
  switch (mention.type) {
    case "comment":
      if (mention.metadata?.commentId) {
        elementId = `comment-${mention.metadata.commentId}`;
      }
      break;
    case "post":
      if (mention.metadata?.postId) {
        elementId = `post-${mention.metadata.postId}`;
      }
      break;
    case "story":
      if (mention.metadata?.storyId) {
        elementId = `story-${mention.metadata.storyId}`;
      }
      break;
  }
  
  if (elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

/**
 * Highlights the mentioned element temporarily
 * @param mention The mention to highlight
 */
function highlightMentionElement(mention: Mention) {
  let elementId: string | null = null;
  
  switch (mention.type) {
    case "comment":
      if (mention.metadata?.commentId) {
        elementId = `comment-${mention.metadata.commentId}`;
      }
      break;
    case "post":
      if (mention.metadata?.postId) {
        elementId = `post-${mention.metadata.postId}`;
      }
      break;
  }
  
  if (elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      // Add highlight class
      element.classList.add("mention-highlight");
      
      // Remove highlight after 3 seconds
      setTimeout(() => {
        element.classList.remove("mention-highlight");
      }, 3000);
    }
  }
}

/**
 * Gets the mention type label for display
 * @param type The mention type
 * @returns Human-readable label
 */
export function getMentionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    chat: "in a chat",
    comment: "in a comment",
    post: "in a post",
    story: "in a story",
    room: "in a room",
    community: "in a community",
    project: "in a project",
    ai_collaboration: "in AI collaboration",
  };
  
  return labels[type] || "";
}
