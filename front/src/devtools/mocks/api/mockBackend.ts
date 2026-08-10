/**
 * GAPAK Mock Backend Simulator
 * Provides instant preview endpoints for testing Single-flight Refresh Deduplication,
 * Authentication, CSRF, and User Management in the preview environment.
 */

import { AuthSession, UserProfile } from '../../../shared/types';
import {
  CURRENT_USER,
  SAMPLE_USERS,
  INITIAL_POSTS,
  INITIAL_STORY_GROUPS,
  INITIAL_CONNECTION_REQUESTS,
  INITIAL_SUBSCRIPTIONS,
  INITIAL_HIGHLIGHTS,
} from './socialMockData';
import { Post, Comment, Story, MediaUploadItem } from '../../../shared/types';

let mockRefreshToken = 'mock_refresh_token_xyz123';
let mockAccessToken = 'mock_access_token_abc789';
let refreshCount = 0;

let postsStore: Post[] = [...INITIAL_POSTS];
let storiesStore = [...INITIAL_STORY_GROUPS];
let connectionRequestsStore = [...INITIAL_CONNECTION_REQUESTS];
let subscriptionsStore = [...INITIAL_SUBSCRIPTIONS];

export const MOCK_USER: UserProfile = CURRENT_USER;

export const mockBackendHandler = async (
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: unknown
): Promise<{ status: number; data: unknown } | null> => {
  // Delay simulation
  await new Promise((r) => setTimeout(r, 120));

  // 1. Auth Refresh endpoint
  if (url.endsWith('/api/auth/refresh') && method === 'POST') {
    refreshCount++;
    mockAccessToken = `mock_access_token_v${refreshCount}_${Date.now()}`;
    return {
      status: 200,
      data: {
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresAt: Date.now() + 3600 * 1000,
        user: MOCK_USER,
        _refreshCount: refreshCount,
      },
    };
  }

  // 2. Auth Login
  if (url.endsWith('/api/auth/login') && method === 'POST') {
    const { email, password } = (body as any) || {};
    if (password === 'invalid') {
      return {
        status: 401,
        data: { error: { message: 'Invalid credentials provided', code: 'INVALID_CREDENTIALS', status: 401 } },
      };
    }
    return {
      status: 200,
      data: {
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresAt: Date.now() + 3600 * 1000,
        user: { ...MOCK_USER, email: email || MOCK_USER.email },
      },
    };
  }

  // 3. Auth Register / Anonymous
  if (url.endsWith('/api/auth/register') && method === 'POST') {
    return {
      status: 201,
      data: {
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresAt: Date.now() + 3600 * 1000,
        user: MOCK_USER,
      },
    };
  }

  if (url.endsWith('/api/auth/register-anonymous') && method === 'POST') {
    const anonUser: UserProfile = {
      ...MOCK_USER,
      id: `usr_anon_${Math.random().toString(36).substring(2, 7)}`,
      username: 'anonymous_guest',
      displayName: 'Guest User',
      isAnonymous: true,
      role: 'guest',
    };
    return {
      status: 201,
      data: {
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresAt: Date.now() + 3600 * 1000,
        user: anonUser,
      },
    };
  }

  // 4. Test endpoint
  if (url.endsWith('/api/test/requires-auth') && method === 'GET') {
    const authHeader = headers['Authorization'] || headers['authorization'];
    if (!authHeader || authHeader.includes('invalid') || authHeader.includes('expired')) {
      return {
        status: 401,
        data: { error: { message: 'Access token expired', code: 'TOKEN_EXPIRED', status: 401 } },
      };
    }
    return {
      status: 200,
      data: {
        message: 'Protected resource accessed successfully!',
        tokenUsed: authHeader,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // 5. CSRF Token endpoint
  if (url.endsWith('/api/auth/csrf') && method === 'GET') {
    return {
      status: 200,
      data: { csrfToken: `csrf_${Math.random().toString(36).substring(2, 10)}` },
    };
  }

  // 6. User Profile
  if (url.endsWith('/api/users/me') && method === 'GET') {
    return {
      status: 200,
      data: CURRENT_USER,
    };
  }

  // --- SOCIAL ENDPOINTS ---

  // Posts Feed (GET /api/posts/feed)
  if (url.includes('/api/posts/feed') && method === 'GET') {
    return {
      status: 200,
      data: {
        posts: postsStore.filter((p) => p.contentType !== 'clip'),
        nextCursor: null,
        total: postsStore.length,
      },
    };
  }

  // Posts Clips (GET /api/posts/clips)
  if (url.includes('/api/posts/clips') && method === 'GET') {
    return {
      status: 200,
      data: {
        clips: postsStore.filter((p) => p.contentType === 'clip'),
        nextCursor: null,
      },
    };
  }

  // Post Creation (POST /api/posts)
  if (url.endsWith('/api/posts') && method === 'POST') {
    const payload = body as Partial<Post>;
    const newPost: Post = {
      id: `pst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      author: CURRENT_USER,
      body: payload.body || '',
      media: payload.media || [],
      contentType: payload.contentType || 'standard',
      privacy: payload.privacy || 'PUBLIC',
      isInTrustedCircle: payload.privacy === 'TRUSTED_CIRCLE',
      expiresAt: payload.expiresAt,
      oneTimeViewed: false,
      likesCount: 0,
      likedByMe: false,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: new Date().toISOString(),
      comments: [],
      audienceTags: payload.audienceTags || [],
    };
    postsStore = [newPost, ...postsStore];
    return {
      status: 201,
      data: newPost,
    };
  }

  // Post Optimistic Like / Unlike
  if (url.match(/\/api\/posts\/[^/]+\/like$/)) {
    const postId = url.split('/')[3];
    const post = postsStore.find((p) => p.id === postId);
    if (post) {
      if (method === 'POST') {
        post.likedByMe = true;
        post.likesCount += 1;
      } else if (method === 'DELETE') {
        post.likedByMe = false;
        post.likesCount = Math.max(0, post.likesCount - 1);
      }
      return { status: 200, data: { success: true, likesCount: post.likesCount, likedByMe: post.likedByMe } };
    }
  }

  // One-time post view trigger
  if (url.match(/\/api\/posts\/[^/]+\/one-time\/view$/) && method === 'POST') {
    const postId = url.split('/')[3];
    const post = postsStore.find((p) => p.id === postId);
    if (post) {
      post.oneTimeViewed = true;
      return { status: 200, data: { success: true, post } };
    }
  }

  // Add Comment
  if (url.match(/\/api\/posts\/[^/]+\/comments$/) && method === 'POST') {
    const postId = url.split('/')[3];
    const { body: commentBody, parentId } = (body as any) || {};
    const post = postsStore.find((p) => p.id === postId);
    if (post) {
      const newComment: Comment = {
        id: `cmt_${Date.now()}`,
        postId,
        parentId,
        author: CURRENT_USER,
        body: commentBody || '',
        likesCount: 0,
        likedByMe: false,
        createdAt: new Date().toISOString(),
        replies: [],
      };
      if (parentId) {
        const findAndInsertReply = (comments: Comment[]): boolean => {
          for (const c of comments) {
            if (c.id === parentId) {
              c.replies = c.replies || [];
              c.replies.push(newComment);
              return true;
            }
            if (c.replies && findAndInsertReply(c.replies)) return true;
          }
          return false;
        };
        findAndInsertReply(post.comments);
      } else {
        post.comments.unshift(newComment);
      }
      post.commentsCount += 1;
      return { status: 201, data: newComment };
    }
  }

  // Stories List & Creation
  if (url.includes('/api/stories')) {
    if (method === 'GET') {
      return { status: 200, data: storiesStore };
    }
    if (method === 'POST' && url.endsWith('/api/stories')) {
      const payload = body as Partial<Story>;
      const newStory: Story = {
        id: `str_${Date.now()}`,
        author: CURRENT_USER,
        mediaUrl: payload.mediaUrl || 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
        mediaType: payload.mediaType || 'image',
        durationSeconds: payload.durationSeconds || 5,
        privacy: payload.privacy || 'PUBLIC',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        hasViewed: true,
        viewsCount: 0,
        reactions: [],
      };
      const myGroup = storiesStore.find((g) => g.user.id === CURRENT_USER.id);
      if (myGroup) {
        myGroup.stories.unshift(newStory);
      } else {
        storiesStore.unshift({
          user: CURRENT_USER,
          hasUnseenStories: false,
          stories: [newStory],
        });
      }
      return { status: 201, data: newStory };
    }
  }

  // Story React & View
  if (url.match(/\/api\/stories\/[^/]+\/react$/) && method === 'POST') {
    const { emoji } = (body as any) || {};
    return { status: 200, data: { success: true, emoji } };
  }

  // User Profile By Username / ID
  if (url.includes('/api/users/') && method === 'GET') {
    const param = url.split('/api/users/')[1];
    if (param === 'alex_gapak' || param === 'usr_gapak_01') {
      return { status: 200, data: CURRENT_USER };
    }
    const foundUser = Object.values(SAMPLE_USERS).find((u) => u.username === param || u.id === param);
    if (foundUser) {
      return { status: 200, data: foundUser };
    }
    return { status: 200, data: SAMPLE_USERS.usr_elena };
  }

  // Connections API
  if (url.includes('/api/connections')) {
    if (method === 'GET') {
      return {
        status: 200,
        data: {
          requests: connectionRequestsStore,
          connections: Object.values(SAMPLE_USERS).filter((u) => u.connectionState === 'connected'),
          trustedCircle: Object.values(SAMPLE_USERS).filter((u) => u.isInTrustedCircle),
        },
      };
    }
  }

  // Subscriptions API
  if (url.includes('/api/subscriptions')) {
    if (method === 'GET') {
      return {
        status: 200,
        data: {
          subscriptions: subscriptionsStore,
          followers: [SAMPLE_USERS.usr_elena, SAMPLE_USERS.usr_marcus],
          following: [SAMPLE_USERS.usr_elena],
        },
      };
    }
    if (method === 'POST') {
      return { status: 200, data: { success: true } };
    }
  }

  // Media Upload Pipeline Simulation Endpoint
  if (url.includes('/api/media/upload/init') && method === 'POST') {
    return {
      status: 200,
      data: {
        uploadId: `upl_${Date.now()}`,
        chunkSize: 1024 * 512, // 512KB
        uploadUrl: '/api/media/upload/chunk',
      },
    };
  }

  return null; // Passthrough to actual network
};

export const getRefreshCount = () => refreshCount;

