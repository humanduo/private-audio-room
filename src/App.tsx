import {
  ChevronDown,
  Clock3,
  Download,
  FolderOpen,
  Heart,
  ListMusic,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  Search,
  SlidersHorizontal,
  SkipBack,
  SkipForward,
  Sparkles
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addAlbumToFavoriteFolder,
  analyzeAlbumMetadata,
  analyzeLibraryMetadata,
  createFavoriteFolder,
  estimateLibraryMetadata,
  createCategory,
  fetchAlbumRecommendations,
  fetchAlbums,
  fetchCategories,
  fetchFavoriteFolders,
  fetchNas,
  fetchProfile,
  generateAlbumCover,
  refreshCvAvatars,
  removeAlbumFromFavoriteFolder,
  saveNas,
  scanNas,
  updateEpisodeProgress,
  updateAlbumCover,
  updateAlbumMetadata,
  updateProfileAvatar
} from './api';
import type {
  Album,
  AlbumRecommendation,
  AppView,
  Category,
  Episode,
  FavoriteFolder,
  MediaKind,
  MetadataAnalyzeEstimate,
  MetadataAnalyzeJob,
  MetadataAnalyzeMode,
  NasConfig,
  SearchMode
} from './types';

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
  | 'cv'
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

type MetadataFilters = {
  relationship: string;
  audience: string;
  finishStatus: string;
  genres: string[];
};

type HomePanel = MediaKind | 'cv';

type CvProfile = {
  name: string;
  initial: string;
  count: number;
  albums: Album[];
  cover?: string;
};

const emptyMetadataFilters: MetadataFilters = {
  relationship: '',
  audience: '',
  finishStatus: '',
  genres: []
};
const searchModeOptions: Array<{ mode: SearchMode; label: string; placeholder: string }> = [
  { mode: 'text', label: '搜剧名', placeholder: '搜本地剧集、书名、课程' },
  { mode: 'cv', label: '搜 CV', placeholder: '输入配音演员 / CV 名字' }
];

const relationshipOptions = ['言情', '耽美', '百合', '无 CP', '群像'];
const audienceOptions = ['男女', '男男', '女女', '群像'];
const finishStatusOptions = ['已完结', '连载中', '未知'];
const genreOptions = ['悬疑', '恐怖', '刑侦', '甜宠', '虐恋', '权谋', '无限流', '校园', '娱乐圈', '古风', '现代', '修仙'];

const navItems: Array<{ view: AppView; label: string; icon: SketchIconName }> = [
  { view: 'home', label: '首页', icon: 'home' },
  { view: 'files', label: '文件', icon: 'files' },
  { view: 'search', label: '搜索', icon: 'search' },
  { view: 'me', label: '我的', icon: 'me' }
];

const favoriteCvStorageKey = 'private-audio-room.favorite-cvs';

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

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function splitList(value: string) {
  return [...new Set(value.split(/[，,、\n]/).map((item) => item.trim()).filter(Boolean))];
}

function joinList(values?: string[]) {
  return (values || []).join('、');
}

function albumSummary(album: Album) {
  return album.summary || album.description || album.subtitle;
}

function albumChips(album: Album, limit = 4) {
  return [...new Set([album.finishStatus, album.relationship, album.audience, ...(album.genres || []), ...(album.tags || [])].filter(Boolean) as string[])].slice(
    0,
    limit
  );
}

function cvInitial(name: string) {
  const first = name.trim()[0] || '#';
  if (/^[a-z]$/i.test(first)) return first.toUpperCase();
  if (/^\d$/.test(first)) return '#';
  return first;
}

