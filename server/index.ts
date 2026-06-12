import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultCategories, defaultNasConfig, mockAlbums } from './mockData';
import type { Album, Category, MediaKind, NasConfig } from './types';

const app = express();
const port = Number(process.env.PORT || 8787);
const audioExtensions = new Set(['.mp3', '.m4a', '.m4b', '.aac', '.flac', '.wav', '.ogg', '.opus']);
const stateFile = path.resolve('data/state.json');

app.use(cors());
app.use(express.json());

type AppState = { nas: NasConfig; albums: Album[]; categories: Category[] };

function normalizeState(state: Partial<AppState>): AppState {
  const defaultAlbumMap = new Map(mockAlbums.map((album) => [album.id, album]));
  const existingAlbums = state.albums?.length ? state.albums : mockAlbums;
  const albums = existingAlbums.map((album) => {
    const defaultAlbum = defaultAlbumMap.get(album.id);
    if (!defaultAlbum) return album;
    const hasCustomCover = album.cover?.startsWith('data:image/');
    return {
      ...defaultAlbum,
      ...album,
      cover: hasCustomCover ? album.cover : defaultAlbum.cover,
      tags: [...new Set([...(defaultAlbum.tags || []), ...(album.tags || [])])]
    };
  });

  return {
    nas: state.nas || defaultNasConfig,
    albums,
    categories: state.categories?.length ? state.categories : defaultCategories
  };
}

function readState(): AppState {
  if (!fs.existsSync(stateFile)) {
    return { nas: defaultNasConfig, albums: mockAlbums, categories: defaultCategories };
  }

  const raw = fs.readFileSync(stateFile, 'utf-8');
  return normalizeState(JSON.parse(raw));
}

function writeState(state: AppState) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function inferKindFromPath(filePath: string): MediaKind {
  const normalized = filePath.toLowerCase();
  if (normalized.includes('课程') || normalized.includes('course') || normalized.includes('课')) return 'course';
  if (normalized.includes('book') || normalized.includes('有声书') || normalized.includes('听书')) return 'book';
  return 'drama';
}

function listAudioFiles(root: string, limit = 120) {
  const files: string[] = [];

  function walk(dir: string) {
    if (files.length >= limit) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= limit) return;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.')) walk(fullPath);
      } else if (audioExtensions.has(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  }

  walk(root);
  return files;
}

function albumsFromFiles(root: string, files: string[]): Album[] {
  const groups = new Map<string, string[]>();
  for (const file of files) {
    const parent = path.dirname(file);
    const key = path.relative(root, parent) || path.basename(parent);
    groups.set(key, [...(groups.get(key) || []), file]);
  }

  return [...groups.entries()].map(([group, groupFiles], index) => {
    const kind = inferKindFromPath(group);
    const title = path.basename(group) || `本地专辑 ${index + 1}`;
    return {
      id: `local-${index}-${Buffer.from(group).toString('base64url').slice(0, 10)}`,
      kind,
      title,
      subtitle: `${kind === 'drama' ? '广播剧' : kind === 'book' ? '有声书' : '网课'} · ${groupFiles.length} 集`,
      cover:
        kind === 'drama'
          ? 'linear-gradient(145deg, #3d1d51 0%, #ff5aa5 55%, #ffd1e8 100%)'
          : kind === 'book'
            ? 'linear-gradient(145deg, #332a7a 0%, #8e4cff 52%, #d8ccff 100%)'
            : 'linear-gradient(145deg, #06474a 0%, #34a0a4 52%, #c7f7ef 100%)',
      creator: 'NAS 本地文件',
      status: 'new',
      progress: 0,
      totalEpisodes: groupFiles.length,
      updatedAt: '刚刚扫描',
      tags: ['NAS', kind === 'drama' ? '广播剧' : kind === 'book' ? '有声书' : '网课'],
      description: `来自 NAS 目录：${group}`,
      episodes: groupFiles.map((file, fileIndex) => ({
        id: `local-${index}-${fileIndex}`,
        title: path.basename(file, path.extname(file)),
        duration: '--:--',
        progress: 0,
        filePath: file
      }))
    };
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: 'private-audio-room' });
});

