import type { Album, Category, MediaKind, NasConfig } from './types';

const jsonHeaders = { 'Content-Type': 'application/json' };

export async function fetchAlbums(kind?: MediaKind, q?: string, category?: string): Promise<Album[]> {
  const params = new URLSearchParams();
  if (kind) params.set('kind', kind);
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  const response = await fetch(`/api/albums?${params.toString()}`);
  if (!response.ok) throw new Error('专辑列表加载失败');
  const data = await response.json();
  return data.albums;
}

export async function fetchCategories(): Promise<Category[]> {
  const response = await fetch('/api/categories');
  if (!response.ok) throw new Error('分类加载失败');
  const data = await response.json();
  return data.categories;
}

export async function createCategory(name: string): Promise<Category[]> {
  const response = await fetch('/api/categories', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ name })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '分类保存失败');
  return data.categories;
}

export async function fetchNas(): Promise<NasConfig> {
  const response = await fetch('/api/nas');
  if (!response.ok) throw new Error('NAS 状态加载失败');
  const data = await response.json();
  return data.nas;
}

export async function saveNas(root: string): Promise<NasConfig> {
  const response = await fetch('/api/nas', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ type: 'local', label: '本地挂载 NAS', root })
  });
  if (!response.ok) throw new Error('NAS 配置保存失败');
  const data = await response.json();
  return data.nas;
}

export async function scanNas(): Promise<{ albums: Album[]; count: number; nas: NasConfig }> {
  const response = await fetch('/api/scan', { method: 'POST' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '扫描失败');
  return data;
}

export async function updateAlbumCover(albumId: string, cover: string): Promise<Album> {
  const response = await fetch(`/api/albums/${albumId}/cover`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ cover })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '封面保存失败');
  return data.album;
}

export async function generateAlbumCover(albumId: string): Promise<Album> {
  const response = await fetch(`/api/albums/${albumId}/cover/generate`, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'AI 封面生成失败');
  return data.album;
}
