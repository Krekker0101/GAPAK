import React from 'react';
import { Heart, MessageCircle, Repeat2, Image as ImageIcon } from 'lucide-react';
import { ShowcasePost, splitIntoColumns } from './showcaseFeedData';

const PostChip: React.FC<{ post: ShowcasePost }> = ({ post }) => (
  <article className="w-full rounded-[var(--radius-2xl)] border border-subtle bg-surface/90 p-4 shadow-token-sm backdrop-blur-sm">
    <div className="flex items-center gap-2.5">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base shadow-token-sm"
        style={{ background: post.gradient }}
        aria-hidden
      >
        {post.emoji}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-primary">{post.name}</p>
        <p className="truncate text-xs text-muted">@{post.handle} · {post.time}</p>
      </div>
    </div>

    <p className="mt-3 text-sm leading-snug text-secondary">{post.text}</p>

    {post.media && (
      <div
        className="mt-3 flex h-24 items-center justify-center rounded-[var(--radius-lg)] text-white/80"
        style={{ background: post.gradient, opacity: 0.85 }}
      >
        <ImageIcon className="h-6 w-6" strokeWidth={1.5} />
      </div>
    )}

    <div className="mt-3 flex items-center gap-4 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5"><Heart className="h-3.5 w-3.5" /> {post.likes}</span>
      <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> {post.comments}</span>
      <span className="inline-flex items-center gap-1.5"><Repeat2 className="h-3.5 w-3.5" /> {post.reposts}</span>
    </div>
  </article>
);

const MarqueeColumn: React.FC<{
  posts: ShowcasePost[];
  direction: 'up' | 'down';
  duration: number;
}> = ({ posts, direction, duration }) => (
  <div className="relative h-full overflow-hidden">
    <div
      className="flex flex-col gap-4 will-change-transform"
      style={{
        animation: `${direction === 'up' ? 'auth-marquee-up' : 'auth-marquee-down'} ${duration}s linear infinite`,
      }}
    >
      {[...posts, ...posts].map((post, i) => (
        <PostChip key={`${post.id}-${i}`} post={post} />
      ))}
    </div>
  </div>
);

export const AuthShowcaseFeed: React.FC<{ columns?: 2 | 3 }> = ({ columns = 2 }) => {
  const cols = splitIntoColumns(columns);
  const durations = [42, 50, 46];

  return (
    <div
      className="pointer-events-none absolute inset-0 grid gap-4 px-4 pb-4 pt-24 select-none"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)',
        maskImage: 'linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)',
      }}
      aria-hidden="true"
    >
      {cols.map((posts, i) => (
        <MarqueeColumn
          key={i}
          posts={posts}
          direction={i % 2 === 0 ? 'up' : 'down'}
          duration={durations[i % durations.length]}
        />
      ))}
    </div>
  );
};
