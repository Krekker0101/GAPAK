import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

test('Stories use the real backend contract', () => {
  const api = read('src/domains/stories/api/storiesApi.ts');
  const page = read('src/domains/stories/StoriesPage.tsx');
  const viewer = read('src/domains/stories/StoryViewerModal.tsx');
  const composer = read('src/domains/stories/StoryComposerModal.tsx');
  const bar = read('src/domains/stories/StoryBar.tsx');

  for (const route of ['/stories/feed', '/stories/', '/viewers', '/reactions', '/highlight']) assert.ok(api.includes(route), route);
  assert.ok(api.includes("httpClient.delete<AcceptedResponse>"));
  assert.ok(!api.includes("'/stories/:storyId/view'"));
  assert.ok(!api.includes("'/stories/:storyId/reply'"));
  assert.ok(!page.includes('cursor'));
  assert.ok(page.includes('page: 1'));
  assert.ok(page.includes("story.status === 'ACTIVE'"));
  assert.ok(composer.includes('mediaFileId'));
  assert.ok(composer.includes('allowReplies'));
  assert.ok(composer.includes('allowReactions'));
  assert.ok(!composer.includes('durationSeconds'));
  assert.ok(!composer.includes('mediaUrl'));
  assert.ok(viewer.includes('storiesApi.get(story.id)'));
  assert.ok(viewer.includes("mediaApi.requestPlaybackGrant(story.mediaFileId, 'STORY')"));
  assert.ok(viewer.includes('storiesApi.viewers'));
  assert.ok(viewer.includes('storiesApi.highlight'));
  assert.ok(viewer.includes('storiesApi.delete'));
  assert.ok(!viewer.includes('onStoryReply'));
  assert.ok(!viewer.includes('onStoryView'));
  assert.ok(bar.includes('story.authorId'));
  assert.ok(!bar.includes('UserStoryGroup'));
});

test('Stories never fabricate media or server timestamps', () => {
  const api = read('src/domains/stories/api/storiesApi.ts');
  const composer = read('src/domains/stories/StoryComposerModal.tsx');
  const viewer = read('src/domains/stories/StoryViewerModal.tsx');
  assert.ok(!api.includes('Date.now'));
  assert.ok(!api.includes('fake'));
  assert.ok(!composer.includes('new Date'));
  assert.ok(viewer.includes('current.publishedAt'));
  assert.ok(viewer.includes('current.expiresAt'));
});
