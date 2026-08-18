import React from 'react';
import { Heart, MessageCircle, Sparkles } from 'lucide-react';

interface ShowcasePost {
  image: string;
  author: string;
  caption: string;
  likes: string;
  comments: string;
  accent: string;
}

const posts: ShowcasePost[] = [
  {
    image: '/auth-showcase/rooftop-friends.jpg',
    author: '@nora.nights',
    caption: 'Город, свет и люди, с которыми время летит незаметно.',
    likes: '2.8K',
    comments: '184',
    accent: 'from-violet-500/80 to-indigo-500/80',
  },
  {
    image: '/auth-showcase/urban-skate.jpg',
    author: '@maya.moves',
    caption: 'Ещё одна попытка. Ещё немного выше.',
    likes: '6.4K',
    comments: '327',
    accent: 'from-cyan-500/80 to-blue-500/80',
  },
  {
    image: '/auth-showcase/pottery-studio.jpg',
    author: '@clay.and.calm',
    caption: 'Медленный процесс тоже может менять всё.',
    likes: '3.1K',
    comments: '96',
    accent: 'from-amber-500/80 to-orange-500/80',
  },
  {
    image: '/auth-showcase/mountain-hike.jpg',
    author: '@above.the.clouds',
    caption: 'Рассвет, ради которого стоило начать путь ночью.',
    likes: '9.7K',
    comments: '512',
    accent: 'from-emerald-500/80 to-teal-500/80',
  },
  {
    image: '/auth-showcase/home-cooking.jpg',
    author: '@table.for.two',
    caption: 'Лучшие вечера начинаются без рецепта.',
    likes: '4.2K',
    comments: '209',
    accent: 'from-rose-500/80 to-orange-500/80',
  },
  {
    image: '/auth-showcase/live-concert.jpg',
    author: '@afterglow.live',
    caption: 'Тот самый момент, когда зал поёт вместе с тобой.',
    likes: '12K',
    comments: '841',
    accent: 'from-fuchsia-500/80 to-purple-500/80',
  },
];

const lanes = [
  [posts[0], posts[3], posts[4]],
  [posts[1], posts[5], posts[2]],
  [posts[4], posts[0], posts[3]],
];

const ShowcaseCard: React.FC<{ post: ShowcasePost; eager?: boolean }> = ({ post, eager = false }) => (
  <article className="group/card overflow-hidden rounded-[1.35rem] border border-white/10 bg-slate-950/75 shadow-2xl shadow-black/25 backdrop-blur-xl">
    <div className="relative aspect-[4/5] overflow-hidden">
      <img
        src={post.image}
        alt=""
        width={640}
        height={800}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className="h-full w-full object-cover transition duration-700 ease-out group-hover/card:scale-[1.04]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
      <div className={`absolute left-3 top-3 h-1.5 w-10 rounded-full bg-gradient-to-r ${post.accent} shadow-lg`} />
      <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
        <p className="text-[11px] font-bold tracking-tight">{post.author}</p>
        <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-white/75">{post.caption}</p>
      </div>
    </div>
    <div className="flex items-center gap-3 px-3.5 py-3 text-[10px] font-semibold text-white/65">
      <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{post.likes}</span>
      <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{post.comments}</span>
      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgb(52_211_153/.8)]" />
    </div>
  </article>
);

const LaneGroup: React.FC<{ posts: ShowcasePost[]; eager?: boolean }> = ({ posts: lanePosts, eager }) => (
  <div className="flex flex-col gap-3 pb-3">
    {lanePosts.map((post, index) => (
      <ShowcaseCard key={`${post.image}-${index}`} post={post} eager={Boolean(eager && index === 0)} />
    ))}
  </div>
);

export const AuthShowcase: React.FC = () => (
  <section aria-label="Демонстрационная лента GAPAK" className="auth-showcase relative hidden w-[52%] max-w-[780px] overflow-hidden border-r border-white/10 bg-[#060816] lg:block">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgb(99_102_241/.28),transparent_34rem),radial-gradient(circle_at_85%_90%,rgb(217_70_239/.18),transparent_30rem)]" />

    <div aria-hidden="true" className="absolute -inset-x-12 -inset-y-32 grid rotate-[-4deg] grid-cols-3 gap-3 opacity-90">
      {lanes.map((lane, index) => (
        <div key={index} className="min-w-0 overflow-hidden">
          <div className={index === 1 ? 'auth-showcase-track-down' : `auth-showcase-track-up auth-showcase-track-up-${index + 1}`}>
            <LaneGroup posts={lane} eager />
            <LaneGroup posts={lane} />
          </div>
        </div>
      ))}
    </div>

    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#060816]/90 via-transparent to-[#060816]/95" />
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#060816]/40 via-transparent to-[#060816]/70" />

    <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-12">
      <div className="flex items-center gap-2 text-white">
        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/10 shadow-xl backdrop-blur-xl">
          <Sparkles className="h-4.5 w-4.5" />
        </div>
        <span className="text-lg font-black tracking-[-0.03em]">GAPAK</span>
      </div>

      <div className="max-w-lg pb-2 text-white">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/75 backdrop-blur-xl">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_12px_rgb(129_140_248/.9)]" />
          Витрина сообщества
        </div>
        <h2 className="text-4xl font-black leading-[1.03] tracking-[-0.045em] xl:text-5xl">
          Моменты, которыми хочется делиться
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-white/65 xl:text-base">
          Истории, творчество, люди и места — всё, что делает каждый день живым.
        </p>
      </div>
    </div>
  </section>
);