app.get('/api/albums', (req, res) => {
  const kind = req.query.kind as MediaKind | undefined;
  const query = String(req.query.q || '').trim().toLowerCase();
  const state = readState();
  let albums = state.albums;

  if (kind) albums = albums.filter((album) => album.kind === kind);
  if (query) {
    albums = albums.filter((album) => {
      return [album.title, album.subtitle, album.creator, album.description, ...album.tags].some((value) =>
        value.toLowerCase().includes(query)
      );
    });
  }

  const category = String(req.query.category || '').trim();
  if (category) albums = albums.filter((album) => album.tags.includes(category));

  res.json({ albums });
});

app.get('/api/albums/:id', (req, res) => {
  const album = readState().albums.find((item) => item.id === req.params.id);
  if (!album) return res.status(404).json({ error: 'Album not found' });
  res.json({ album });
});

app.patch('/api/albums/:id/cover', (req, res) => {
  const cover = String(req.body.cover || '').trim();
  if (!cover) return res.status(400).json({ error: 'Cover is required' });
  if (!cover.startsWith('data:image/') && !cover.startsWith('linear-gradient(')) {
    return res.status(400).json({ error: 'Cover must be an image data URL or supported gradient' });
  }

  const state = readState();
  const albumIndex = state.albums.findIndex((item) => item.id === req.params.id);
  if (albumIndex < 0) return res.status(404).json({ error: 'Album not found' });

  state.albums[albumIndex] = { ...state.albums[albumIndex], cover };
  writeState(state);
  res.json({ album: state.albums[albumIndex] });
});

app.get('/api/categories', (_req, res) => {
  res.json({ categories: readState().categories });
});

app.post('/api/categories', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Category name is required' });

  const state = readState();
  const existing = state.categories.find((category) => category.name === name);
  if (existing) return res.json({ category: existing, categories: state.categories });

  const category: Category = {
    id: Buffer.from(name).toString('base64url').slice(0, 16),
    name
  };
  state.categories = [...state.categories, category];
  writeState(state);
  res.json({ category, categories: state.categories });
});

app.get('/api/nas', (_req, res) => {
  res.json({ nas: readState().nas });
});

app.post('/api/nas', (req, res) => {
  const current = readState();
  const root = String(req.body.root || '').trim();
  const nas: NasConfig = {
    type: req.body.type || 'local',
    label: req.body.label || '本地挂载 NAS',
    root,
    connected: root ? fs.existsSync(root) : false,
    lastScanAt: current.nas.lastScanAt
  };
  const next = { ...current, nas };
  writeState(next);
  res.json({ nas });
});

app.post('/api/scan', (_req, res) => {
  const state = readState();
  const root = state.nas.root || process.env.AUDIO_ROOT || '';

  if (!root || !fs.existsSync(root)) {
    return res.status(400).json({ error: 'NAS root is not configured or not reachable' });
  }

  const files = listAudioFiles(root);
  const scannedAlbums = albumsFromFiles(root, files);
  const next = {
    nas: { ...state.nas, connected: true, lastScanAt: new Date().toISOString() },
    albums: scannedAlbums.length ? scannedAlbums : state.albums,
    categories: state.categories
  };
  writeState(next);
  res.json({ albums: next.albums, count: files.length, nas: next.nas });
});

app.get('/media/:albumId/:episodeId', (req, res) => {
  const album = readState().albums.find((item) => item.id === req.params.albumId);
  const episode = album?.episodes.find((item) => item.id === req.params.episodeId);
  if (!episode?.filePath) return res.status(404).json({ error: 'Media file not found' });

  const resolved = path.resolve(episode.filePath);
  const root = path.resolve(readState().nas.root || process.env.AUDIO_ROOT || path.dirname(resolved));
  if (!resolved.startsWith(root) || !fs.existsSync(resolved)) {
    return res.status(403).json({ error: 'Media path is not allowed' });
  }

  res.sendFile(resolved);
});

const dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(port, () => {
  console.log(`Private Audio Room API listening on http://localhost:${port}`);
});
