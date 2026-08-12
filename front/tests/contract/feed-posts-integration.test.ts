import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

test('Feed/Posts backend contract integration', () => {
  const api = read('src/domains/posts/api/postsApi.ts');
  const page = read('src/pages/FeedPage.tsx');
  const composer = read('src/domains/posts/PostComposer.tsx');
  const http = read('src/shared/api/httpClient.ts');
  const card = read('src/domains/posts/BackendPostCard.tsx');

  assert.ok(api.includes('/posts/feed'));
  assert.ok(api.includes('/posts/clips'));
  assert.ok(api.includes('/comments'));
  assert.ok(api.includes('/likes'));
  assert.ok(api.includes('/posts'));
  assert.ok(api.includes('/like'));
  assert.ok(api.includes('/posts/comments/'));
  assert.ok(!api.includes('/reject'));
  assert.ok(!api.includes('/offset'));

  assert.ok(api.includes('X-Next-Cursor'));
  assert.ok(page.includes('nextCursor'));
  assert.ok(!page.includes('offset'));
  assert.ok(http.includes('includeResponseMeta'));

  assert.ok(page.includes('new Set<string>()'));
  assert.ok(page.includes('seen.has(post.id)'));
  assert.ok(page.includes('isLiked: liked'));
  assert.ok(page.includes('likeCount'));
  assert.ok(page.includes("invalidateQueries({ queryKey: ['posts', 'feed']"));

  assert.ok(page.includes('content: text'));
  assert.ok(page.includes('parentCommentId: parentId'));
  assert.ok(!page.includes('body: text'));

  assert.ok(composer.includes("contentType === 'clip' ? 'CLIP' : 'POST'"));
  assert.ok(composer.includes('mediaFileIds'));


  assert.ok(card.includes('post.authorId'));
  assert.ok(card.includes('post.mediaFileIDs'));
  assert.ok(!card.includes('https://cdn'));
  assert.ok(!card.includes('fake'));
});
