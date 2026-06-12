import {
  ChevronDown,
  Clock3,
  Download,
  FolderOpen,
  Heart,
  Library,
  ListMusic,
  MoreHorizontal,
  Play,
  RotateCcw,
  Search,
  SkipBack,
  SkipForward,
  Sparkles
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createCategory, fetchAlbums, fetchCategories, fetchNas, generateAlbumCover, saveNas, scanNas, updateAlbumCover } from './api';
import type { Album, AppView, Category, Episode, MediaKind, NasConfig } from './types';

const tabs: Array<{ kind: MediaKind; label: string }> = [
  { kind: 'drama', label: '广播剧' },
  { kind: 'book', label: '有声书' },
  { kind: 'course', label: '网课' }
];

type SketchIconName =
  | 'home'
  | 'files'
  | 'search'
  | 'me'
  | 'drama'
  | 'book'
  | 'course'
  | 'category'
  | 'timer'
  | 'chase'
  | 'history'
  | 'cover'
  | 'nas'
  | 'backup'
  | 'settings'
  | 'cache';

const navItems: Array<{ view: AppView; label: string; icon: SketchIconName }> = [
  { view: 'home', label: '首页', icon: 'home' },
  { view: 'files', label: '文件', icon: 'files' },
  { view: 'search', label: '搜索', icon: 'search' },
  { view: 'me', label: '我的', icon: 'me' }
];

function kindLabel(kind: MediaKind) {
  return tabs.find((tab) => tab.kind === kind)?.label || '内容';
}

function coverBackground(cover?: string) {
  if (!cover) return 'linear-gradient(145deg, #fff6f2, #ffe4e5)';
  if (cover.startsWith('linear-gradient(') || cover.startsWith('radial-gradient(')) return cover;
  return `url(${JSON.stringify(cover)})`;
}

function isImageCover(cover?: string) {
  return Boolean(cover && !cover.includes('gradient('));
}

