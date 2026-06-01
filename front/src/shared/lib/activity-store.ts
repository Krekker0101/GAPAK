import { useCallback, useEffect, useState } from "react";

export type ActivityComment = {
  id: string;
  text: string;
  createdAt: string;
};

export type ActivityState = {
  likedPostIds: string[];
  savedPostIds: string[];
  repostedPostIds: string[];
  viewedPostIds: string[];
  commentsByPostId: Record<string, ActivityComment[]>;
};

const storageKey = "gapak-local-activity-v1";

const createEmptyState = (): ActivityState => ({
  likedPostIds: [],
  savedPostIds: [],
  repostedPostIds: [],
  viewedPostIds: [],
  commentsByPostId: {},
});

function readState(): ActivityState {
  if (typeof window === "undefined") {
    return createEmptyState();
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return createEmptyState();
    }

    const parsed = JSON.parse(raw) as Partial<ActivityState>;

    return {
      likedPostIds: Array.isArray(parsed.likedPostIds) ? parsed.likedPostIds : [],
      savedPostIds: Array.isArray(parsed.savedPostIds) ? parsed.savedPostIds : [],
      repostedPostIds: Array.isArray(parsed.repostedPostIds) ? parsed.repostedPostIds : [],
      viewedPostIds: Array.isArray(parsed.viewedPostIds) ? parsed.viewedPostIds : [],
      commentsByPostId: parsed.commentsByPostId && typeof parsed.commentsByPostId === "object" ? parsed.commentsByPostId : {},
    };
  } catch {
    return createEmptyState();
  }
}

function writeState(next: ActivityState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // Ignore storage quota or access errors to keep the UI resilient.
  }
}

type Listener = () => void;

const listeners = new Set<Listener>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function updateState(mutator: (current: ActivityState) => ActivityState) {
  const current = readState();
  const next = mutator(current);

  if (JSON.stringify(current) === JSON.stringify(next)) {
    return;
  }

  writeState(next);
  notifyListeners();
}

export function subscribeActivity(listener: Listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getActivitySnapshot() {
  return readState();
}

export function markPostViewed(postId: string) {
  if (!postId) {
    return;
  }

  updateState((current) => {
    if (current.viewedPostIds.includes(postId)) {
      return current;
    }

    return {
      ...current,
      viewedPostIds: [...current.viewedPostIds, postId],
    };
  });
}

export function toggleLike(postId: string) {
  if (!postId) {
    return;
  }

  updateState((current) => ({
    ...current,
    likedPostIds: current.likedPostIds.includes(postId)
      ? current.likedPostIds.filter((entry) => entry !== postId)
      : [...current.likedPostIds, postId],
  }));
}

export function toggleSave(postId: string) {
  if (!postId) {
    return;
  }

  updateState((current) => ({
    ...current,
    savedPostIds: current.savedPostIds.includes(postId)
      ? current.savedPostIds.filter((entry) => entry !== postId)
      : [...current.savedPostIds, postId],
  }));
}

export function toggleRepost(postId: string) {
  if (!postId) {
    return;
  }

  updateState((current) => ({
    ...current,
    repostedPostIds: current.repostedPostIds.includes(postId)
      ? current.repostedPostIds.filter((entry) => entry !== postId)
      : [...current.repostedPostIds, postId],
  }));
}

function createCommentId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `comment-${Math.random().toString(36).slice(2, 10)}`;
}

export function addComment(postId: string, text: string) {
  const trimmed = text.trim();
  if (!postId || !trimmed) {
    return;
  }

  updateState((current) => ({
    ...current,
    commentsByPostId: {
      ...current.commentsByPostId,
      [postId]: [
        ...(current.commentsByPostId[postId] ?? []),
        {
          id: createCommentId(),
          text: trimmed,
          createdAt: new Date().toISOString(),
        },
      ],
    },
  }));
}

export function useActivityStore() {
  const [state, setState] = useState<ActivityState>(createEmptyState);

  useEffect(() => {
    const sync = () => setState(readState());
    sync();

    return subscribeActivity(sync);
  }, []);

  const toggleLikeAction = useCallback((postId: string) => toggleLike(postId), []);
  const toggleSaveAction = useCallback((postId: string) => toggleSave(postId), []);
  const toggleRepostAction = useCallback((postId: string) => toggleRepost(postId), []);
  const markViewedAction = useCallback((postId: string) => markPostViewed(postId), []);
  const addCommentAction = useCallback((postId: string, text: string) => addComment(postId, text), []);

  return {
    state,
    likedPostIds: state.likedPostIds,
    savedPostIds: state.savedPostIds,
    repostedPostIds: state.repostedPostIds,
    viewedPostIds: state.viewedPostIds,
    commentsByPostId: state.commentsByPostId,
    toggleLike: toggleLikeAction,
    toggleSave: toggleSaveAction,
    toggleRepost: toggleRepostAction,
    markViewed: markViewedAction,
    addComment: addCommentAction,
  };
}
