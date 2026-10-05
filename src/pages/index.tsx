import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from '@docusaurus/Link';
import Head from '@docusaurus/Head';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './index.module.css';

interface SearchResult {
  title: string;
  url: string;
  category: string;
  parent?: string;
  parentUrl?: string;
  heading?: string;
  headingId?: string;
  level?: number;
}

interface DisplayResult extends SearchResult {
  mentions?: string[];
}

const CATEGORY_HOSTS: Record<string, string> = {
  'Skattekartet': 'skatteetaten.no',
  'Skattekartet/Github': 'skatteetaten.github.io',
  'Storybook': 'chromatic.com',
};

// A heading only gets its own row when its link jumps straight to that section.
const linksToSection = (r: SearchResult) => r.url.includes('#');

function StorybookIcon() {
  return (
    <svg viewBox="-31.5 0 319 319" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid" className={styles.sectionHeaderIcon}>
      <defs>
        <path d="M9.87245893,293.324145 L0.0114611411,30.5732167 C-0.314208957,21.8955842 6.33948896,14.5413918 15.0063196,13.9997149 L238.494389,0.0317105427 C247.316188,-0.519651867 254.914637,6.18486163 255.466,15.0066607 C255.486773,15.339032 255.497167,15.6719708 255.497167,16.0049907 L255.497167,302.318596 C255.497167,311.157608 248.331732,318.323043 239.492719,318.323043 C239.253266,318.323043 239.013844,318.317669 238.774632,318.306926 L25.1475605,308.712253 C16.8276309,308.338578 10.1847994,301.646603 9.87245893,293.324145 L9.87245893,293.324145 Z" id="storybook-bg" />
      </defs>
      <mask id="storybook-mask" fill="white">
        <use xlinkHref="#storybook-bg" />
      </mask>
      <use fill="#FF4785" fillRule="nonzero" xlinkHref="#storybook-bg" />
      <path d="M188.665358,39.126973 L190.191903,2.41148534 L220.883535,0 L222.205755,37.8634126 C222.251771,39.1811466 221.22084,40.2866846 219.903106,40.3327009 C219.338869,40.3524045 218.785907,40.1715096 218.342409,39.8221376 L206.506729,30.4984116 L192.493574,41.1282444 C191.443077,41.9251106 189.945493,41.7195021 189.148627,40.6690048 C188.813185,40.2267976 188.6423,39.6815326 188.665358,39.126973 Z M149.413703,119.980309 C149.413703,126.206975 191.355678,123.222696 196.986019,118.848893 C196.986019,76.4467826 174.234041,54.1651411 132.57133,54.1651411 C90.9086182,54.1651411 67.5656805,76.7934542 67.5656805,110.735941 C67.5656805,169.85244 147.345341,170.983856 147.345341,203.229219 C147.345341,212.280549 142.913138,217.654777 133.162291,217.654777 C120.456641,217.654777 115.433477,211.165914 116.024438,189.103298 C116.024438,184.317101 67.5656805,182.824962 66.0882793,189.103298 C62.3262146,242.56887 95.6363019,257.990394 133.753251,257.990394 C170.688279,257.990394 199.645341,238.303123 199.645341,202.663511 C199.645341,139.304202 118.683759,141.001326 118.683759,109.604526 C118.683759,96.8760922 128.139127,95.178968 133.753251,95.178968 C139.662855,95.178968 150.300143,96.2205679 149.413703,119.980309 Z" fill="#FFFFFF" fillRule="nonzero" mask="url(#storybook-mask)" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" viewBox="0 0 24 24" className={styles.sectionHeaderIcon}>
      <g fill="rgb(111, 44, 63)">
        <path d="M21,5c-1.11-0.35-2.33-0.5-3.5-0.5c-1.95,0-4.05,0.4-5.5,1.5c-1.45-1.1-3.55-1.5-5.5-1.5S2.45,4.9,1,6v14.65 c0,0.25,0.25,0.5,0.5,0.5c0.1,0,0.15-0.05,0.25-0.05C3.1,20.45,5.05,20,6.5,20c1.95,0,4.05,0.4,5.5,1.5c1.35-0.85,3.8-1.5,5.5-1.5 c1.65,0,3.35,0.3,4.75,1.05c0.1,0.05,0.15,0.05,0.25,0.05c0.25,0,0.5-0.25,0.5-0.5V6C22.4,5.55,21.75,5.25,21,5z M21,18.5 c-1.1-0.35-2.3-0.5-3.5-0.5c-1.7,0-4.15,0.65-5.5,1.5V8c1.35-0.85,3.8-1.5,5.5-1.5c1.2,0,2.4,0.15,3.5,0.5V18.5z" />
        <path d="M17.5,10.5c0.88,0,1.73,0.09,2.5,0.26V9.24C19.21,9.09,18.36,9,17.5,9c-1.7,0-3.24,0.29-4.5,0.83v1.66 C14.13,10.85,15.7,10.5,17.5,10.5z" />
        <path d="M13,12.49v1.66c1.13-0.64,2.7-0.99,4.5-0.99c0.88,0,1.73,0.09,2.5,0.26V11.9c-0.79-0.15-1.64-0.24-2.5-0.24 C15.8,11.66,14.26,11.96,13,12.49z" />
        <path d="M17.5,14.33c-1.7,0-3.24,0.29-4.5,0.83v1.66c1.13-0.64,2.7-0.99,4.5-0.99c0.88,0,1.73,0.09,2.5,0.26v-1.52 C19.21,14.41,18.36,14.33,17.5,14.33z" />
      </g>
    </svg>
  );
}

