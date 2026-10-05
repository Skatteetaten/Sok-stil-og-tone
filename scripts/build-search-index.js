#!/usr/bin/env node
/**
 * Builds a search index from Skattekartet, the designsystem docs (from MDX
 * source on GitHub) and Storybook. Pass --force to ignore the 7-day cache.
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Polyfill File API for Node.js < 20
if (typeof global.File === 'undefined') {
  global.File = class File {
    constructor(bits, name, options = {}) {
      this.name = name;
      this.type = options.type || '';
      this.size = bits.length;
      this.lastModified = options.lastModified || Date.now();
      this.bits = bits;
    }
  };
}

const BASE_URL = 'https://www.skatteetaten.no';
const SECTION_PATH = '/skattekartet/';
const START_URL = BASE_URL + SECTION_PATH;
const STORYBOOK_BASE = 'https://master--68ad8bf775fcb9aa19b070e9.chromatic.com';
const DOCS_SITE = 'https://skatteetaten.github.io/designsystemet';
const DOCS_REPO = 'Skatteetaten/designsystemet';
const DOCS_BRANCH = 'master';
const DOCS_CONTENT_DIR = 'apps/ds-docs/content/docs/';
// The docs SPA loads page content after the browser's initial hash scroll, so
// #anchors land at the top of the page. Flip to true once that is fixed upstream.
const DOCS_ANCHORS_WORK = false;

const CATEGORY_SKATTEKARTET = 'Skattekartet';
const CATEGORY_DOCS = 'Skattekartet/Github';
const CATEGORY_STORYBOOK = 'Storybook';

// Navigation-only pages excluded from search results (normalized, no trailing slash)
const LANDING_PAGES = new Set([
  '',
  'praksis',
  'praksis/sprak',
  'praksis/sprak/skrive/skriveregler',
  'praksis/sprak/skrive/skatteetaten.no',
  'praksis/brukerinnsikt',
  'monstre',
  'monstre/interaksjon-sideoppsett/interaksjonsmonstre',
  'monstre/interaksjon-sideoppsett/sideoppsett',
  'monstre/innholdstyper/skatteetatenno',
  'monstre/innholdstyper/skatteetatenno/elementer',
  'monstre/innholdstyper/skatteetatenno/fremgangsmate',
  'monstre/innholdstyper/skjemadesign',
  'designsystemet',
  'stilogtone',
].map((p) => (START_URL + p).replace(/\/$/, '')));

const STORYBOOK_EXCLUDED_GROUPS = new Set(['Tester', 'components']);

// Track visited URLs to avoid duplicates
const visited = new Set();
const toVisit = [START_URL];
const pages = [];

// Helper to normalize URLs
function normalizeUrl(url) {
  try {
    const urlObj = new URL(url, BASE_URL);
    // Remove fragments and trailing slashes
    return urlObj.origin + urlObj.pathname.replace(/\/$/, '') || '/';
  } catch {
    return null;
  }
}

// skatteetaten.no assigns heading anchors client-side (Static/dist/js/main.*.js):
// only headings inside these containers get one, and only if they lack an id.
const ANCHOR_SCOPES = ['.articlepage', '.lawarticlepage', '.componentarticlepage', '.ratetypepage', '.formpage', '.postpage']
  .map((page) => `${page} main .narrow-container`)
  .concat(['.pagewithoutlayout main', '.is-lonnsjustering main']);

// Exact port of skatteetaten.no's slug rule. String.replace only swaps the
// FIRST æ/ø/å/-, and uppercase ÆØÅ are dropped — keep it that way so anchors match.
function skatteetatenSlug(text) {
  return text
    .trim()
    .replace('æ', 'ae')
    .replace('ø', 'o')
    .replace('å', 'a')
    .replace('-', ' ')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function extractHeadings(html) {
  const $ = cheerio.load(html);
  const h1 = $('h1').first().text().trim();
  const anchored = new Set(
    $(ANCHOR_SCOPES.map((scope) => `${scope} h2, ${scope} h3, ${scope} h4`).join(', ')).toArray(),
  );

  const headings = [];
  $('h2, h3, h4').each((_, el) => {
    const $h = $(el);
    if ($h.closest('header, nav, footer').length) return;
    const text = $h.text().trim();
    if (!text) return;

    const id = $h.attr('id') || (anchored.has(el) ? skatteetatenSlug(text) : null);
    const level = el.tagName === 'h2' ? 1 : el.tagName === 'h3' ? 2 : 3;
    headings.push({ title: text.replace(/\s+/g, ' '), id, level });
  });

  return { title: h1, headings };
}

// Fetch a page and extract data
async function fetchPage(url) {
  try {
    console.log(`  Fetching: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SkatteetatenBot/1.0)',
      },
    });

    if (!response.ok) {
      console.warn(`  ⚠️  Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const { title, headings } = extractHeadings(html);

    const $ = cheerio.load(html);
    const links = [];

    // Some landing pages render their cards client-side from an inline JSON
    // list (`var allthedata = [{ "url": "/skattekartet/..." }]`) with no <a> tags.
    const hrefs = $('a[href]').map((_, a) => $(a).attr('href')).get();
    for (const m of html.matchAll(/"url"\s*:\s*"(\/skattekartet\/[^"]+)"/g)) hrefs.push(m[1]);

    hrefs.forEach((href) => {
      if (!href) return;

      try {
        const absoluteUrl = new URL(href, url).href;
        if (absoluteUrl.startsWith(START_URL)) {
          const normalized = normalizeUrl(absoluteUrl);
          if (normalized && !visited.has(normalized)) {
            links.push(normalized);
          }
        }
      } catch {
        // Invalid URL, skip
      }
    });

    return {
      url,
      title,
      headings,
      links,
    };
  } catch (error) {
    console.warn(`  ⚠️  Error fetching ${url}:`, error.message);
    return null;
  }
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const humanizeSlug = (slug) => capitalize(decodeURIComponent(slug).replace(/[-_]+/g, ' '));

// Parent = the top-level Skattekartet section, named by that section page's own h1.
function buildHierarchy(url, titlesByUrl) {
  const parts = url.replace(START_URL.replace(/\/$/, ''), '').split('/').filter(Boolean);
  if (parts.length <= 1) {
    return { parent: CATEGORY_SKATTEKARTET, parentUrl: START_URL };
  }
  const sectionUrl = START_URL + parts[0];
  return {
    parent: titlesByUrl.get(sectionUrl) || humanizeSlug(parts[0]),
    parentUrl: sectionUrl + '/',
  };
}

async function fetchStorybookComponents() {
  const response = await fetch(`${STORYBOOK_BASE}/index.json`);
  if (!response.ok) throw new Error(`Storybook index.json: ${response.status}`);
  const { entries } = await response.json();

  return Object.values(entries)
    .filter((e) => e.type === 'docs' && !STORYBOOK_EXCLUDED_GROUPS.has(e.title.split('/')[0]))
    .map((e) => {
      const parts = e.title.split('/');
      return {
        title: parts[parts.length - 1],
        url: `${STORYBOOK_BASE}/?path=/docs/${e.id}`,
        category: CATEGORY_STORYBOOK,
        parent: parts.slice(0, -1).join(' • '),
        level: 0,
      };
    });
}

// Mirrors github-slugger, which Fumadocs uses for heading anchors (keeps æøå).
function githubSlug(text, seen) {
  const base = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .replace(/\s/g, '-');
  let slug = base;
  let n = 1;
  while (seen.has(slug)) slug = `${base}-${n++}`;
  seen.add(slug);
  return slug;
}

function parseMdx(source) {
  const fm = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const title = fm?.[1].match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1];
  const body = fm ? source.slice(fm[0].length) : source;

  const headings = [];
  const seen = new Set();
  let inFence = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = line.match(/^(#{2,4})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const text = m[2]
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[`*_]/g, '')
      .trim();
    headings.push({ title: text, id: githubSlug(text, seen), level: m[1].length - 1 });
  }
  return { title, headings };
}

// The docs site is a client-rendered SPA, so we index its MDX source instead.
async function fetchDesignsystemDocs() {
  const headers = { 'User-Agent': 'Sok-stil-og-tone' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const treeRes = await fetch(
    `https://api.github.com/repos/${DOCS_REPO}/git/trees/${DOCS_BRANCH}?recursive=1`,
    { headers },
  );
  if (!treeRes.ok) throw new Error(`GitHub tree: ${treeRes.status}`);
  const { tree } = await treeRes.json();

  const files = tree
    .map((t) => t.path)
    .filter((p) => p.startsWith(DOCS_CONTENT_DIR) && p.endsWith('.mdx'));

  const items = [];
  for (const file of files) {
    const rel = file.slice(DOCS_CONTENT_DIR.length).replace(/\.mdx$/, '');
    // The docs front page only links onwards, like a Skattekartet landing page.
    if (rel === 'index') continue;

    const segments = rel.split('/');
    if (segments[segments.length - 1] === 'index') segments.pop();
    const pageUrl = `${DOCS_SITE}/${segments.join('/')}`;

    const rawUrl = `https://raw.githubusercontent.com/${DOCS_REPO}/${DOCS_BRANCH}/${file}`;
    const res = await fetch(rawUrl, { headers: { 'User-Agent': headers['User-Agent'] } });
    if (!res.ok) {
      console.warn(`  ⚠️  Failed to fetch ${rawUrl}: ${res.status}`);
      continue;
    }
    const { title, headings } = parseMdx(await res.text());
    const pageTitle = title || humanizeSlug(segments[segments.length - 1]);

    items.push({
      url: pageUrl,
      title: pageTitle,
      category: CATEGORY_DOCS,
      parent: segments.slice(0, -1).map(humanizeSlug).join(' • ') || 'Designsystemet',
      parentUrl: DOCS_SITE + '/',
      level: 0,
      headings,
      anchorsWork: DOCS_ANCHORS_WORK,
    });
  }
  return items;
}

const buildSearchIndex = async () => {
  // Check if index already exists and is recent (less than 7 days old)
  const staticDir = path.join(__dirname, '..', 'static');
  const indexPath = path.join(staticDir, 'search-index.json');

  if (fs.existsSync(indexPath) && !process.argv.includes('--force')) {
    const stats = fs.statSync(indexPath);
    const ageInDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);

    if (ageInDays < 7) {
      console.log('✅ Search index exists and is recent (less than 7 days old)');
      console.log(`   Skipping rebuild. File: ${indexPath}`);
      console.log(`   Last updated: ${stats.mtime.toLocaleString('no-NO')}`);
      return;
    } else {
      console.log(`ℹ️  Search index is ${ageInDays.toFixed(1)} days old, rebuilding...`);
    }
  }

  console.log('🔍 Building search index from Skattekartet...');
  console.log(`   Starting from: ${START_URL}`);

  // Crawl all pages
  while (toVisit.length > 0) {
    const url = toVisit.shift();
    const normalized = normalizeUrl(url);

    if (!normalized || visited.has(normalized)) {
      continue;
    }

    visited.add(normalized);

    const pageData = await fetchPage(normalized);
    if (!pageData) continue;

    // Add links to visit queue
    pageData.links.forEach(link => {
      if (!visited.has(link) && !toVisit.includes(link)) {
        toVisit.push(link);
      }
    });

    pages.push({
      url: normalized,
      title: pageData.title || normalized.split('/').pop() || 'Untitled',
      category: CATEGORY_SKATTEKARTET,
      level: 0,
      headings: pageData.headings,
      isLandingPage: LANDING_PAGES.has(normalized),
    });

    // Small delay to be respectful
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const titlesByUrl = new Map(pages.map((p) => [p.url, p.title]));
  pages.forEach((page) => Object.assign(page, buildHierarchy(page.url, titlesByUrl)));

  console.log(`\n✅ Crawled ${pages.length} pages from Skattekartet`);

  console.log('\n📘 Fetching designsystem docs from GitHub...');
  const docsPages = await fetchDesignsystemDocs();
  console.log(`   Found ${docsPages.length} pages`);
  pages.push(...docsPages);

  console.log('\n📚 Fetching Storybook docs...');
  const storybookComponents = await fetchStorybookComponents();
  console.log(`   Found ${storybookComponents.length} docs pages`);

  // Flatten the index to include both pages and headings
  const flattenedIndex = [];

  // Add stilogtone pages (exclude landing pages)
  pages.forEach(page => {
    // Skip landing pages - they should not appear in search results
    if (page.isLandingPage) {
      return;
    }

    // Add the main page
    flattenedIndex.push({
      title: page.title,
      url: page.url,
      category: page.category,
      parent: page.parent,
      parentUrl: page.parentUrl,
      level: page.level || 0,
    });

    // Add headings as separate entries
    page.headings?.forEach(heading => {
      // Skip heading if it has the same title as the page
      if (heading.title.toLowerCase() === page.title.toLowerCase()) {
        return;
      }

      // Build full breadcrumb path: category > page title
      const breadcrumb = page.parent ? `${page.parent} • ${page.title}` : page.title;

      // Headings without a working anchor link to the page itself; the UI folds them into the page row.
      const url = heading.id && page.anchorsWork !== false ? `${page.url}#${heading.id}` : page.url;

      flattenedIndex.push({
        title: heading.title,
        url: url,
        category: page.category,
        parent: breadcrumb, // Full breadcrumb path instead of just page title
        parentUrl: page.url,
        heading: heading.title,
        level: heading.level || 1,
      });
    });
  });

  // Add Storybook components
  storybookComponents.forEach(component => {
    flattenedIndex.push(component);
  });

  // Deduplicate the final index based on title and URL
  const uniqueIndex = [];
  const seenEntries = new Set();

  flattenedIndex.forEach(item => {
    // Create a unique key for the entry
    const key = `${item.title}|${item.url}`;

    if (!seenEntries.has(key)) {
      seenEntries.add(key);
      uniqueIndex.push(item);
    }
  });

  // Write to static directory
  if (!fs.existsSync(staticDir)) {
    fs.mkdirSync(staticDir, { recursive: true });
  }

  fs.writeFileSync(indexPath, JSON.stringify(uniqueIndex, null, 2), 'utf-8');

  console.log(`\n✅ Search index built: ${uniqueIndex.length} entries`);
  console.log(`   Saved to: ${indexPath}`);
};

buildSearchIndex().catch(console.error);