export function App() {
  const [view, setView] = useState<AppView>('home');
  const [activeKind, setActiveKind] = useState<MediaKind>('drama');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [nas, setNas] = useState<NasConfig | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [query, setQuery] = useState('');
  const [nasRoot, setNasRoot] = useState('');
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [playerAlbum, setPlayerAlbum] = useState<Album | null>(null);
  const [playerEpisode, setPlayerEpisode] = useState<Episode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function load(kind = activeKind, q = query, category = activeCategory) {
    setIsLoading(true);
    try {
      const [nextAlbums, nextNas, nextCategories] = await Promise.all([fetchAlbums(kind, q, category), fetchNas(), fetchCategories()]);
      setAlbums(nextAlbums);
      setNas(nextNas);
      setCategories(nextCategories);
      setNasRoot(nextNas.root || '');
      setSelectedAlbum((current) => {
        if (!current) return null;
        return nextAlbums.some((album) => album.id === current.id) ? current : null;
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load(activeKind, query, activeCategory);
  }, [activeKind, activeCategory]);

  const continueAlbum = useMemo(() => albums.find((album) => album.status === 'listening') || albums[0], [albums]);
  const currentEpisode = continueAlbum?.episodes.find((episode) => (episode.progress || 0) < 100) || continueAlbum?.episodes[0];
  const displayedPlayerAlbum = playerAlbum || continueAlbum;
  const displayedPlayerEpisode = playerEpisode || currentEpisode;

  function nextPlayableEpisode(album: Album) {
    return album.episodes.find((episode) => episode.filePath && (episode.progress || 0) < 100) || album.episodes.find((episode) => episode.filePath) || album.episodes[0];
  }

  async function playAlbum(album: Album, episode = nextPlayableEpisode(album)) {
    if (!episode?.filePath) {
      setNotice('这个条目还没有真实音频文件，请先在 NAS 文件页扫描音频');
      setPlayerAlbum(album);
      setPlayerEpisode(episode || null);
      setIsPlaying(false);
      return;
    }

    setPlayerAlbum(album);
    setPlayerEpisode(episode);
    const audio = audioRef.current;
    if (!audio) return;

    const src = `/media/${encodeURIComponent(album.id)}/${encodeURIComponent(episode.id)}`;
    if (!audio.src.endsWith(src)) audio.src = src;
    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setNotice('浏览器拦截了自动播放，请再点一次播放按钮');
      setIsPlaying(false);
    }
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!displayedPlayerAlbum || !displayedPlayerEpisode || !audio) return;
    if (!displayedPlayerEpisode.filePath) {
      void playAlbum(displayedPlayerAlbum, displayedPlayerEpisode);
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    void playAlbum(displayedPlayerAlbum, displayedPlayerEpisode);
  }

  async function handleScan() {
    try {
      setNotice('正在扫描 NAS...');
      const result = await scanNas();
      setAlbums(result.albums.filter((album) => album.kind === activeKind));
      setNas(result.nas);
      setNotice(`扫描完成，发现 ${result.count} 个音频文件`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '扫描失败');
    }
  }

  async function handleSaveNas() {
    try {
      const next = await saveNas(nasRoot);
      setNas(next);
      setNotice(next.connected ? 'NAS 路径已连接' : '路径已保存，但当前不可访问');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '保存失败');
    }
  }

  async function handleSearch(nextQuery: string) {
    setQuery(nextQuery);
    if (view === 'search') {
      const result = await fetchAlbums(undefined, nextQuery, activeCategory);
      setAlbums(result);
    }
  }

  async function handleAddCategory(name: string) {
    const nextCategories = await createCategory(name);
    setCategories(nextCategories);
    setNotice('分类已添加');
  }

  async function handleCoverChange(albumId: string, cover: string) {
    const updatedAlbum = await updateAlbumCover(albumId, cover);
    setAlbums((current) => current.map((album) => (album.id === albumId ? updatedAlbum : album)));
    setSelectedAlbum((current) => (current?.id === albumId ? updatedAlbum : current));
    setNotice('封面已保存');
  }

  async function handleGenerateCover(albumId: string) {
    try {
      setNotice('正在生成 AI 封面...');
      const updatedAlbum = await generateAlbumCover(albumId);
      setAlbums((current) => current.map((album) => (album.id === albumId ? updatedAlbum : album)));
      setSelectedAlbum((current) => (current?.id === albumId ? updatedAlbum : current));
      setNotice('AI 封面已生成');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'AI 封面生成失败');
    }
  }

  return (
    <div className="app-shell">
      <aside className="desktop-rail" aria-label="主导航">
        <div className="rail-brand">听</div>
        {navItems.map((item) => {
          return (
            <button key={item.view} className={view === item.view ? 'rail-item active' : 'rail-item'} onClick={() => setView(item.view)}>
              <SketchIcon name={item.icon} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </aside>

      <main className="phone-frame">
        <header className="topbar">
          <div className="search-pill">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => void handleSearch(event.target.value)}
              onFocus={() => setView('search')}
              placeholder="搜本地剧集、书名、课程"
            />
          </div>
          <div className={nas?.connected ? 'nas-chip online' : 'nas-chip'}>
            <span />
            {nas?.connected ? 'NAS 在线' : '未连接'}
          </div>
        </header>

        {notice ? (
          <button className="notice" onClick={() => setNotice('')}>
            {notice}
          </button>
        ) : null}

        <section className="content-area">
          {view === 'home' ? (
            <HomeView
              albums={albums}
              activeKind={activeKind}
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              onKindChange={setActiveKind}
              onViewChange={setView}
              isLoading={isLoading}
              onOpen={setSelectedAlbum}
              onPlay={playAlbum}
              selectedAlbum={selectedAlbum}
            />
          ) : null}
          {view === 'files' ? (
            <FilesView nas={nas} nasRoot={nasRoot} setNasRoot={setNasRoot} onSave={handleSaveNas} onScan={handleScan} />
          ) : null}
          {view === 'search' ? (
            <SearchView query={query} setQuery={(value) => void handleSearch(value)} albums={albums} onOpen={setSelectedAlbum} onPlay={playAlbum} />
          ) : null}
          {view === 'me' ? <MeView nas={nas} albums={albums} categories={categories} onAddCategory={handleAddCategory} /> : null}
        </section>

        {selectedAlbum ? (
          <AlbumDrawer
            album={selectedAlbum}
            onClose={() => setSelectedAlbum(null)}
            onCoverChange={handleCoverChange}
            onGenerateCover={handleGenerateCover}
            onPlay={playAlbum}
          />
        ) : null}

        <nav className="bottom-nav" aria-label="底部导航">
          <BottomNavButton item={navItems[0]} view={view} setView={setView} />
          <BottomNavButton item={navItems[1]} view={view} setView={setView} />
          <button
            className={isPlaying ? 'nav-player playing' : 'nav-player'}
            aria-label="打开当前播放项目"
            onClick={() => {
              if (displayedPlayerAlbum) setSelectedAlbum(displayedPlayerAlbum);
            }}
          >
            <span className="nav-player-cover" style={{ background: coverBackground(displayedPlayerAlbum?.cover) }} />
            <span className="nav-player-glyph">
              <Play size={15} fill="currentColor" />
            </span>
          </button>
          <BottomNavButton item={navItems[2]} view={view} setView={setView} />
          <BottomNavButton item={navItems[3]} view={view} setView={setView} />
        </nav>
        <audio ref={audioRef} onPause={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} onEnded={() => setIsPlaying(false)} />
      </main>
    </div>
  );
}

function BottomNavButton({
  item,
  view,
  setView
}: {
  item: (typeof navItems)[number];
  view: AppView;
  setView: (view: AppView) => void;
}) {
  return (
    <button className={view === item.view ? 'active' : ''} onClick={() => setView(item.view)}>
      <SketchIcon name={item.icon} />
      <span>{item.label}</span>
    </button>
  );
}

function HomeView({
  albums,
  activeKind,
  categories,
  activeCategory,
  onCategoryChange,
  onKindChange,
  onViewChange,
  isLoading,
  onOpen,
  onPlay,
  selectedAlbum
}: {
  albums: Album[];
  activeKind: MediaKind;
  categories: Category[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  onKindChange: (kind: MediaKind) => void;
  onViewChange: (view: AppView) => void;
  isLoading: boolean;
  onOpen: (album: Album) => void;
  onPlay: (album: Album) => void;
  selectedAlbum: Album | null;
}) {
  const hero = albums.find((album) => album.status === 'listening') || albums[0];

  if (isLoading) {
    return <div className="empty-state">正在整理你的私人听书房...</div>;
  }

  return (
    <>
      <section className="hero-card" style={{ '--hero-cover': coverBackground(hero?.cover) } as React.CSSProperties}>
        <div className="hero-bg" aria-hidden="true" />
        <div>
          <p className="eyebrow">继续听</p>
          <h1>{hero?.title || `还没有${kindLabel(activeKind)}`}</h1>
          <p>{hero?.subtitle || '连接 NAS 后扫描本地音频，就会出现在这里。'}</p>
          {hero ? (
            <button className="primary-action" onClick={() => onPlay(hero)}>
              <Play size={18} fill="currentColor" />
              继续播放
            </button>
          ) : null}
          {hero ? (
            <div className="hero-progress">
              <span style={{ width: `${hero.progress}%` }} />
              <small>已播放 {hero.progress}%</small>
            </div>
          ) : null}
        </div>
        <div className="hero-cover" style={{ background: coverBackground(hero?.cover) }} aria-hidden="true" />
      </section>

      <QuickSketchStrip activeKind={activeKind} onKindChange={onKindChange} onViewChange={onViewChange} />

      <SectionHeader title={kindLabel(activeKind)} subtitle="本地 NAS 内容 ›" />
      <CategoryChips categories={categories} activeCategory={activeCategory} onChange={onCategoryChange} />
      {activeKind === 'drama' ? (
        <div className="drama-list">
          {albums.map((album) => (
            <DramaListRow key={album.id} album={album} onOpen={onOpen} onPlay={onPlay} />
          ))}
        </div>
      ) : (
        <div className="album-grid">
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} active={selectedAlbum?.id === album.id} onOpen={onOpen} />
          ))}
        </div>
      )}

      <SectionHeader title="睡前继续" subtitle="保留断点，安静续播" />
      <div className="soft-list">
        {albums.slice(0, 3).map((album) => (
          <button key={album.id} onClick={() => onOpen(album)}>
            <Clock3 size={18} />
            <span>{album.title}</span>
            <small>{album.progress}%</small>
          </button>
        ))}
      </div>
    </>
  );
}