// Unknown categories land between the docs sources and Storybook.
const CATEGORY_RANK: Record<string, number> = { 'Skattekartet': 0, 'Skattekartet/Github': 1, 'Storybook': 3 };
const categoryRank = (category: string) => CATEGORY_RANK[category] ?? 2;

function highlightText(text: string, query: string) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <span key={index} className={styles.highlight}>{part}</span>
    ) : part
  );
}

function SearchResults({ query }: { query: string }) {
  const [searchIndex, setSearchIndex] = useState<SearchResult[]>([]);
  const [indexLoaded, setIndexLoaded] = useState(false);
  const searchIndexUrl = useBaseUrl('/search-index.json');

  useEffect(() => {
    if (indexLoaded) return;
    fetch(searchIndexUrl)
      .then((response) => {
        if (response.ok) return response.json();
        throw new Error(`Failed to load search index: ${response.status}`);
      })
      .then((data) => {
        console.log('Search index loaded:', data.length, 'entries');
        setSearchIndex(data);
        setIndexLoaded(true);
      })
      .catch((error) => {
        console.warn('Could not load search index:', error);
        setSearchIndex([]);
        setIndexLoaded(true);
      });
  }, [indexLoaded, searchIndexUrl]);

  const results = useMemo(() => {
    if (!query || query.trim().length < 2 || !indexLoaded || searchIndex.length === 0) {
      return null;
    }

    const lowerQuery = query.toLowerCase().trim();

    const matchingPages = searchIndex.filter((r) => {
      if (r.level !== 0) return false;
      return r.title.toLowerCase().includes(lowerQuery) || r.parent?.toLowerCase().includes(lowerQuery);
    });

    const matchingHeadings = searchIndex.filter((r) => {
      if (r.level === 0) return false;
      return r.heading?.toLowerCase().includes(lowerQuery) || r.title.toLowerCase().includes(lowerQuery);
    });

    if (matchingPages.length === 0 && matchingHeadings.length === 0) {
      return { noResults: true };
    }

    // Each page row is followed by headings that link straight to their section.
    // Headings without such a link are listed on the page row as "Nevnt i …",
    // so the result never promises a jump the target site can't make.
    const pagesByUrl = new Map(searchIndex.filter((r) => r.level === 0).map((r) => [r.url, r]));
    const entries = new Map<string, { page: SearchResult; sections: SearchResult[]; mentions: string[] }>();
    const entryFor = (page: SearchResult) => {
      let entry = entries.get(page.url);
      if (!entry) {
        entry = { page, sections: [], mentions: [] };
        entries.set(page.url, entry);
      }
      return entry;
    };

    const byTitle = (a: SearchResult, b: SearchResult) => a.title.localeCompare(b.title);
    [...matchingPages].sort(byTitle).forEach(entryFor);

    matchingHeadings.forEach((heading) => {
      const page = heading.parentUrl ? pagesByUrl.get(heading.parentUrl) : undefined;
      if (!page) return;
      const entry = entryFor(page);
      if (!linksToSection(heading)) {
        if (!entry.mentions.includes(heading.title)) entry.mentions.push(heading.title);
      } else if (!entry.sections.some((s) => s.url === heading.url)) {
        entry.sections.push(heading);
      }
    });

    const grouped: { [category: string]: DisplayResult[] } = {};
    entries.forEach(({ page, sections, mentions }) => {
      const list = grouped[page.category] || (grouped[page.category] = []);
      list.push({ ...page, mentions });
      list.push(...sections.sort(byTitle));
    });

    return grouped;
  }, [query, searchIndex, indexLoaded]);

  if (!results) return null;

  if ('noResults' in results) {
    return (
      <div className={styles.searchResults}>
        <div className={styles.noResults}>Ingen treff</div>
      </div>
    );
  }

  const categories = Object.keys(results).sort(
    (a, b) => categoryRank(a) - categoryRank(b) || a.localeCompare(b),
  );

  return (
    <div className={styles.searchResults}>
      {categories.map((category) => {
        const isStorybook = category.toLowerCase().includes('storybook');
        return (
          <div key={category} className={styles.categoryGroup}>
            <div className={styles.sectionHeader}>
              {isStorybook ? <StorybookIcon /> : <BookIcon />}
              <span className={styles.sectionHeaderText}>{category}</span>
              {CATEGORY_HOSTS[category] && (
                <span className={styles.sectionHeaderHost}>{CATEGORY_HOSTS[category]}</span>
              )}
            </div>

            {results[category].map((result, idx) => {
              const isSubPage = (result.level || 0) > 0;
              const subtitle = result.parent || result.heading || category;
              return (
                <a
                  key={`${result.url}-${idx}`}
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.resultCard}
                >
                  <div className={styles.resultCardContent}>
                    <div className={styles.resultTitleRow}>
                      {isSubPage && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={styles.subItemIcon}>
                          <path d="M8 7v7h8" />
                          <path d="M14 10l3 3-3 3" />
                        </svg>
                      )}
                      <div className={styles.resultTitle}>{highlightText(result.title, query)}</div>
                    </div>
                    {subtitle && (
                      <div className={isSubPage ? styles.resultSubtitleIndent : undefined}>
                        <div className={styles.resultSubtitle}>{subtitle}</div>
                      </div>
                    )}
                    {result.mentions && result.mentions.length > 0 && (
                      <div className={styles.resultMentions}>
                        {result.mentions.length === 1 ? 'Nevnt i avsnittet ' : 'Nevnt i avsnittene '}
                        {result.mentions.slice(0, 3).map((m, i) => (
                          <React.Fragment key={m}>
                            {i > 0 && ', '}
                            <span className={styles.resultMentionTitle}>{highlightText(m, query)}</span>
                          </React.Fragment>
                        ))}
                        {result.mentions.length > 3 && ` og ${result.mentions.length - 3} til`}
                      </div>
                    )}
                  </div>
                  <span className={styles.srOnly}>(åpnes i ny fane)</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.arrowIcon} aria-hidden="true">
                    <path d="M14 4h6v6" />
                    <path d="M20 4l-9 9" />
                    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
                  </svg>
                </a>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

interface CardLink {
  to: string;
  className: string;
  iconKey: 'stilogtone' | 'komponenter' | 'utvikler' | 'tilgjengelighet';
  alt: string;
  title: string;
  description: string;
}

const CARDS: CardLink[] = [
  {
    to: 'https://www.skatteetaten.no/skattekartet/',
    className: styles.cardStilOgTone,
    iconKey: 'stilogtone',
    alt: 'Skattekartet',
    title: 'Skattekartet',
    description: 'Les om strategi, praksis, mønstre og stil.',
  },
  {
    to: 'https://skatteetaten.github.io/designsystemet/',
    className: styles.cardKomponenter,
    iconKey: 'komponenter',
    alt: 'Designsystemet',
    title: 'Designsystemet',
    description: 'Dokumentasjon av komponenter, eksempler og guider.',
  },
  {
    to: 'https://github.com/Skatteetaten/designsystemet',
    className: styles.cardGithub,
    iconKey: 'utvikler',
    alt: 'Utviklerressurser',
    title: 'DS på Github',
    description: 'Skatteetatens designsystem på Github',
  },
  {
    to: 'https://skatteetaten.github.io/uu-status/uu-status.html',
    className: styles.cardUu,
    iconKey: 'tilgjengelighet',
    alt: 'Tilgjengelighet',
    title: 'UU-status',
    description: 'Sjekk status i våre tilgjengelighetserklæringer',
  },
];

export default function Home(): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const icons = {
    stilogtone: useBaseUrl('/img/stilogtone.png'),
    komponenter: useBaseUrl('/img/komponenter.png'),
    utvikler: useBaseUrl('/img/utvikler.png'),
    tilgjengelighet: useBaseUrl('/img/tilgjengelighet.png'),
  };

  useEffect(() => {
    if (!isSearchOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isSearchOpen]);

  return (
    <>
      <Head>
        <title>Søk i Skattekartet</title>
        <meta name="description" content="Finn innhold om språk, design, mønstre og komponenter." />
      </Head>
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.hero}>
            <h1 className={styles.title}>Søk i Skattekartet</h1>
            <p className={styles.subtitle}>
              Finn innhold om språk, design, mønstre og komponenter – inkludert Storybook.
            </p>

            <div ref={searchRef} className={styles.searchWrapper}>
              <div className={styles.searchInputWrapper}>
                <input
                  type="search"
                  aria-label="Søk i Skattekartet"
                  placeholder="Søk etter ord, tema eller komponent"
                  value={searchQuery}
                  className={styles.searchInput}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value) setIsSearchOpen(true);
                  }}
                  onClick={() => {
                    if (searchQuery) setIsSearchOpen(true);
                  }}
                  onFocus={() => {
                    if (searchQuery) setIsSearchOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsSearchOpen(false);
                    }
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Tøm søk"
                    className={styles.searchClear}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSearchQuery('');
                      setIsSearchOpen(false);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
              {isSearchOpen && searchQuery && <SearchResults query={searchQuery} />}
            </div>
          </div>

          <div className={styles.cardsGrid}>
            {CARDS.map((card) => (
              <Link key={card.to} to={card.to} className={`${styles.card} ${card.className}`}>
                <img src={icons[card.iconKey]} alt={card.alt} className={styles.cardImage} />
                <h2 className={styles.cardTitle}>{card.title}</h2>
                <p className={styles.cardText}>{card.description}</p>
              </Link>
            ))}
          </div>

          <div className={styles.copyright}>© Skatteetaten</div>
        </div>
      </main>
    </>
  );
}
