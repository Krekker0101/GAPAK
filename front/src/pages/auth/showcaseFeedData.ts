/**
 * Purely decorative "popular posts" data used to dress up the auth screen.
 * Everything here is fictional placeholder content - no real users, handles
 * or post text from anywhere else. It exists only to make the marketing
 * column feel alive.
 */

export interface ShowcasePost {
  id: string;
  name: string;
  handle: string;
  time: string;
  emoji: string;
  gradient: string;
  text: string;
  media?: boolean;
  likes: string;
  comments: string;
  reposts: string;
}

const gradients = [
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#ec4899,#f97316)',
  'linear-gradient(135deg,#06b6d4,#3b82f6)',
  'linear-gradient(135deg,#22c55e,#14b8a6)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#a855f7,#6366f1)',
  'linear-gradient(135deg,#0ea5e9,#22c55e)',
  'linear-gradient(135deg,#f43f5e,#a855f7)',
];

const raw: Array<[string, string, string, string, boolean, string, string, string]> = [
  ['Полуночник', 'night_owl', '🌙', 'Кто ещё не спит в три часа ночи из-за нового сезона сериала?', false, '3.2K', '128', '64'],
  ['Пиксель', 'pixel.dev', '🎮', 'Го катку в 21:00, нужен ещё один саппорт в команду', false, '1.1K', '96', '12'],
  ['Кофейный дневник', 'coffee.diary', '☕', 'Сварил кофе, забыл про него, сварил заново. День определённо удался', true, '5.6K', '340', '210'],
  ['Сетап дня', 'setup.check', '⌨️', 'Апгрейднул сборку — теперь стабильно держит высокий фреймрейт', true, '8.9K', '512', '188'],
  ['Закат с балкона', 'skywatcher', '📷', 'Снял вчера, ничего не редактировал — свет сам постарался', true, '12.4K', '740', '390'],
  ['Плейлист для дедлайнов', 'lofi.mode', '🎧', 'Наконец нашёл идеальный плейлист, чтобы добивать дедлайны', false, '2.7K', '84', '46'],
  ['Разбор архива', 'old.folders', '🧩', 'Разобрал старый ноутбук и нашёл фотки пятилетней давности', false, '941', '52', '9'],
  ['Дождь за окном', 'quiet.hours', '🌧️', 'Погода испортилась, а настроение почему-то нет', false, '1.9K', '67', '21'],
  ['Новая тема', 'theme.update', '✨', 'Вышло обновление темы оформления — поставил сразу же', true, '6.3K', '298', '150'],
  ['Фигурка недели', 'shelf.corner', '🧸', 'Наконец собрал ту самую фигурку — стояла в коробке полгода', true, '4.4K', '176', '88'],
  ['Монтажный форум', 'edit.notes', '🎬', 'Читаю советы по монтажу и сохраняю всё подряд в заметки', false, '780', '39', '15'],
  ['Соседский пёс', 'yard.watch', '🐶', 'Пёс у соседей опять лает на почтальона — классика жанра', false, '2.1K', '145', '30'],
];

export const showcasePosts: ShowcasePost[] = raw.map(([name, handle, emoji, text, media, likes, comments, reposts], i) => ({
  id: `showcase-${i}`,
  name,
  handle,
  time: `${(i % 12) + 1}${i % 2 ? 'ч' : 'д'}`,
  emoji,
  gradient: gradients[i % gradients.length],
  text,
  media,
  likes,
  comments,
  reposts,
}));

export const splitIntoColumns = (count: number): ShowcasePost[][] => {
  const columns: ShowcasePost[][] = Array.from({ length: count }, () => []);
  showcasePosts.forEach((post, i) => columns[i % count].push(post));
  return columns;
};