function DramaListRow({ album, onOpen, onPlay }: { album: Album; onOpen: (album: Album) => void; onPlay: (album: Album) => void }) {
  const nextEpisode = album.episodes.find((episode) => (episode.progress || 0) < 100) || album.episodes[0];
  const lastIndex = nextEpisode ? Math.max(1, album.episodes.findIndex((episode) => episode.id === nextEpisode.id) + 1) : 1;

  return (
    <article className="drama-row">
      <button className="drama-row-main" onClick={() => onOpen(album)}>
        <span className="drama-row-cover" style={{ background: coverBackground(album.cover) }} />
        <span className="drama-row-copy">
          <strong>{album.title}</strong>
          <small>第一季 · 共 {album.totalEpisodes} 集</small>
          <em>
            已播放 <b>{album.progress}%</b> · 上次听到 <b>第 {String(lastIndex).padStart(2, '0')} 集</b>
          </em>
          <span className="drama-row-progress">
            <i style={{ width: `${album.progress}%` }} />
          </span>
        </span>
      </button>
      <button className="drama-play" aria-label={`播放 ${album.title}`} onClick={() => onPlay(album)}>
        <Play size={22} fill="currentColor" />
      </button>
    </article>
  );
}

function QuickSketchStrip({
  activeKind,
  onKindChange,
  onViewChange
}: {
  activeKind: MediaKind;
  onKindChange: (kind: MediaKind) => void;
  onViewChange: (view: AppView) => void;
}) {
  const items: Array<{ icon: SketchIconName; label: string; kind?: MediaKind; view?: AppView }> = [
    { icon: 'drama', label: '广播剧', kind: 'drama' },
    { icon: 'book', label: '有声书', kind: 'book' },
    { icon: 'course', label: '网课', kind: 'course' },
    { icon: 'category', label: '分类', view: 'home' }
  ];

  return (
    <div className="quick-sketch-strip" aria-label="快捷入口">
      {items.map((item) => (
        <button
          key={item.label}
          className={item.kind && activeKind === item.kind ? 'active' : ''}
          onClick={() => {
            if (item.kind) onKindChange(item.kind);
            if (item.view) onViewChange(item.view);
          }}
        >
          <SketchIcon name={item.icon} decorated />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function SketchIcon({ name, decorated = false }: { name: SketchIconName; decorated?: boolean }) {
  return (
    <svg className={decorated ? 'sketch-icon decorated' : 'sketch-icon'} viewBox="0 0 48 48" aria-hidden="true">
      {name === 'home' ? (
        <>
          <path d="M9 23.5 24 10l15 13.5" />
          <path d="M14 22v16h20V22" />
          <path className="accent-line" d="M21 38V27h7v11" />
          <circle className="accent-dot" cx="36" cy="14" r="2.2" />
        </>
      ) : null}
      {name === 'files' ? (
        <>
          <path d="M8 16.5h12l3.5 4H40v17H8z" />
          <path d="M10 21h29" />
          <path className="accent-line" d="M14 31h14" />
          <circle className="accent-dot" cx="35" cy="31" r="2.1" />
        </>
      ) : null}
      {name === 'search' ? (
        <>
          <circle cx="21" cy="21" r="11" />
          <path d="m29 29 10 10" />
          <path className="accent-line" d="M16 18c2-3 6-4 10-2" />
        </>
      ) : null}
      {name === 'me' ? (
        <>
          <path d="M24 24c5 0 8-3.5 8-8s-3-7.5-8-7.5-8 3-8 7.5 3 8 8 8Z" />
          <path d="M10 40c2.2-7.5 8-11 14-11s11.8 3.5 14 11" />
          <path className="accent-line" d="M18 37c2-1.3 4-2 6-2s4 .7 6 2" />
        </>
      ) : null}
      {name === 'drama' ? (
        <>
          <path d="M12 14h24v20H12z" />
          <path d="M18 14v-3h12v3" />
          <path className="accent-line" d="M18 28c2.3 3.2 9.7 3.2 12 0" />
          <circle cx="19" cy="22" r="1.8" />
          <circle cx="29" cy="22" r="1.8" />
          <path className="accent-fill" d="M35 9c3 0 5 2 5 5-3 0-5-2-5-5Z" />
        </>
      ) : null}
      {name === 'book' ? (
        <>
          <path d="M11 11h14c4 0 7 3 7 7v19H18c-4 0-7-3-7-7z" />
          <path d="M32 15h5v22h-5" />
          <path className="accent-line" d="M17 20h10M17 26h8" />
          <circle className="accent-dot" cx="36" cy="12" r="2.2" />
        </>
      ) : null}
      {name === 'course' ? (
        <>
          <path d="M10 14h28v20H10z" />
          <path d="M15 38h18" />
          <path d="M24 34v4" />
          <path className="accent-line" d="M17 22h14M17 27h9" />
          <path className="accent-fill" d="M34 22h3v8h-3z" />
        </>
      ) : null}
      {name === 'category' ? (
        <>
          <path d="M12 16h9v9h-9zM27 16h9v9h-9zM12 31h9v9h-9zM27 31h9v9h-9z" />
          <path className="accent-line" d="M16 20h1M31 35h1" />
          <circle className="accent-dot" cx="36" cy="13" r="2.1" />
        </>
      ) : null}
      {name === 'timer' ? (
        <>
          <circle cx="24" cy="25" r="13" />
          <path d="M20 9h8M24 12v4M24 25l7-5" />
          <path className="accent-line" d="M17 35c4 3 10 3 14 0" />
          <circle className="accent-dot" cx="35" cy="15" r="2" />
        </>
      ) : null}
      {name === 'chase' ? (
        <>
          <path d="M14 10h20v28l-10-6-10 6z" />
          <path className="accent-line" d="M19 19h10M19 25h7" />
          <circle className="accent-dot" cx="33" cy="13" r="2.2" />
        </>
      ) : null}
      {name === 'history' ? (
        <>
          <path d="M11 24c0-7 5.5-13 13-13 7 0 13 5.8 13 13s-5.8 13-13 13c-4.5 0-8.4-2.2-10.8-5.6" />
          <path d="M11 16v8h8M24 17v8l6 3" />
          <circle className="accent-dot" cx="31" cy="16" r="2" />
        </>
      ) : null}
      {name === 'cover' ? (
        <>
          <rect x="12" y="10" width="24" height="28" rx="4" />
          <path d="M17 30 22 24l4 4 3-3 5 6" />
          <circle className="accent-dot" cx="29" cy="17" r="2.3" />
        </>
      ) : null}
      {name === 'nas' ? (
        <>
          <rect x="10" y="13" width="28" height="22" rx="4" />
          <path d="M16 20h16M16 27h16" />
          <circle className="accent-dot" cx="18" cy="27" r="1.8" />
          <path className="accent-line" d="M31 35v4M24 39h14" />
        </>
      ) : null}
      {name === 'backup' ? (
        <>
          <path d="M15 33h18c4 0 7-3 7-7s-3-7-7-7c-1.6-5-6-8-11-7-4 .8-7.2 3.8-8 7-4 .6-7 3.5-7 7.2C7 30 10.2 33 15 33Z" />
          <path className="accent-line" d="M24 18v12M19 25l5 5 5-5" />
        </>
      ) : null}
      {name === 'settings' ? (
        <>
          <circle cx="24" cy="24" r="5" />
          <path d="M24 9v5M24 34v5M9 24h5M34 24h5M13.5 13.5l3.5 3.5M31 31l3.5 3.5M34.5 13.5 31 17M17 31l-3.5 3.5" />
          <circle className="accent-dot" cx="35" cy="13" r="2" />
        </>
      ) : null}
      {name === 'cache' ? (
        <>
          <path d="M12 15c0-4 24-4 24 0v18c0 4-24 4-24 0z" />
          <path d="M12 15c0 4 24 4 24 0M12 24c0 4 24 4 24 0" />
          <path className="accent-line" d="M20 33h8" />
        </>
      ) : null}
    </svg>
  );
}

function CategoryChips({
  categories,
  activeCategory,
  onChange
}: {
  categories: Category[];
  activeCategory: string;
  onChange: (category: string) => void;
}) {
  return (
    <div className="category-chips" aria-label="分类筛选">
      <button className={!activeCategory ? 'active' : ''} onClick={() => onChange('')}>
        全部
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          className={activeCategory === category.name ? 'active' : ''}
          onClick={() => onChange(category.name)}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}

function AlbumCard({ album, active, onOpen }: { album: Album; active?: boolean; onOpen: (album: Album) => void }) {
  return (
    <button className={active ? 'album-card active' : 'album-card'} onClick={() => onOpen(album)}>
      <div className="album-cover" style={{ background: coverBackground(album.cover) }}>
        {isImageCover(album.cover) ? null : <Sparkles size={22} />}
      </div>
      <div className="album-copy">
        <strong>{album.title}</strong>
        <span>{album.subtitle}</span>
      </div>
      <div className="progress-track">
        <span style={{ width: `${album.progress}%` }} />
      </div>
    </button>
  );
}

function FilesView({
  nas,
  nasRoot,
  setNasRoot,
  onSave,
  onScan
}: {
  nas: NasConfig | null;
  nasRoot: string;
  setNasRoot: (value: string) => void;
  onSave: () => void;
  onScan: () => void;
}) {
  return (
    <section className="panel-page">
      <SectionHeader title="NAS 文件" subtitle="先支持本地挂载路径，后续可扩展 SMB/WebDAV 登录" />
      <div className="settings-card">
        <label htmlFor="nas-root">NAS 挂载路径</label>
        <input id="nas-root" value={nasRoot} onChange={(event) => setNasRoot(event.target.value)} placeholder="/Volumes/你的NAS/广播剧" />
        <div className="button-row">
          <button onClick={onSave}>保存路径</button>
          <button className="filled" onClick={onScan}>
            扫描音频
          </button>
        </div>
        <p>{nas?.connected ? `已连接：${nas.root}` : '当前未连接。可以先把 NAS 挂载到本机，再填入路径。'}</p>
      </div>

      <div className="file-hints">
        <div>
          <FolderOpen size={22} />
          <strong>目录即专辑</strong>
          <span>每个文件夹会自动整理成一个广播剧、有声书或网课专辑。</span>
        </div>
        <div>
          <Library size={22} />
          <strong>本地索引</strong>
          <span>搜索只查本地数据库，不连接外部平台。</span>
        </div>
      </div>
    </section>
  );
}

function SearchView({
  query,
  setQuery,
  albums,
  onOpen,
  onPlay
}: {
  query: string;
  setQuery: (value: string) => void;
  albums: Album[];
  onOpen: (album: Album) => void;
  onPlay: (album: Album) => void;
}) {
  return (
    <section className="panel-page">
      <SectionHeader title="本地搜索" subtitle="搜 NAS 索引，不走外部联网" />
      <div className="large-search">
        <Search size={20} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入剧名、书名、课程名" />
      </div>
      <div className="result-list">
        {albums.map((album) => (
          <div key={album.id} className="result-row">
            <button className="result-main" onClick={() => onOpen(album)}>
              <span className="mini-cover" style={{ background: coverBackground(album.cover) }} />
              <span>
                <strong>{album.title}</strong>
                <small>{album.subtitle}</small>
              </span>
            </button>
            <button className="inline-play" type="button" aria-label={`播放 ${album.title}`} onClick={() => onPlay(album)}>
              <Play size={17} fill="currentColor" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function MeView({
  nas,
  albums,
  categories,
  onAddCategory
}: {
  nas: NasConfig | null;
  albums: Album[];
  categories: Category[];
  onAddCategory: (name: string) => Promise<void>;
}) {
  const [categoryName, setCategoryName] = useState('');

  async function submitCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    await onAddCategory(name);
    setCategoryName('');
  }

  const myTools: Array<{ icon: SketchIconName; label: string; note: string }> = [
    { icon: 'nas', label: 'NAS 设置', note: '连接目录' },
    { icon: 'timer', label: '定时关闭', note: '睡前播放' },
    { icon: 'chase', label: '我的追剧', note: '继续听' },
    { icon: 'category', label: '分类设置', note: '古代/现代' },
    { icon: 'history', label: '播放历史', note: '断点记录' },
    { icon: 'cover', label: '封面管理', note: '手动美化' },
    { icon: 'cache', label: '本地缓存', note: '离线听' },
    { icon: 'backup', label: '数据备份', note: '保护记录' },
    { icon: 'settings', label: '应用设置', note: '偏好设置' }
  ];

  return (
    <section className="me-page">
      <div className="me-top-actions">
        <button aria-label="扫描">
          <SketchIcon name="search" />
        </button>
        <button aria-label="设置">
          <SketchIcon name="settings" />
        </button>
      </div>

      <div className="me-profile-card">
        <div className="me-profile-main">
          <div className="me-avatar">听</div>
          <div>
            <h1>私人听书房</h1>
            <p>{nas?.connected ? 'NAS 已连接' : '等待连接 NAS'}</p>
          </div>
        </div>
        <div className="me-stats-row">
          <div>
            <strong>{albums.length}</strong>
            <span>专辑</span>
          </div>
          <div>
            <strong>{albums.reduce((sum, album) => sum + album.totalEpisodes, 0)}</strong>
            <span>分集</span>
          </div>
          <div>
            <strong>{categories.length}</strong>
            <span>分类</span>
          </div>
        </div>
      </div>

      <div className="me-tool-grid">
        {myTools.map((tool) => (
          <button key={tool.label}>
            <SketchIcon name={tool.icon} decorated />
            <strong>{tool.label}</strong>
            <span>{tool.note}</span>
          </button>
        ))}
      </div>

      <div className="settings-card category-settings-card">
        <label htmlFor="category-name">分类设置</label>
        <form className="category-form" onSubmit={submitCategory}>
          <input
            id="category-name"
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            placeholder="比如：古代、现代、修仙"
          />
          <button type="submit">添加</button>
        </form>
        <div className="category-preview">
          {categories.map((category) => (
            <span key={category.id}>{category.name}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function AlbumDrawer({
  album,
  onClose,
  onCoverChange,
  onGenerateCover,
  onPlay
}: {
  album: Album;
  onClose: () => void;
  onCoverChange: (albumId: string, cover: string) => Promise<void>;
  onGenerateCover: (albumId: string) => Promise<void>;
  onPlay: (album: Album) => void;
}) {
  const [isSavingCover, setIsSavingCover] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const activeEpisode = album.episodes.find((episode) => (episode.progress || 0) < 100) || album.episodes[0];

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;
      setIsSavingCover(true);
      try {
        await onCoverChange(album.id, reader.result);
      } finally {
        setIsSavingCover(false);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <section className="album-drawer" aria-label="专辑详情">
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer-panel">
        <div className="player-ambient" style={{ background: coverBackground(album.cover) }} aria-hidden="true" />
        <div className="player-topbar">
          <button className="player-icon-button" onClick={onClose} aria-label="关闭">
            <ChevronDown size={27} />
          </button>
          <div>
            <strong>{album.title}</strong>
            <span>{album.subtitle}</span>
          </div>
          <button className="player-icon-button" aria-label="刷新">
            <RotateCcw size={24} />
          </button>
        </div>

        <div className="player-cover-stage" style={{ background: coverBackground(album.cover) }}>
          <div className="player-cover-title">
            <span>{kindLabel(album.kind)} · {album.totalEpisodes} 集</span>
            <strong>{album.title}</strong>
          </div>
        </div>

        <div className="player-sheet">
          <div className="player-actions" aria-label="播放操作">
            <button>
              <Heart size={27} />
              <span>喜欢</span>
            </button>
            <button>
              <Download size={26} />
              <span>缓存</span>
            </button>
            <button>
              <Sparkles size={28} />
              <span>追剧</span>
            </button>
            <button>
              <FolderOpen size={27} />
              <span>文件</span>
            </button>
            <button>
              <MoreHorizontal size={29} />
              <span>更多</span>
            </button>
          </div>

          <div className="player-progress">
            <div className="progress-line">
              <span style={{ width: `${album.progress}%` }} />
            </div>
            <div>
              <small>{activeEpisode?.progress ? `${activeEpisode.progress}%` : '00:02'}</small>
              <small>{activeEpisode?.duration || '00:00'}</small>
            </div>
          </div>

          <div className="transport-controls">
            <button aria-label="后退 15 秒">15s</button>
            <button aria-label="上一集">
              <SkipBack size={30} fill="currentColor" />
            </button>
            <button className="transport-play" onClick={() => onPlay(album)} aria-label="播放">
              <Play size={34} fill="currentColor" />
            </button>
            <button aria-label="下一集">
              <SkipForward size={30} fill="currentColor" />
            </button>
            <button aria-label="播放列表">
              <ListMusic size={32} />
            </button>
          </div>

          <div className="player-tabs">
            <button className="active">简介</button>
            <button>分集</button>
            <button>文件</button>
          </div>

          <div className="player-summary">
            <span className="kind-badge">{kindLabel(album.kind)}</span>
            <p>{album.description}</p>
            <div className="cover-tools">
              <label className="cover-upload">
                <input type="file" accept="image/*" onChange={handleFileChange} />
                {isSavingCover ? '保存中...' : '更换封面'}
              </label>
              <button
                className="cover-generate"
                disabled={isGeneratingCover}
                onClick={async () => {
                  setIsGeneratingCover(true);
                  try {
                    await onGenerateCover(album.id);
                  } finally {
                    setIsGeneratingCover(false);
                  }
                }}
              >
                {isGeneratingCover ? '生成中...' : 'AI 封面'}
              </button>
            </div>
          </div>

          <SectionHeader title="分集" subtitle={`${album.totalEpisodes} 集 · ${album.progress}%`} />
          <div className="episode-list player-episode-list">
            {album.episodes.map((episode, index) => (
              <button key={episode.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{episode.title}</strong>
                <small>{episode.duration}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}
