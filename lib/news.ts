// Real-time news aggregator shared by the Express dev server (server.ts) and
// the Vercel function (api/news.ts). Pulls public RSS feeds server-side
// (browsers can't read them directly because of CORS), normalizes them into
// a single shape and caches each category in memory for a short TTL.

export type NewsCategory = 'meteo' | 'italia' | 'mondo' | 'scienza' | 'tech' | 'ambiente';

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: number; // epoch ms
  category: NewsCategory;
}

export interface NewsResponse {
  category: NewsCategory | 'all';
  items: NewsItem[];
  fetchedAt: number;
  sources: string[];
  errors: string[];
}

export interface FeedDef {
  url: string;
  source: string; // fallback label when the item has no <source>
}

const GN = (path: string) => `https://news.google.com/rss/${path}${path.includes('?') ? '&' : '?'}hl=it&gl=IT&ceid=IT:it`;

export const NEWS_FEEDS: Record<NewsCategory, FeedDef[]> = {
  meteo: [
    { url: GN('search?q=meteo+OR+maltempo+OR+%22allerta+meteo%22+-fotosegnalazione+-%22foto+meteo%22+when:2d'), source: 'Google News' },
  ],
  italia: [{ url: 'https://www.ansa.it/sito/ansait_rss.xml', source: 'ANSA' }],
  mondo: [{ url: 'https://www.ansa.it/sito/notizie/mondo/mondo_rss.xml', source: 'ANSA' }],
  scienza: [{ url: GN('headlines/section/topic/SCIENCE'), source: 'Google News' }],
  tech: [{ url: GN('headlines/section/topic/TECHNOLOGY'), source: 'Google News' }],
  ambiente: [{ url: GN('search?q=%22crisi+climatica%22+OR+%22cambiamento+climatico%22+OR+siccit%C3%A0+OR+inquinamento+OR+biodiversit%C3%A0+when:3d'), source: 'Google News' }],
};

export const NEWS_CATEGORIES = Object.keys(NEWS_FEEDS) as NewsCategory[];

export function isNewsCategory(value: unknown): value is NewsCategory {
  return typeof value === 'string' && (NEWS_CATEGORIES as string[]).includes(value);
}

const CACHE_TTL_MS = 3 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_ITEMS_PER_CATEGORY = 30;
const MAX_AGE_MS = 72 * 60 * 60 * 1000;

const cache = new Map<NewsCategory, { at: number; items: NewsItem[]; errors: string[] }>();

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  egrave: 'è', eacute: 'é', agrave: 'à', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
  laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', ndash: '–', mdash: '—',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

function clean(raw: string | undefined): string {
  if (!raw) return '';
  let text = raw.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');
  // Entities first: Google News ships its description as escaped HTML.
  text = decodeEntities(text);
  text = text.replace(/<[^>]*>/g, ' ');
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m?.[1];
}

function safeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function parseRss(xml: string, feed: FeedDef, category: NewsCategory): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const block of blocks) {
    let title = clean(tag(block, 'title'));
    const url = safeUrl(clean(tag(block, 'link')));
    if (!title || !url) continue;

    const isGoogle = feed.source === 'Google News';
    const source = clean(tag(block, 'source')) || feed.source;
    // Google News appends " - Testata" to every title.
    if (isGoogle && title.endsWith(` - ${source}`)) {
      title = title.slice(0, -(source.length + 3)).trim();
    }

    // Skip bare section/programme pages ("Meteo", "Meteo regionale") and
    // user photo-report posts, which would otherwise flood the meteo feed.
    if (title.split(/\s+/).length < 3 || /fotosegnalazion|^foto meteo/i.test(title)) continue;

    // Google News descriptions only repeat title + outlet, so they carry no summary.
    const summary = isGoogle ? '' : clean(tag(block, 'description'));

    const date = Date.parse(clean(tag(block, 'pubDate')));
    items.push({
      id: hash(url),
      title,
      summary: summary.slice(0, 280),
      url,
      source,
      publishedAt: Number.isFinite(date) ? date : Date.now(),
      category,
    });
  }
  return items;
}

export async function fetchFeed(feed: FeedDef, category: NewsCategory): Promise<NewsItem[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(feed.url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (MeteoRadar News Hub)', Accept: 'application/rss+xml, application/xml, text/xml' },
    });
    if (!res.ok) throw new Error(`${feed.source}: HTTP ${res.status}`);
    return parseRss(await res.text(), feed, category);
  } finally {
    clearTimeout(timer);
  }
}

async function loadCategory(category: NewsCategory): Promise<{ items: NewsItem[]; errors: string[] }> {
  const hit = cache.get(category);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit;

  const results = await Promise.allSettled(NEWS_FEEDS[category].map((f) => fetchFeed(f, category)));
  const errors: string[] = [];
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  for (const r of results) {
    if (r.status === 'rejected') {
      errors.push(String(r.reason?.message || r.reason));
      continue;
    }
    for (const item of r.value) {
      const key = item.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }
  items.sort((a, b) => b.publishedAt - a.publishedAt);
  // Some publisher feeds stop updating silently; never present stale stories as "live".
  const fresh = items.filter((i) => Date.now() - i.publishedAt < MAX_AGE_MS);
  const entry = { at: Date.now(), items: fresh.slice(0, MAX_ITEMS_PER_CATEGORY), errors };

  // On a total failure keep serving the last good copy instead of an empty list.
  if (entry.items.length === 0 && hit) return { items: hit.items, errors };
  cache.set(category, entry);
  return entry;
}

export async function getNews(category: NewsCategory | 'all'): Promise<NewsResponse> {
  const cats = category === 'all' ? NEWS_CATEGORIES : [category];
  const loaded = await Promise.all(cats.map(loadCategory));
  const items = loaded
    .flatMap((l) => l.items)
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, category === 'all' ? 60 : MAX_ITEMS_PER_CATEGORY);
  return {
    category,
    items,
    fetchedAt: Date.now(),
    sources: [...new Set(items.map((i) => i.source))],
    errors: loaded.flatMap((l) => l.errors),
  };
}