function buildCvProfiles(albums: Album[]): CvProfile[] {
  const groups = new Map<string, Album[]>();
  for (const album of albums.filter((item) => item.kind === 'drama')) {
    for (const cv of album.cast || []) {
      const name = cv.trim();
      if (!name) continue;
      const list = groups.get(name) || [];
      list.push(album);
      groups.set(name, list);
    }
  }
  return [...groups.entries()]
    .map(([name, cvAlbums]) => ({
      name,
      initial: cvInitial(name),
      count: cvAlbums.length,
      albums: cvAlbums,
      cover: cvAlbums.find((album) => isImageCover(album.cover))?.cover || cvAlbums[0]?.cover
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN', { sensitivity: 'base', numeric: true }));
}

function filterValues(album: Album) {
  return [
    album.title,
    album.subtitle,
    album.summary || '',
    album.description || '',
    album.relationship || '',
    album.audience || '',
    album.finishStatus || '',
    ...(album.genres || []),
    ...(album.tags || [])
  ].filter(Boolean);
}

function hasFilterValue(album: Album, value: string) {
  const aliases: Record<string, string[]> = {
    已完结: ['已完结', '完结'],
    连载中: ['连载中', '更新', '连载']
  };
  const targets = aliases[value] || [value];
  return filterValues(album).some((item) => targets.some((target) => item.includes(target)));
}

function matchesMetadataFilters(album: Album, filters: MetadataFilters) {
  if (filters.relationship && !hasFilterValue(album, filters.relationship)) return false;
  if (filters.audience && !hasFilterValue(album, filters.audience)) return false;
  if (filters.finishStatus === '未知' && album.finishStatus) return false;
  if (filters.finishStatus && filters.finishStatus !== '未知' && !hasFilterValue(album, filters.finishStatus)) return false;
  if (filters.genres.length && !filters.genres.every((genre) => hasFilterValue(album, genre))) return false;
  return true;
}

function metadataFilterCount(filters: MetadataFilters) {
  return Number(Boolean(filters.relationship)) + Number(Boolean(filters.audience)) + Number(Boolean(filters.finishStatus)) + filters.genres.length;
}

export function App() {
  const [view, setView] = useState<AppView>('home');
  const [activeKind, setActiveKind] = useState<MediaKind>('drama');
  const [activeHomePanel, setActiveHomePanel] = useState<HomePanel>('drama');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [cvAlbums, setCvAlbums] = useState<Album[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [favoriteFolders, setFavoriteFolders] = useState<FavoriteFolder[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [nas, setNas] = useState<NasConfig | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('text');
  const [nasRoot, setNasRoot] = useState('');
  const [notice, setNotice] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [playerAlbum, setPlayerAlbum] = useState<Album | null>(null);
  const [playerEpisode, setPlayerEpisode] = useState<Episode | null>(null);
  const [metadataAnalyzeJob, setMetadataAnalyzeJob] = useState<MetadataAnalyzeJob | null>(null);
  const [favoriteCvs, setFavoriteCvs] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(favoriteCvStorageKey) || '[]');
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    } catch {
      return [];
    }
  });
  const [cvAvatars, setCvAvatars] = useState<Record<string, string>>({});
  const [isRefreshingCvAvatars, setIsRefreshingCvAvatars] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastProgressSaveRef = useRef(0);

  async function load(kind = activeKind, q = query, category = activeCategory, mode = searchMode) {
    setIsLoading(true);
    try {
      const [nextAlbums, nextCvAlbums, nextNas, nextCategories, nextFavoriteFolders] = await Promise.all([
        fetchAlbums(kind, q, category, mode),
        fetchAlbums('drama'),
        fetchNas(),
        fetchCategories(),
        fetchFavoriteFolders()
      ]);
      setAlbums(nextAlbums);
      setCvAlbums(nextCvAlbums);
      setNas(nextNas);
      setCategories(nextCategories);
      setFavoriteFolders(nextFavoriteFolders);
      setNasRoot(nextNas.root || '');
      fetchProfile()
        .then((profile) => setCvAvatars(profile.cvAvatars || {}))
        .catch(() => setCvAvatars({}));
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
    void load(activeKind, query, activeCategory, searchMode);
  }, [activeKind, activeCategory, searchMode]);

  useEffect(() => {
    localStorage.setItem(favoriteCvStorageKey, JSON.stringify(favoriteCvs));
  }, [favoriteCvs]);

  const continueAlbum = useMemo(() => albums.find((album) => album.status === 'listening') || albums[0], [albums]);
  const currentEpisode = continueAlbum?.episodes.find((episode) => (episode.progress || 0) < 100) || continueAlbum?.episodes[0];
  const displayedPlayerAlbum = playerAlbum || continueAlbum;
  const displayedPlayerEpisode = playerEpisode || currentEpisode;
  const audioProgress = audioDuration > 0 ? Math.min(100, Math.round((audioTime / audioDuration) * 100)) : displayedPlayerEpisode?.progress || 0;

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
    setSelectedAlbum((current) => (current?.id === album.id ? album : current));
    const audio = audioRef.current;
    if (!audio) return;

    const src = `/media/${encodeURIComponent(album.id)}/${encodeURIComponent(episode.id)}`;
    const absoluteSrc = new URL(src, window.location.href).href;
    if (audio.src !== absoluteSrc) {
      audio.src = src;
      audio.load();
      setAudioTime(0);
      setAudioDuration(0);
      audio.onloadedmetadata = () => {
        const duration = audio.duration || 0;
        setAudioDuration(duration);
        if (duration > 0 && episode.progress && episode.progress > 0 && episode.progress < 100) {
          audio.currentTime = Math.max(0, Math.min(duration - 1, (duration * episode.progress) / 100));
          setAudioTime(audio.currentTime);
        }
      };
    }
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

  function patchAlbumInState(nextAlbum: Album) {
    setAlbums((current) => current.map((album) => (album.id === nextAlbum.id ? nextAlbum : album)));
    setPlayerAlbum((current) => (current?.id === nextAlbum.id ? nextAlbum : current));
    setSelectedAlbum((current) => (current?.id === nextAlbum.id ? nextAlbum : current));
  }

  async function savePlaybackProgress(force = false) {
    const audio = audioRef.current;
    if (!displayedPlayerAlbum || !displayedPlayerEpisode || !audio || !audio.duration) return;
    const now = Date.now();
    if (!force && now - lastProgressSaveRef.current < 5000) return;
    lastProgressSaveRef.current = now;
    try {
      const nextAlbum = await updateEpisodeProgress(displayedPlayerAlbum.id, displayedPlayerEpisode.id, audio.currentTime || 0, audio.duration || 0);
      patchAlbumInState(nextAlbum);
    } catch {
      // Playback should not be interrupted if progress persistence fails.
    }
  }

  function seekAudio(nextTime: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(nextTime)) return;
    audio.currentTime = Math.max(0, Math.min(nextTime, audioDuration || nextTime));
    setAudioTime(audio.currentTime);
    void savePlaybackProgress(true);
  }

  async function handleScan() {
    try {
      setNotice('正在扫描 NAS...');
      const result = await scanNas();
      setAlbums(result.albums.filter((album) => album.kind === activeKind));
      setCvAlbums(result.albums.filter((album) => album.kind === 'drama'));
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
      const result = await fetchAlbums(undefined, nextQuery, activeCategory, searchMode);
      setAlbums(result);
    }
  }

  async function handleSearchModeChange(mode: SearchMode) {
    setSearchMode(mode);
    if (view === 'search') {
      const result = await fetchAlbums(undefined, query, activeCategory, mode);
      setAlbums(result);
    }
  }

  async function handleSearchCv(cv: string) {
    setSearchMode('cv');
    setQuery(cv);
    setSelectedAlbum(null);
    setView('search');
    const result = await fetchAlbums(undefined, cv, activeCategory, 'cv');
    setAlbums(result);
  }

  function handleHomePanelChange(panel: HomePanel) {
    setActiveHomePanel(panel);
    setView('home');
    if (panel !== 'cv') setActiveKind(panel);
  }

  function toggleFavoriteCv(cv: string) {
    setFavoriteCvs((current) => (current.includes(cv) ? current.filter((item) => item !== cv) : [cv, ...current]));
  }

  async function handleRefreshCvAvatars(names: string[]) {
    if (!names.length || isRefreshingCvAvatars) return;
    setIsRefreshingCvAvatars(true);
    try {
      const profile = await refreshCvAvatars(names);
      setCvAvatars(profile.cvAvatars || {});
      setNotice('CV 头像已刷新');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'CV 头像刷新失败');
    } finally {
      setIsRefreshingCvAvatars(false);
    }
  }

  async function handleAddCategory(name: string) {
    const nextCategories = await createCategory(name);
    setCategories(nextCategories);
    setNotice('分类已添加');
  }

  async function handleCreateFavoriteFolder(name: string) {
    const nextFolders = await createFavoriteFolder(name);
    setFavoriteFolders(nextFolders);
    setNotice('收藏夹已创建');
    return nextFolders;
  }

  async function handleAddFavorite(folderId: string, albumId: string) {
    const nextFolders = await addAlbumToFavoriteFolder(folderId, albumId);
    setFavoriteFolders(nextFolders);
    setNotice('已加入收藏');
  }

  async function handleRemoveFavorite(folderId: string, albumId: string) {
    const nextFolders = await removeAlbumFromFavoriteFolder(folderId, albumId);
    setFavoriteFolders(nextFolders);
    setNotice('已取消收藏');
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

  async function handleMetadataChange(albumId: string, metadata: Partial<Album>) {
    const updatedAlbum = await updateAlbumMetadata(albumId, metadata);
    setAlbums((current) => current.map((album) => (album.id === albumId ? updatedAlbum : album)));
    setSelectedAlbum((current) => (current?.id === albumId ? updatedAlbum : current));
    setPlayerAlbum((current) => (current?.id === albumId ? updatedAlbum : current));
    setNotice('资料已保存');
  }

  async function handleAnalyzeMetadata(albumId: string) {
    try {
      setNotice('DeepSeek 正在整理资料...');
      const result = await analyzeAlbumMetadata(albumId);
      setAlbums((current) => current.map((album) => (album.id === albumId ? result.album : album)));
      setSelectedAlbum((current) => (current?.id === albumId ? result.album : current));
      setPlayerAlbum((current) => (current?.id === albumId ? result.album : current));
      setNotice(result.metadata.needsReview ? 'DeepSeek 已整理，已加入待确认' : 'DeepSeek 已保存资料');
      return result;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'DeepSeek 资料整理失败');
      throw error;
    }
  }

  async function handleAnalyzeLibraryMetadata(mode: MetadataAnalyzeMode = 'all') {
    try {
      setNotice('DeepSeek 正在整理全部广播剧，这会需要一点时间...');
      const result = await analyzeLibraryMetadata(mode, setMetadataAnalyzeJob);
      setAlbums(result.albums.filter((album) => album.kind === activeKind));
      setSelectedAlbum((current) => (current ? result.albums.find((album) => album.id === current.id) || current : current));
      setPlayerAlbum((current) => (current ? result.albums.find((album) => album.id === current.id) || current : current));
      setNotice(`全库整理完成：成功 ${result.job.updated} 部，失败 ${result.job.failed} 部`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'DeepSeek 全库整理失败');
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
              placeholder={searchModeOptions.find((item) => item.mode === searchMode)?.placeholder || '搜本地剧集、书名、课程'}
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
              cvAlbums={cvAlbums}
              activeKind={activeKind}
              activeHomePanel={activeHomePanel}
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              onHomePanelChange={handleHomePanelChange}
              onViewChange={setView}
              isLoading={isLoading}
              onOpen={setSelectedAlbum}
              onOpenCv={handleSearchCv}
              favoriteCvs={favoriteCvs}
              cvAvatars={cvAvatars}
              isRefreshingCvAvatars={isRefreshingCvAvatars}
              onToggleFavoriteCv={toggleFavoriteCv}
              onRefreshCvAvatars={handleRefreshCvAvatars}
              onPlay={playAlbum}
              selectedAlbum={selectedAlbum}
              currentAlbum={displayedPlayerAlbum}
              currentEpisode={displayedPlayerEpisode}
              audioProgress={audioProgress}
              audioTime={audioTime}
              audioDuration={audioDuration}
              onSeek={seekAudio}
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
            />
          ) : null}
          {view === 'files' ? (
            <FilesView onOpen={setSelectedAlbum} />
          ) : null}
          {view === 'search' ? (
            <SearchView
              query={query}
              setQuery={(value) => void handleSearch(value)}
              searchMode={searchMode}
              setSearchMode={(mode) => void handleSearchModeChange(mode)}
              albums={albums}
              onOpen={setSelectedAlbum}
              onPlay={playAlbum}
            />
          ) : null}
          {view === 'me' ? (
            <MeView
              nas={nas}
              albums={albums}
              categories={categories}
              favoriteFolders={favoriteFolders}
              metadataAnalyzeJob={metadataAnalyzeJob}
              nasRoot={nasRoot}
              setNasRoot={setNasRoot}
              onSaveNas={handleSaveNas}
              onScanNas={handleScan}
              onAddCategory={handleAddCategory}
              onAnalyzeLibrary={handleAnalyzeLibraryMetadata}
              onOpen={setSelectedAlbum}
            />
          ) : null}
        </section>

        {selectedAlbum ? (
          <AlbumDrawer
            album={selectedAlbum}
            onClose={() => setSelectedAlbum(null)}
            onOpenAlbum={setSelectedAlbum}
            onCoverChange={handleCoverChange}
            onGenerateCover={handleGenerateCover}
            onMetadataChange={handleMetadataChange}
            onAnalyzeMetadata={handleAnalyzeMetadata}
            favoriteFolders={favoriteFolders}
            onCreateFavoriteFolder={handleCreateFavoriteFolder}
            onAddFavorite={handleAddFavorite}
            onRemoveFavorite={handleRemoveFavorite}
            onPlay={playAlbum}
            onSearchCv={handleSearchCv}
            currentEpisodeId={displayedPlayerEpisode?.id}
            isPlaying={isPlaying}
            audioTime={audioTime}
            audioDuration={audioDuration}
            audioProgress={audioProgress}
            onTogglePlay={togglePlay}
            onSeek={seekAudio}
          />
        ) : null}

        <nav className="bottom-nav" aria-label="底部导航">
          <BottomNavButton item={navItems[0]} view={view} setView={setView} />
          <BottomNavButton item={navItems[1]} view={view} setView={setView} />
          <button
            className={isPlaying ? 'nav-player playing' : 'nav-player'}
            aria-label={isPlaying ? '暂停当前播放' : '播放当前项目'}
            onClick={togglePlay}
          >
            <span className="nav-player-fox" aria-hidden="true">
              <span className="fox-ear left" />
              <span className="fox-ear right" />
              <span className="fox-face" />
            </span>
            <span className="nav-player-tail" aria-hidden="true" />
            <span className="nav-player-cover" style={{ background: coverBackground(displayedPlayerAlbum?.cover) }} />
            <span className="nav-player-glyph">
              {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
            </span>
          </button>
          <BottomNavButton item={navItems[2]} view={view} setView={setView} />
          <BottomNavButton item={navItems[3]} view={view} setView={setView} />
        </nav>
        <audio
          ref={audioRef}
          onPause={() => {
            setIsPlaying(false);
            void savePlaybackProgress(true);
          }}
          onPlay={() => setIsPlaying(true)}
          onEnded={() => {
            setIsPlaying(false);
            void savePlaybackProgress(true);
          }}
          onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration || 0)}
          onDurationChange={(event) => setAudioDuration(event.currentTarget.duration || 0)}
          onTimeUpdate={(event) => {
            setAudioTime(event.currentTarget.currentTime || 0);
            void savePlaybackProgress();
          }}
        />
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
  cvAlbums,
  activeKind,
  activeHomePanel,
  categories,
  activeCategory,
  onCategoryChange,
  onHomePanelChange,
  onViewChange,
  isLoading,
  onOpen,
  onOpenCv,
  favoriteCvs,
  cvAvatars,
  isRefreshingCvAvatars,
  onToggleFavoriteCv,
  onRefreshCvAvatars,
  onPlay,
  selectedAlbum,
  currentAlbum,
  currentEpisode,
  audioProgress,
  audioTime,
  audioDuration,
  onSeek,
  isPlaying,
  onTogglePlay
}: {
  albums: Album[];
  cvAlbums: Album[];
  activeKind: MediaKind;
  activeHomePanel: HomePanel;
  categories: Category[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  onHomePanelChange: (panel: HomePanel) => void;
  onViewChange: (view: AppView) => void;
  isLoading: boolean;
  onOpen: (album: Album) => void;
  onOpenCv: (cv: string) => void;
  favoriteCvs: string[];
  cvAvatars: Record<string, string>;
  isRefreshingCvAvatars: boolean;
  onToggleFavoriteCv: (cv: string) => void;
  onRefreshCvAvatars: (names: string[]) => Promise<void>;
  onPlay: (album: Album, episode?: Episode) => void;
  selectedAlbum: Album | null;
  currentAlbum: Album | null;
  currentEpisode: Episode | null | undefined;
  audioProgress: number;
  audioTime: number;
  audioDuration: number;
  onSeek: (time: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
}) {
  const [filters, setFilters] = useState<MetadataFilters>(emptyMetadataFilters);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [cvQuery, setCvQuery] = useState('');
  const filteredAlbums = useMemo(() => albums.filter((album) => matchesMetadataFilters(album, filters)), [albums, filters]);
  const hero = currentAlbum || albums.find((album) => album.status === 'listening') || albums[0];
  const heroProgress = currentAlbum?.id === hero?.id ? audioProgress : hero?.progress || 0;
  const isHeroCurrent = Boolean(hero && currentAlbum?.id === hero.id);
  const heroEpisode =
    isHeroCurrent && currentEpisode
      ? currentEpisode
      : hero?.episodes.find((episode) => (episode.progress || 0) > 0 && (episode.progress || 0) < 100) ||
        hero?.episodes.find((episode) => (episode.progress || 0) < 100) ||
        hero?.episodes[0];
  const heroEpisodeLabel = heroEpisode?.title ? `正在听 ${heroEpisode.title}` : hero?.subtitle || '连接 NAS 后扫描本地音频，就会出现在这里。';

  if (isLoading) {
    return <div className="empty-state">正在整理你的私人听书房...</div>;
  }

  return (
    <>
      <section
        className={hero ? 'hero-card clickable' : 'hero-card'}
        style={{ '--hero-cover': coverBackground(hero?.cover) } as React.CSSProperties}
        onClick={() => {
          if (hero) onOpen(hero);
        }}
      >
        <div className="hero-bg" aria-hidden="true" />
        <div>
          <p className="eyebrow">继续听</p>
          <h1>{hero?.title || `还没有${kindLabel(activeKind)}`}</h1>
          <p>{heroEpisodeLabel}</p>
          {hero ? (
            <button
              className="primary-action"
              onClick={(event) => {
                event.stopPropagation();
                if (isHeroCurrent) {
                  onTogglePlay();
                  return;
                }
                onPlay(hero);
              }}
            >
              {isHeroCurrent && isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              {isHeroCurrent && isPlaying ? '暂停播放' : '继续播放'}
            </button>
          ) : null}
          {hero ? (
            <label className="hero-progress hero-progress-interactive" aria-label="首页播放进度">
              <span style={{ width: `${heroProgress}%` }} />
              <input
                type="range"
                min="0"
                max={audioDuration || 0}
                step="1"
                value={audioDuration ? audioTime : 0}
                disabled={!audioDuration || currentAlbum?.id !== hero.id}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => onSeek(Number(event.currentTarget.value))}
              />
              <small>
                已播放 {heroProgress}% {audioDuration ? `· ${formatClock(audioTime)} / ${formatClock(audioDuration)}` : ''}
              </small>
            </label>
          ) : null}
        </div>
        <div className="hero-cover" style={{ background: coverBackground(hero?.cover) }} aria-hidden="true" />
      </section>

      <QuickSketchStrip activePanel={activeHomePanel} onPanelChange={onHomePanelChange} onViewChange={onViewChange} />

      {activeHomePanel === 'cv' ? (
        <CvWall
          albums={cvAlbums}
          query={cvQuery}
          setQuery={setCvQuery}
          favoriteCvs={favoriteCvs}
          cvAvatars={cvAvatars}
          isRefreshing={isRefreshingCvAvatars}
          onToggleFavorite={onToggleFavoriteCv}
          onRefreshAvatars={onRefreshCvAvatars}
          onOpenCv={onOpenCv}
        />
      ) : (
        <>
      <SectionHeader title={kindLabel(activeKind)} subtitle="本地 NAS 内容 ›" />
      <CategoryChips categories={categories} activeCategory={activeCategory} onChange={onCategoryChange} />
      {activeKind === 'drama' ? (
        <MetadataFilterPanel
          filters={filters}
          onChange={setFilters}
          isOpen={isFilterOpen}
          onToggle={() => setIsFilterOpen((value) => !value)}
          total={albums.length}
          matched={filteredAlbums.length}
        />
      ) : null}
      {activeKind === 'drama' ? (
        <div className="drama-list">
          {filteredAlbums.map((album) => (
            <DramaListRow key={album.id} album={album} onOpen={onOpen} onPlay={onPlay} />
          ))}
          {!filteredAlbums.length ? <div className="empty-state compact">没有找到符合筛选的广播剧</div> : null}
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
        {(activeKind === 'drama' ? filteredAlbums : albums).slice(0, 3).map((album) => (
          <button key={album.id} onClick={() => onOpen(album)}>
            <Clock3 size={18} />
            <span>{album.title}</span>
            <small>{album.progress}%</small>
          </button>
        ))}
      </div>
        </>
      )}
    </>
  );
}

function CvWall({
  albums,
  query,
  setQuery,
  favoriteCvs,
  cvAvatars,
  isRefreshing,
  onToggleFavorite,
  onRefreshAvatars,
  onOpenCv
}: {
  albums: Album[];
  query: string;
  setQuery: (value: string) => void;
  favoriteCvs: string[];
  cvAvatars: Record<string, string>;
  isRefreshing: boolean;
  onToggleFavorite: (cv: string) => void;
  onRefreshAvatars: (names: string[]) => Promise<void>;
  onOpenCv: (cv: string) => void;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const profiles = useMemo(() => buildCvProfiles(albums), [albums]);
  const visibleProfiles = profiles
    .filter((profile) => {
      if (!normalizedQuery) return true;
      return profile.name.toLowerCase().includes(normalizedQuery) || profile.initial.toLowerCase().includes(normalizedQuery);
    })
    .sort((a, b) => {
      const favoriteDelta = Number(favoriteCvs.includes(b.name)) - Number(favoriteCvs.includes(a.name));
      if (favoriteDelta) return favoriteDelta;
      return a.name.localeCompare(b.name, 'zh-Hans-CN', { sensitivity: 'base', numeric: true });
    });

  return (
    <section className="cv-wall-panel">
      <div className="cv-wall-head">
        <SectionHeader title="CV" subtitle={`${profiles.length} 位配音演员`} />
        <button
          disabled={isRefreshing}
          onClick={() => void onRefreshAvatars(visibleProfiles.filter((profile) => !cvAvatars[profile.name]).map((profile) => profile.name))}
        >
          {isRefreshing ? '刷新中' : '刷新头像'}
        </button>
      </div>
      <label className="cv-search" aria-label="搜索 CV">
        <Search size={16} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 CV 名字" />
      </label>
      <div className="cv-grid">
        {visibleProfiles.map((profile) => {
          const isFavorite = favoriteCvs.includes(profile.name);
          const avatar = cvAvatars[profile.name] || profile.cover;
          return (
            <article key={profile.name} className={isFavorite ? 'cv-card favorite' : 'cv-card'}>
              <button className="cv-avatar-button" onClick={() => void onOpenCv(profile.name)} aria-label={`查看 ${profile.name} 的广播剧`}>
                <span className="cv-avatar" style={{ background: coverBackground(avatar) }}>
                  {isImageCover(avatar) ? null : profile.initial}
                </span>
              </button>
              <button className="cv-favorite-button" onClick={() => onToggleFavorite(profile.name)} aria-label={isFavorite ? `取消喜爱 ${profile.name}` : `喜爱 ${profile.name}`}>
                <Heart size={13} fill={isFavorite ? 'currentColor' : 'none'} />
              </button>
              <strong>{profile.name}</strong>
              <small>{profile.count} 部</small>
            </article>
          );
        })}
      </div>
      {!visibleProfiles.length ? <div className="empty-state compact">还没有找到 CV。先用 DeepSeek 整理或手动补配音演员。</div> : null}
    </section>
  );
}

function DramaListRow({
  album,
  onOpen,
  onPlay
}: {
  album: Album;
  onOpen: (album: Album) => void;
  onPlay: (album: Album, episode?: Episode) => void;
}) {
  const nextEpisode = album.episodes.find((episode) => (episode.progress || 0) < 100) || album.episodes[0];
  const lastIndex = nextEpisode ? Math.max(1, album.episodes.findIndex((episode) => episode.id === nextEpisode.id) + 1) : 1;

  return (
    <article className="drama-row">
      <button className="drama-row-main" onClick={() => onOpen(album)}>
        <span className="drama-row-cover" style={{ background: coverBackground(album.cover) }} />
        <span className="drama-row-copy">
          <strong>{album.title}</strong>
          <small>{album.author || album.cast?.[0] ? [album.author, album.cast?.[0]].filter(Boolean).join(' · ') : album.subtitle}</small>
          <span className="drama-row-summary">{albumSummary(album)}</span>
          {albumChips(album, 3).length ? (
            <span className="metadata-chips compact">
              {albumChips(album, 3).map((chip) => (
                <i key={chip}>{chip}</i>
              ))}
            </span>
          ) : null}
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
  activePanel,
  onPanelChange,
  onViewChange
}: {
  activePanel: HomePanel;
  onPanelChange: (panel: HomePanel) => void;
  onViewChange: (view: AppView) => void;
}) {
  const items: Array<{ icon: SketchIconName; label: string; panel?: HomePanel; view?: AppView }> = [
    { icon: 'drama', label: '广播剧', panel: 'drama' },
    { icon: 'book', label: '有声书', panel: 'book' },
    { icon: 'cv', label: 'CV', panel: 'cv' },
    { icon: 'category', label: '分类', view: 'home' }
  ];

  return (
    <div className="quick-sketch-strip" aria-label="快捷入口">
      {items.map((item) => (
        <button
          key={item.label}
          className={item.panel && activePanel === item.panel ? 'active' : ''}
          onClick={() => {
            if (item.panel) onPanelChange(item.panel);
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
      {name === 'cv' ? (
        <>
          <circle cx="21" cy="18" r="8" />
          <path d="M9 39c2.2-7 7.5-10 12-10s9.8 3 12 10" />
          <path d="M35 17v8c0 5-3.8 9-8.8 9" />
          <path d="M34 25h5" />
          <path className="accent-line" d="M16 19c2 2 8 2 10 0" />
          <circle className="accent-dot" cx="36" cy="13" r="2.2" />
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

function MetadataFilterPanel({
  filters,
  onChange,
  isOpen,
  onToggle,
  total,
  matched
}: {
  filters: MetadataFilters;
  onChange: (filters: MetadataFilters) => void;
  isOpen: boolean;
  onToggle: () => void;
  total: number;
  matched: number;
}) {
  const activeCount = metadataFilterCount(filters);

  function setSingle(field: 'relationship' | 'audience' | 'finishStatus', value: string) {
    onChange({ ...filters, [field]: filters[field] === value ? '' : value });
  }

  function toggleGenre(value: string) {
    const exists = filters.genres.includes(value);
    onChange({
      ...filters,
      genres: exists ? filters.genres.filter((genre) => genre !== value) : [...filters.genres, value]
    });
  }

  return (
    <section className="filter-block">
      <button className={activeCount ? 'filter-trigger active' : 'filter-trigger'} onClick={onToggle}>
        <SlidersHorizontal size={16} />
        <span>{activeCount ? `已筛选 ${activeCount}` : '筛选'}</span>
        <small>
          {matched}/{total}
        </small>
      </button>
      {activeCount ? (
        <button className="filter-clear" onClick={() => onChange(emptyMetadataFilters)}>
          清空
        </button>
      ) : null}
      {isOpen ? (
        <div className="filter-sheet">
          <FilterGroup title="感情向">
            {relationshipOptions.map((option) => (
              <FilterChip key={option} active={filters.relationship === option} onClick={() => setSingle('relationship', option)}>
                {option}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup title="主角组合">
            {audienceOptions.map((option) => (
              <FilterChip key={option} active={filters.audience === option} onClick={() => setSingle('audience', option)}>
                {option}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup title="完结状态">
            {finishStatusOptions.map((option) => (
              <FilterChip key={option} active={filters.finishStatus === option} onClick={() => setSingle('finishStatus', option)}>
                {option}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup title="类型">
            {genreOptions.map((option) => (
              <FilterChip key={option} active={filters.genres.includes(option)} onClick={() => toggleGenre(option)}>
                {option}
              </FilterChip>
            ))}
          </FilterGroup>
        </div>
      ) : null}
    </section>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="filter-group">
      <strong>{title}</strong>
      <div>{children}</div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={active ? 'active' : ''} onClick={onClick}>
      {children}
    </button>
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

function seriesTitleForAlbum(title: string) {
  return title
    .replace(/[\s·・_-]*第[一二三四五六七八九十两\d]+季(?:（[上下]）)?$/u, '')
    .replace(/[\s·・_-]*第[一二三四五六七八九十两\d]+季(?:[上下])?$/u, '')
    .trim();
}

type DramaSeries = {
  id: string;
  title: string;
  albums: Album[];
  totalEpisodes: number;
};

function groupDramaSeries(albums: Album[]): DramaSeries[] {
  const groups = new Map<string, DramaSeries>();
  for (const album of albums.filter((item) => item.kind === 'drama')) {
    const title = seriesTitleForAlbum(album.title) || album.title;
    const group = groups.get(title) || { id: title, title, albums: [], totalEpisodes: 0 };
    group.albums.push(album);
    group.totalEpisodes += album.totalEpisodes;
    groups.set(title, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      albums: [...group.albums].sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' }))
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' }));
}

function FilesView({ onOpen }: { onOpen: (album: Album) => void }) {
  const [dramaAlbums, setDramaAlbums] = useState<Album[]>([]);
  const [isLoadingDrama, setIsLoadingDrama] = useState(false);
  const [selectedSeriesId, setSelectedSeriesId] = useState('');

  async function loadDramaWall() {
    setIsLoadingDrama(true);
    try {
      setDramaAlbums(await fetchAlbums('drama'));
    } finally {
      setIsLoadingDrama(false);
    }
  }

  useEffect(() => {
    void loadDramaWall();
  }, []);

  const series = groupDramaSeries(dramaAlbums);
  const selectedSeries = series.find((item) => item.id === selectedSeriesId);
  function handleOpenSeries(item: DramaSeries) {
    if (item.albums.length <= 1) {
      onOpen(item.albums[0]);
      return;
    }
    setSelectedSeriesId(item.id);
  }

  return (
    <section className="panel-page">
      <SectionHeader title="广播剧系列墙" subtitle={isLoadingDrama ? '正在整理...' : `${series.length} 个系列`} />
      <div className="series-wall">
        {series.map((item) => (
          <button
            key={item.id}
            className={selectedSeriesId === item.id ? 'series-card active' : 'series-card'}
            onClick={() => handleOpenSeries(item)}
          >
            <span className="series-cover-stack" aria-hidden="true">
              {item.albums.slice(0, 4).map((album, index) => (
                <i
                  key={album.id}
                  style={
                    {
                      '--series-cover': coverBackground(album.cover),
                      '--series-index': index
                    } as React.CSSProperties
                  }
                />
              ))}
            </span>
            <span className="series-title">{item.title}</span>
            <span className="series-meta">
              {item.albums.length} 季 · {item.totalEpisodes} 集
            </span>
          </button>
        ))}
      </div>
      {selectedSeries ? (
        <section className="series-picker" aria-label="选择季数">
          <button className="series-picker-backdrop" aria-label="关闭选择季数" onClick={() => setSelectedSeriesId('')} />
          <div className="series-season-panel">
            <div className="series-season-head">
              <div>
                <span>选择季数</span>
                <strong>{selectedSeries.title}</strong>
              </div>
              <button onClick={() => setSelectedSeriesId('')}>关闭</button>
            </div>
            <div className="series-season-list">
              {selectedSeries.albums.map((album) => (
                <button
                  key={album.id}
                  className="series-season-row"
                  onClick={() => {
                    setSelectedSeriesId('');
                    onOpen(album);
                  }}
                >
                  <span className="mini-cover" style={{ background: coverBackground(album.cover) }} />
                  <span>
                    <strong>{album.title}</strong>
                    <small>
                      {album.totalEpisodes} 集 · 已播放 {Math.round(album.progress)}%
                    </small>
                  </span>
                  <em>进入</em>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}

function SearchView({
  query,
  setQuery,
  searchMode,
  setSearchMode,
  albums,
  onOpen,
  onPlay
}: {
  query: string;
  setQuery: (value: string) => void;
  searchMode: SearchMode;
  setSearchMode: (mode: SearchMode) => void;
  albums: Album[];
  onOpen: (album: Album) => void;
  onPlay: (album: Album, episode?: Episode) => void;
}) {
  const currentSearch = searchModeOptions.find((item) => item.mode === searchMode) || searchModeOptions[0];
  const normalizedQuery = query.trim().replace(/\s+/g, '').toLowerCase();
  const visibleAlbums =
    searchMode === 'cv' && normalizedQuery
      ? albums.filter((album) => (album.cast || []).some((cv) => cv.replace(/\s+/g, '').toLowerCase().includes(normalizedQuery)))
      : albums;

  return (
    <section className="panel-page">
      <SectionHeader title={searchMode === 'cv' && query ? `${query} 参与的广播剧` : '本地搜索'} subtitle="搜 NAS 索引，不走外部联网" />
      <div className="search-mode-tabs" aria-label="搜索模式">
        {searchModeOptions.map((option) => (
          <button key={option.mode} className={searchMode === option.mode ? 'active' : ''} onClick={() => setSearchMode(option.mode)}>
            {option.label}
          </button>
        ))}
      </div>
      <div className="large-search">
        <Search size={20} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={currentSearch.placeholder} />
      </div>
      <div className="result-list">
        {visibleAlbums.map((album) => (
          <div key={album.id} className="result-row">
            <button className="result-main" onClick={() => onOpen(album)}>
              <span className="mini-cover" style={{ background: coverBackground(album.cover) }} />
              <span>
                <strong>{album.title}</strong>
                <small>
                  {searchMode === 'cv'
                    ? `配音：${
                        album.cast
                          ?.filter((cv) => !normalizedQuery || cv.replace(/\s+/g, '').toLowerCase().includes(normalizedQuery))
                          .join('、') || joinList(album.cast) || '待整理'
                      }`
                    : album.subtitle}
                </small>
              </span>
            </button>
            <button className="inline-play" type="button" aria-label={`播放 ${album.title}`} onClick={() => onPlay(album)}>
              <Play size={17} fill="currentColor" />
            </button>
          </div>
        ))}
        {!visibleAlbums.length ? <div className="empty-state compact">{searchMode === 'cv' ? '没有找到这个 CV 参与的本地广播剧' : '没有搜到本地内容'}</div> : null}
      </div>
    </section>
  );
}

function MeView({
  nas,
  albums,
  categories,
  favoriteFolders,
  metadataAnalyzeJob,
  nasRoot,
  setNasRoot,
  onSaveNas,
  onScanNas,
  onAddCategory,
  onAnalyzeLibrary,
  onOpen
}: {
  nas: NasConfig | null;
  albums: Album[];
  categories: Category[];
  favoriteFolders: FavoriteFolder[];
  metadataAnalyzeJob: MetadataAnalyzeJob | null;
  nasRoot: string;
  setNasRoot: (value: string) => void;
  onSaveNas: () => Promise<void>;
  onScanNas: () => Promise<void>;
  onAddCategory: (name: string) => Promise<void>;
  onAnalyzeLibrary: (mode?: MetadataAnalyzeMode) => Promise<void>;
  onOpen: (album: Album) => void;
}) {
  const [categoryName, setCategoryName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [favoriteQuery, setFavoriteQuery] = useState('');
  const [activeFavoriteFolderId, setActiveFavoriteFolderId] = useState('all');
  const [isAnalyzeDialogOpen, setIsAnalyzeDialogOpen] = useState(false);
  const [selectedAnalyzeMode, setSelectedAnalyzeMode] = useState<MetadataAnalyzeMode>('missing-only');
  const [metadataEstimate, setMetadataEstimate] = useState<MetadataAnalyzeEstimate | null>(null);
  const [isEstimatingMetadata, setIsEstimatingMetadata] = useState(false);
  const isAnalyzingLibrary = metadataAnalyzeJob?.status === 'queued' || metadataAnalyzeJob?.status === 'running';
  const metadataAnalyzePercent = metadataAnalyzeJob?.total
    ? Math.round((metadataAnalyzeJob.processed / metadataAnalyzeJob.total) * 100)
    : 0;
  const analyzeModeOptions: Array<{ mode: MetadataAnalyzeMode; title: string; note: string }> = [
    { mode: 'missing-only', title: '只整理缺资料', note: '省钱，优先补简介、作者、配音' },
    { mode: 'failed-only', title: '重试失败', note: '只重新处理上次失败的广播剧' },
    { mode: 'all', title: '重新整理全部', note: '适合第一次建库或重做标签' }
  ];

  useEffect(() => {
    fetchProfile()
      .then((profile) => setAvatar(profile.avatar || ''))
      .catch(() => setAvatar(''));
  }, []);

  async function submitCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    await onAddCategory(name);
    setCategoryName('');
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;
      setIsSavingAvatar(true);
      try {
        const profile = await updateProfileAvatar(reader.result);
        setAvatar(profile.avatar);
      } finally {
        setIsSavingAvatar(false);
        event.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  }

  async function openAnalyzeDialog(mode: MetadataAnalyzeMode = selectedAnalyzeMode) {
    setSelectedAnalyzeMode(mode);
    setIsAnalyzeDialogOpen(true);
    setIsEstimatingMetadata(true);
    try {
      setMetadataEstimate(await estimateLibraryMetadata(mode));
    } finally {
      setIsEstimatingMetadata(false);
    }
  }

  async function selectAnalyzeMode(mode: MetadataAnalyzeMode) {
    setSelectedAnalyzeMode(mode);
    setIsEstimatingMetadata(true);
    try {
      setMetadataEstimate(await estimateLibraryMetadata(mode));
    } finally {
      setIsEstimatingMetadata(false);
    }
  }

  async function confirmAnalyzeLibrary() {
    setIsAnalyzeDialogOpen(false);
    await onAnalyzeLibrary(selectedAnalyzeMode);
  }

  const myTools: Array<{ icon: SketchIconName; label: string; note: string }> = [
    { icon: 'timer', label: '定时关闭', note: '睡前播放' },
    { icon: 'chase', label: '我的追剧', note: '继续听' },
    { icon: 'category', label: '分类设置', note: '古代/现代' },
    { icon: 'history', label: '播放历史', note: '断点记录' },
    { icon: 'cover', label: '封面管理', note: '手动美化' },
    { icon: 'cache', label: '本地缓存', note: '离线听' },
    { icon: 'backup', label: '数据备份', note: '保护记录' },
    { icon: 'settings', label: '应用设置', note: '偏好设置' }
  ];
  const favoriteAlbumIds =
    activeFavoriteFolderId === 'all'
      ? [...new Set(favoriteFolders.flatMap((folder) => folder.albumIds))]
      : favoriteFolders.find((folder) => folder.id === activeFavoriteFolderId)?.albumIds || [];
  const favoriteAlbums = albums.filter((album) => {
    if (!favoriteAlbumIds.includes(album.id)) return false;
    const q = favoriteQuery.trim().toLowerCase();
    if (!q) return true;
    return [album.title, album.subtitle, album.author || '', album.summary || '', ...(album.tags || []), ...(album.genres || [])].some((value) =>
      value.toLowerCase().includes(q)
    );
  });
  const pendingAiAlbums = albums.filter((album) => album.aiMetaStatus === 'suggested');

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
          <label className={avatar ? 'me-avatar has-image' : 'me-avatar'} aria-label="更换头像">
            <input type="file" accept="image/*" onChange={handleAvatarChange} />
            {avatar ? <img src={avatar} alt="头像" /> : <span>听</span>}
            <em>{isSavingAvatar ? '保存中' : '更换'}</em>
          </label>
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

      <div className="settings-card me-nas-card">
        <label htmlFor="me-nas-root">NAS 音频路径</label>
        <input id="me-nas-root" value={nasRoot} onChange={(event) => setNasRoot(event.target.value)} placeholder="/docker/private-audio-room/Audio" />
        <div className="button-row">
          <button onClick={() => void onSaveNas()}>保存路径</button>
          <button className="filled" onClick={() => void onScanNas()}>
            扫描音频
          </button>
        </div>
        <p>{nas?.connected ? `已连接：${nas.root}` : '把广播剧目录挂载到容器后，在这里保存路径并扫描。'}</p>
      </div>

      <section className="favorites-panel">
        <SectionHeader title="我的收藏" subtitle={`${favoriteAlbumIds.length} 部`} />
        <div className="favorite-search">
          <Search size={16} />
          <input value={favoriteQuery} onChange={(event) => setFavoriteQuery(event.target.value)} placeholder="搜索收藏里的广播剧" />
        </div>
        <div className="favorite-folder-tabs">
          <button className={activeFavoriteFolderId === 'all' ? 'active' : ''} onClick={() => setActiveFavoriteFolderId('all')}>
            全部
          </button>
          {favoriteFolders.map((folder) => (
            <button
              key={folder.id}
              className={activeFavoriteFolderId === folder.id ? 'active' : ''}
              onClick={() => setActiveFavoriteFolderId(folder.id)}
            >
              {folder.name}
            </button>
          ))}
        </div>
        <div className="favorite-album-list">
          {favoriteAlbums.map((album) => (
            <button key={album.id} onClick={() => onOpen(album)}>
              <span className="mini-cover" style={{ background: coverBackground(album.cover) }} />
              <span>
                <strong>{album.title}</strong>
                <small>{albumChips(album, 3).join(' · ') || album.subtitle}</small>
              </span>
            </button>
          ))}
          {!favoriteAlbums.length ? <p>还没有收藏，点进广播剧详情可以加入收藏夹。</p> : null}
        </div>
      </section>

      <div className="me-tool-grid">
        <button disabled={isAnalyzingLibrary} onClick={() => void openAnalyzeDialog()}>
          <SketchIcon name="settings" decorated />
          <strong>一键编辑</strong>
          <span>{isAnalyzingLibrary ? '整理中' : 'DeepSeek 整理'}</span>
        </button>
        {myTools.map((tool) => (
          <button key={tool.label}>
            <SketchIcon name={tool.icon} decorated />
            <strong>{tool.label}</strong>
            <span>{tool.note}</span>
          </button>
        ))}
      </div>

      {metadataAnalyzeJob ? (
        <section className="metadata-progress-card">
          <div className="metadata-progress-head">
            <strong>
              {metadataAnalyzeJob.status === 'completed'
                ? 'DeepSeek 整理完成'
                : metadataAnalyzeJob.status === 'failed'
                  ? 'DeepSeek 整理失败'
                  : 'DeepSeek 正在整理'}
            </strong>
            <span>{metadataAnalyzePercent}%</span>
          </div>
          <div className="metadata-progress-bar">
            <i style={{ width: `${metadataAnalyzePercent}%` }} />
          </div>
          <p>
            {metadataAnalyzeJob.currentAlbumTitle
              ? `正在整理：${metadataAnalyzeJob.currentAlbumTitle}`
              : metadataAnalyzeJob.status === 'completed'
                ? '本次全库整理已经结束。'
                : metadataAnalyzeJob.error || '正在准备任务...'}
          </p>
          <div className="metadata-progress-stats">
            <span>总数 {metadataAnalyzeJob.total}</span>
            <span>已完成 {metadataAnalyzeJob.processed}</span>
            <span>成功 {metadataAnalyzeJob.updated}</span>
            <span>失败 {metadataAnalyzeJob.failed}</span>
          </div>
          {metadataAnalyzeJob.status === 'completed' && metadataAnalyzeJob.failed > 0 ? (
            <button className="metadata-retry-button" onClick={() => void openAnalyzeDialog('failed-only')}>
              重试失败项
            </button>
          ) : null}
          {metadataAnalyzeJob.results.length ? (
            <div className="metadata-result-list">
              {metadataAnalyzeJob.results.slice(-8).reverse().map((result) => (
                <button
                  key={`${metadataAnalyzeJob.id}-${result.id}`}
                  onClick={() => {
                    const album = albums.find((item) => item.id === result.id);
                    if (album) onOpen(album);
                  }}
                >
                  <span className={result.ok ? (result.needsReview || result.aiMetaStatus === 'suggested' ? 'review' : 'ok') : 'fail'}>
                    {result.ok ? (result.needsReview || result.aiMetaStatus === 'suggested' ? '待确认' : '成功') : '失败'}
                  </span>
                  <strong>{result.title}</strong>
                  <small>{result.error || (result.needsReview || result.aiMetaStatus === 'suggested' ? '需要你检查资料' : '已保存')}</small>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {isAnalyzeDialogOpen ? (
        <div className="metadata-dialog" role="dialog" aria-label="DeepSeek 整理确认">
          <div className="metadata-dialog-card">
            <div className="metadata-dialog-head">
              <strong>DeepSeek 整理</strong>
              <button onClick={() => setIsAnalyzeDialogOpen(false)}>关闭</button>
            </div>
            <div className="metadata-mode-list">
              {analyzeModeOptions.map((option) => (
                <button
                  key={option.mode}
                  className={selectedAnalyzeMode === option.mode ? 'active' : ''}
                  onClick={() => void selectAnalyzeMode(option.mode)}
                >
                  <strong>{option.title}</strong>
                  <span>{option.note}</span>
                </button>
              ))}
            </div>
            <div className="metadata-estimate-box">
              <span>预计整理</span>
              <strong>{isEstimatingMetadata ? '计算中...' : `${metadataEstimate?.total ?? 0} 部`}</strong>
              {metadataEstimate && metadataEstimate.totalBeforeLimit > metadataEstimate.total ? (
                <small>本次最多处理 {metadataEstimate.limit} 部，剩余可下次继续。</small>
              ) : (
                <small>开始后会显示进度、结果和失败项。</small>
              )}
            </div>
            <button className="metadata-confirm-button" disabled={isEstimatingMetadata || !metadataEstimate?.total} onClick={() => void confirmAnalyzeLibrary()}>
              确认开始
            </button>
          </div>
        </div>
      ) : null}

      <section className="ai-review-panel">
        <SectionHeader title="AI 待确认" subtitle={`${pendingAiAlbums.length} 部`} />
        <div className="ai-review-list">
          {pendingAiAlbums.slice(0, 6).map((album) => (
            <button key={album.id} onClick={() => onOpen(album)}>
              <span className="mini-cover" style={{ background: coverBackground(album.cover) }} />
              <span>
                <strong>{album.title}</strong>
                <small>{[album.author, album.cast?.[0], ...(album.genres || [])].filter(Boolean).slice(0, 3).join(' · ') || '资料需要你确认'}</small>
              </span>
              <em>确认</em>
            </button>
          ))}
          {!pendingAiAlbums.length ? <p>暂时没有需要确认的 AI 资料。</p> : null}
        </div>
      </section>

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
  onOpenAlbum,
  onCoverChange,
  onGenerateCover,
  onMetadataChange,
  onAnalyzeMetadata,
  favoriteFolders,
  onCreateFavoriteFolder,
  onAddFavorite,
  onRemoveFavorite,
  onPlay,
  onSearchCv,
  currentEpisodeId,
  isPlaying,
  audioTime,
  audioDuration,
  audioProgress,
  onTogglePlay,
  onSeek
}: {
  album: Album;
  onClose: () => void;
  onOpenAlbum: (album: Album) => void;
  onCoverChange: (albumId: string, cover: string) => Promise<void>;
  onGenerateCover: (albumId: string) => Promise<void>;
  onMetadataChange: (albumId: string, metadata: Partial<Album>) => Promise<void>;
  onAnalyzeMetadata: (albumId: string) => Promise<{ metadata: Partial<Album> & { confidence?: number; needsReview?: boolean }; album: Album }>;
  favoriteFolders: FavoriteFolder[];
  onCreateFavoriteFolder: (name: string) => Promise<FavoriteFolder[]>;
  onAddFavorite: (folderId: string, albumId: string) => Promise<void>;
  onRemoveFavorite: (folderId: string, albumId: string) => Promise<void>;
  onPlay: (album: Album, episode?: Episode) => void;
  onSearchCv: (cv: string) => void;
  currentEpisodeId?: string;
  isPlaying: boolean;
  audioTime: number;
  audioDuration: number;
  audioProgress: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
}) {
  const [isSavingCover, setIsSavingCover] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [isAnalyzingMetadata, setIsAnalyzingMetadata] = useState(false);
  const [isFavoriteModalOpen, setIsFavoriteModalOpen] = useState(false);
  const [newFavoriteFolderName, setNewFavoriteFolderName] = useState('');
  const [isSavingFavorite, setIsSavingFavorite] = useState(false);
  const [recommendations, setRecommendations] = useState<AlbumRecommendation[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'episodes' | 'files'>('summary');
  const [metadataDraft, setMetadataDraft] = useState({
    author: album.author || '',
    cast: joinList(album.cast),
    summary: album.summary || album.description || '',
    genres: joinList(album.genres?.length ? album.genres : album.tags),
    relationship: album.relationship || '',
    audience: album.audience || '',
    finishStatus: album.finishStatus || ''
  });
  const activeEpisode =
    album.episodes.find((episode) => episode.id === currentEpisodeId) ||
    album.episodes.find((episode) => (episode.progress || 0) < 100) ||
    album.episodes[0];
  const activeEpisodeIndex = Math.max(
    0,
    album.episodes.findIndex((episode) => episode.id === activeEpisode?.id)
  );
  const previousEpisode = album.episodes.slice(0, activeEpisodeIndex).reverse().find((episode) => episode.filePath);
  const nextEpisode = album.episodes.slice(activeEpisodeIndex + 1).find((episode) => episode.filePath);
  const isFavorited = favoriteFolders.some((folder) => folder.albumIds.includes(album.id));

  useEffect(() => {
    setMetadataDraft({
      author: album.author || '',
      cast: joinList(album.cast),
      summary: album.summary || album.description || '',
      genres: joinList(album.genres?.length ? album.genres : album.tags),
      relationship: album.relationship || '',
      audience: album.audience || '',
      finishStatus: album.finishStatus || ''
    });
    setIsEditingMetadata(false);
  }, [album.id, album.author, album.cast, album.summary, album.description, album.genres, album.tags, album.relationship, album.audience, album.finishStatus]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingRecommendations(true);
    fetchAlbumRecommendations(album.id)
      .then((items) => {
        if (!cancelled) setRecommendations(items);
      })
      .catch(() => {
        if (!cancelled) setRecommendations([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRecommendations(false);
      });
    return () => {
      cancelled = true;
    };
  }, [album.id]);

  async function submitMetadata(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingMetadata(true);
    try {
      await onMetadataChange(album.id, {
        author: metadataDraft.author,
        cast: splitList(metadataDraft.cast),
        summary: metadataDraft.summary,
        description: metadataDraft.summary,
        genres: splitList(metadataDraft.genres),
        tags: splitList(metadataDraft.genres),
        relationship: metadataDraft.relationship,
        audience: metadataDraft.audience,
        finishStatus: metadataDraft.finishStatus
      });
      setIsEditingMetadata(false);
    } finally {
      setIsSavingMetadata(false);
    }
  }

  function updateMetadataDraft(field: keyof typeof metadataDraft, value: string) {
    setMetadataDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleAnalyzeMetadata() {
    setIsAnalyzingMetadata(true);
    try {
      const result = await onAnalyzeMetadata(album.id);
      const updatedAlbum = result.album;
      setMetadataDraft((current) => ({
        author: updatedAlbum.author || current.author,
        cast: updatedAlbum.cast?.length ? joinList(updatedAlbum.cast) : current.cast,
        summary: updatedAlbum.summary || current.summary,
        genres: updatedAlbum.genres?.length ? joinList(updatedAlbum.genres) : current.genres,
        relationship: updatedAlbum.relationship || current.relationship,
        audience: updatedAlbum.audience || current.audience,
        finishStatus: updatedAlbum.finishStatus || current.finishStatus
      }));
      setIsEditingMetadata(false);
      setActiveTab('summary');
    } finally {
      setIsAnalyzingMetadata(false);
    }
  }

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

  async function toggleFavorite(folderId: string) {
    setIsSavingFavorite(true);
    try {
      const folder = favoriteFolders.find((item) => item.id === folderId);
      if (folder?.albumIds.includes(album.id)) await onRemoveFavorite(folderId, album.id);
      else await onAddFavorite(folderId, album.id);
    } finally {
      setIsSavingFavorite(false);
    }
  }

  async function createAndAddFavoriteFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newFavoriteFolderName.trim();
    if (!name) return;
    setIsSavingFavorite(true);
    try {
      const folders = await onCreateFavoriteFolder(name);
      const folder = folders.find((item) => item.name === name);
      if (folder) await onAddFavorite(folder.id, album.id);
      setNewFavoriteFolderName('');
    } finally {
      setIsSavingFavorite(false);
    }
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
            <span>{[kindLabel(album.kind), album.finishStatus, album.relationship].filter(Boolean).join(' · ') || `${kindLabel(album.kind)} · ${album.totalEpisodes} 集`}</span>
            <strong>{album.title}</strong>
          </div>
        </div>

        <div className="player-sheet">
          <div className="player-actions" aria-label="播放操作">
            <button className={isFavorited ? 'active' : ''} onClick={() => setIsFavoriteModalOpen(true)}>
              <Heart size={27} fill={isFavorited ? 'currentColor' : 'none'} />
              <span>{isFavorited ? '已收藏' : '收藏'}</span>
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
            <label className="progress-line progress-line-interactive" aria-label="播放进度">
              <span style={{ width: `${audioProgress}%` }} />
              <input
                type="range"
                min="0"
                max={audioDuration || 0}
                step="1"
                value={audioDuration ? audioTime : 0}
                disabled={!audioDuration}
                onChange={(event) => onSeek(Number(event.currentTarget.value))}
              />
            </label>
            <div>
              <small>{formatClock(audioTime)}</small>
              <small>{audioDuration ? formatClock(audioDuration) : activeEpisode?.duration || '00:00'}</small>
            </div>
          </div>

          <div className="transport-controls">
            <button aria-label="后退 15 秒" onClick={() => onSeek(audioTime - 15)}>
              15s
            </button>
            <button aria-label="上一集" disabled={!previousEpisode} onClick={() => previousEpisode && onPlay(album, previousEpisode)}>
              <SkipBack size={30} fill="currentColor" />
            </button>
            <button className={isPlaying ? 'transport-play playing' : 'transport-play'} onClick={onTogglePlay} aria-label={isPlaying ? '暂停' : '播放'}>
              {isPlaying ? <Pause size={34} fill="currentColor" /> : <Play size={34} fill="currentColor" />}
            </button>
            <button aria-label="下一集" disabled={!nextEpisode} onClick={() => nextEpisode && onPlay(album, nextEpisode)}>
              <SkipForward size={30} fill="currentColor" />
            </button>
            <button aria-label="播放列表" onClick={() => setActiveTab('episodes')}>
              <ListMusic size={32} />
            </button>
          </div>

          <div className="player-tabs">
            <button className={activeTab === 'summary' ? 'active' : ''} onClick={() => setActiveTab('summary')}>
              简介
            </button>
            <button className={activeTab === 'episodes' ? 'active' : ''} onClick={() => setActiveTab('episodes')}>
              分集
            </button>
            <button className={activeTab === 'files' ? 'active' : ''} onClick={() => setActiveTab('files')}>
              文件
            </button>
          </div>

          {activeTab === 'summary' ? (
            <div className="player-summary">
              <div className="summary-heading">
                <span className="kind-badge">{kindLabel(album.kind)}</span>
                <div>
                  <button onClick={handleAnalyzeMetadata} disabled={isAnalyzingMetadata}>
                    {isAnalyzingMetadata ? '整理中...' : 'AI 整理资料'}
                  </button>
                  <button onClick={() => setIsEditingMetadata((value) => !value)}>{isEditingMetadata ? '收起编辑' : '编辑资料'}</button>
                </div>
              </div>
              {album.aiMetaStatus ? (
                <small className="ai-meta-status">
                  {album.aiMetaStatus === 'suggested'
                    ? 'DeepSeek 已整理，建议你确认作者、配音和简介'
                    : album.aiMetaStatus === 'failed'
                      ? 'DeepSeek 上次整理失败'
                      : album.aiMetaStatus === 'saved'
                        ? 'AI 资料已保存'
                        : '尚未 AI 整理'}
                </small>
              ) : null}
              <p>{albumSummary(album)}</p>
              <div className="metadata-chips">
                {albumChips(album, 8).map((chip) => (
                  <i key={chip}>{chip}</i>
                ))}
              </div>
              <div className="metadata-grid">
                <div>
                  <span>作者</span>
                  <strong>{album.author || '未填写'}</strong>
                </div>
                <div>
                  <span>配音</span>
                  {album.cast?.length ? (
                    <div className="cast-link-list">
                      {album.cast.map((cv) => (
                        <button key={cv} onClick={() => onSearchCv(cv)}>
                          {cv}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <strong>未填写</strong>
                  )}
                </div>
                <div>
                  <span>感情向</span>
                  <strong>{album.relationship || '未填写'}</strong>
                </div>
                <div>
                  <span>主角组合</span>
                  <strong>{album.audience || '未填写'}</strong>
                </div>
                <div>
                  <span>状态</span>
                  <strong>{album.finishStatus || '未知'}</strong>
                </div>
              </div>
              {isEditingMetadata ? (
                <form className="metadata-form" onSubmit={submitMetadata}>
                  <label>
                    <span>剧情简介</span>
                    <textarea value={metadataDraft.summary} onChange={(event) => updateMetadataDraft('summary', event.target.value)} />
                  </label>
                  <label>
                    <span>作者 / 原著</span>
                    <input value={metadataDraft.author} onChange={(event) => updateMetadataDraft('author', event.target.value)} placeholder="例如 墨宝非宝" />
                  </label>
                  <label>
                    <span>配音演员</span>
                    <input value={metadataDraft.cast} onChange={(event) => updateMetadataDraft('cast', event.target.value)} placeholder="用逗号分隔，例如 风镜、陶典" />
                  </label>
                  <label>
                    <span>标签 / 类型</span>
                    <input value={metadataDraft.genres} onChange={(event) => updateMetadataDraft('genres', event.target.value)} placeholder="悬疑、现代、言情、已完结" />
                  </label>
                  <div className="metadata-form-row">
                    <label>
                      <span>感情向</span>
                      <input value={metadataDraft.relationship} onChange={(event) => updateMetadataDraft('relationship', event.target.value)} placeholder="言情 / 耽美 / 百合" />
                    </label>
                    <label>
                      <span>主角组合</span>
                      <input value={metadataDraft.audience} onChange={(event) => updateMetadataDraft('audience', event.target.value)} placeholder="男女 / 男男 / 女女" />
                    </label>
                  </div>
                  <label>
                    <span>完结状态</span>
                    <input value={metadataDraft.finishStatus} onChange={(event) => updateMetadataDraft('finishStatus', event.target.value)} placeholder="已完结 / 连载中 / 未知" />
                  </label>
                  <button disabled={isSavingMetadata}>{isSavingMetadata ? '保存中...' : '保存资料'}</button>
                </form>
              ) : null}
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
              <section className="recommendation-panel">
                <div className="recommendation-head">
                  <strong>你可能还想听</strong>
                  <span>{isLoadingRecommendations ? '匹配中...' : `${recommendations.length} 部`}</span>
                </div>
                <div className="recommendation-list">
                  {recommendations.map((item) => {
                    const nextEpisode = item.album.episodes.find((episode) => (episode.progress || 0) < 100) || item.album.episodes[0];
                    return (
                      <button key={item.album.id} onClick={() => onOpenAlbum(item.album)}>
                        <span className="recommendation-cover" style={{ background: coverBackground(item.album.cover) }} />
                        <span className="recommendation-copy">
                          <strong>{item.album.title}</strong>
                          <small>{item.reasons.slice(0, 3).join(' · ') || item.album.subtitle}</small>
                          <em>{nextEpisode?.title ? `可从 ${nextEpisode.title} 开始` : `${item.album.totalEpisodes} 集`}</em>
                        </span>
                        <i>{item.score}</i>
                      </button>
                    );
                  })}
                  {!isLoadingRecommendations && !recommendations.length ? <p>资料整理后，这里会推荐同作者、同配音或同题材的本地广播剧。</p> : null}
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === 'episodes' ? (
            <>
              <SectionHeader title="分集" subtitle={`${album.totalEpisodes} 集 · ${audioProgress}%`} />
              <div className="episode-list player-episode-list">
                {album.episodes.map((episode, index) => (
                  <button
                    key={episode.id}
                    className={episode.id === activeEpisode?.id ? 'active' : ''}
                    onClick={() => onPlay(album, episode)}
                    disabled={!episode.filePath}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{episode.title}</strong>
                    <small>{episode.duration}</small>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {activeTab === 'files' ? (
            <>
              <SectionHeader title="文件" subtitle="NAS 本地路径" />
              <div className="episode-list player-episode-list file-path-list">
                {album.episodes.map((episode, index) => (
                  <button
                    key={episode.id}
                    className={episode.id === activeEpisode?.id ? 'active' : ''}
                    onClick={() => onPlay(album, episode)}
                    disabled={!episode.filePath}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{episode.title}</strong>
                    <small>{episode.filePath?.split('/').pop() || '无文件'}</small>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {isFavoriteModalOpen ? (
            <div className="favorite-modal" role="dialog" aria-label="收藏到">
              <div className="favorite-modal-head">
                <strong>收藏到</strong>
                <button onClick={() => setIsFavoriteModalOpen(false)}>关闭</button>
              </div>
              <div className="favorite-folder-list">
                {favoriteFolders.map((folder) => {
                  const active = folder.albumIds.includes(album.id);
                  return (
                    <button key={folder.id} className={active ? 'active' : ''} disabled={isSavingFavorite} onClick={() => void toggleFavorite(folder.id)}>
                      <span>{folder.name}</span>
                      <small>{active ? '已收藏' : `${folder.albumIds.length} 部`}</small>
                    </button>
                  );
                })}
              </div>
              <form className="favorite-create-form" onSubmit={createAndAddFavoriteFolder}>
                <input
                  value={newFavoriteFolderName}
                  onChange={(event) => setNewFavoriteFolderName(event.target.value)}
                  placeholder="新建收藏夹，比如 言情"
                />
                <button disabled={isSavingFavorite}>{isSavingFavorite ? '保存中' : '新建'}</button>
              </form>
            </div>
          ) : null}
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
