import type {
  Album,
  AlbumRecommendation,
  AiPendingMetadata,
  Category,
  CoverImportResult,
  Episode,
  FavoriteFolder,
  MediaKind,
  MetadataAnalyzeEstimate,
  MetadataAnalyzeJob,
  MetadataAnalyzeMode,
  MetadataImportResult,
  MetadataTemplateItem,
  NasConfig,
  SearchMode,
  UserProfile
} from './types';

const jsonHeaders = { 'Content-Type': 'application/json' };
const apiBaseStorageKey = 'private-audio-room-api-base-url';

function safeLocalStorageValue(key: string) {
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function normalizeApiBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const isLocalOrIp =
    /^localhost(?::\d+)?$/i.test(trimmed) ||
    /^(\d{1,3}\.){3}\d{1,3}(?::\d+)?$/.test(trimmed) ||
    /:\d+$/.test(trimmed);
  return `${isLocalOrIp ? 'http' : 'https'}://${trimmed}`;
}

export function getApiBaseUrl() {
  const env = (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env;
  return normalizeApiBaseUrl(safeLocalStorageValue(apiBaseStorageKey) || env?.VITE_API_BASE_URL || '');
}

export function setApiBaseUrl(value: string) {
  const normalized = normalizeApiBaseUrl(value);
  try {
    if (normalized) window.localStorage.setItem(apiBaseStorageKey, normalized);
    else window.localStorage.removeItem(apiBaseStorageKey);
  } catch {
    // Ignore storage failures; the current session can still use relative URLs.
  }
  return normalized;
}

export function apiUrl(path: string) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl || /^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function fetchAlbums(kind?: MediaKind, q?: string, category?: string, searchMode: SearchMode = 'text'): Promise<Album[]> {
  const params = new URLSearchParams();
  if (kind) params.set('kind', kind);
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  if (searchMode !== 'text') params.set('searchMode', searchMode);
  const response = await fetch(apiUrl(`/api/albums?${params.toString()}`));
  if (!response.ok) throw new Error('专辑列表加载失败');
  const data = await response.json();
  return data.albums;
}

export async function fetchCategories(): Promise<Category[]> {
  const response = await fetch(apiUrl('/api/categories'));
  if (!response.ok) throw new Error('分类加载失败');
  const data = await response.json();
  return data.categories;
}

export async function createCategory(name: string): Promise<Category[]> {
  const response = await fetch(apiUrl('/api/categories'), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ name })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '分类保存失败');
  return data.categories;
}

export async function fetchFavoriteFolders(): Promise<FavoriteFolder[]> {
  const response = await fetch(apiUrl('/api/favorite-folders'));
  if (!response.ok) throw new Error('收藏夹加载失败');
  const data = await response.json();
  return data.favoriteFolders;
}

export async function fetchAlbumRecommendations(albumId: string): Promise<AlbumRecommendation[]> {
  const response = await fetch(apiUrl(`/api/albums/${albumId}/recommendations?limit=6`));
  if (!response.ok) throw new Error('相关推荐加载失败');
  const data = await response.json();
  return data.recommendations;
}

export async function updateEpisodeProgress(albumId: string, episode: Episode, currentTime: number, duration: number, ended = false): Promise<Album> {
  const response = await fetch(apiUrl('/api/playback-progress'), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      albumId,
      episodeId: episode.id,
      relativePath: episode.relativePath || '',
      currentTime,
      duration,
      ended,
      updatedAt: new Date().toISOString()
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '播放进度保存失败');
  return data.album;
}

export async function createFavoriteFolder(name: string): Promise<FavoriteFolder[]> {
  const response = await fetch(apiUrl('/api/favorite-folders'), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ name })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '收藏夹创建失败');
  return data.favoriteFolders;
}

export async function addAlbumToFavoriteFolder(folderId: string, albumId: string): Promise<FavoriteFolder[]> {
  const response = await fetch(apiUrl(`/api/favorite-folders/${folderId}/albums/${albumId}`), { method: 'POST' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '收藏失败');
  return data.favoriteFolders;
}

export async function removeAlbumFromFavoriteFolder(folderId: string, albumId: string): Promise<FavoriteFolder[]> {
  const response = await fetch(apiUrl(`/api/favorite-folders/${folderId}/albums/${albumId}`), { method: 'DELETE' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '取消收藏失败');
  return data.favoriteFolders;
}

export async function fetchProfile(): Promise<UserProfile> {
  const response = await fetch(apiUrl('/api/profile'));
  if (!response.ok) throw new Error('个人资料加载失败');
  const data = await response.json();
  return data.profile;
}

export async function updateProfileAvatar(avatar: string): Promise<UserProfile> {
  const response = await fetch(apiUrl('/api/profile'), {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ avatar })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '头像保存失败');
  return data.profile;
}

export async function refreshCvAvatars(names: string[]): Promise<UserProfile> {
  const response = await fetch(apiUrl('/api/cv-avatars/refresh'), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ names })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'CV 头像刷新失败');
  return data.profile;
}

export async function updateCvAvatar(name: string, avatar: string): Promise<UserProfile> {
  const response = await fetch(apiUrl('/api/cv-avatars'), {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ name, avatar })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'CV 头像保存失败');
  return data.profile;
}

export async function fetchNas(): Promise<NasConfig> {
  const response = await fetch(apiUrl('/api/nas'));
  if (!response.ok) throw new Error('NAS 状态加载失败');
  const data = await response.json();
  return data.nas;
}

export async function saveNas(root: string): Promise<NasConfig> {
  const response = await fetch(apiUrl('/api/nas'), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ type: 'local', label: '本地挂载 NAS', root })
  });
  if (!response.ok) throw new Error('NAS 配置保存失败');
  const data = await response.json();
  return data.nas;
}

export async function scanNas(): Promise<{ albums: Album[]; count: number; nas: NasConfig }> {
  const response = await fetch(apiUrl('/api/scan'), { method: 'POST' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '扫描失败');
  return data;
}

export async function updateAlbumCover(albumId: string, cover: string): Promise<Album> {
  const response = await fetch(apiUrl(`/api/albums/${albumId}/cover`), {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ cover })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '封面保存失败');
  return data.album;
}

export async function uploadAlbumCover(albumId: string, file: File): Promise<Album> {
  const formData = new FormData();
  formData.append('cover', file);
  const response = await fetch(apiUrl(`/api/albums/${albumId}/cover/upload`), {
    method: 'POST',
    body: formData
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '封面上传失败');
  return data.album;
}

export async function updateAlbumMetadata(albumId: string, metadata: Partial<Album>): Promise<Album> {
  const response = await fetch(apiUrl(`/api/albums/${albumId}/metadata`), {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify(metadata)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '资料保存失败');
  return data.album;
}

export async function analyzeAlbumMetadata(
  albumId: string
): Promise<{ metadata: Partial<Album> & { confidence?: number; needsReview?: boolean }; album: Album }> {
  const response = await fetch(apiUrl(`/api/albums/${albumId}/metadata/analyze`), { method: 'POST' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'DeepSeek 资料整理失败');
  return { metadata: data.metadata, album: data.album };
}

export async function fetchAiPendingMetadata(): Promise<AiPendingMetadata[]> {
  const response = await fetch(apiUrl('/api/metadata/pending'));
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'AI 待确认加载失败');
  return data.items;
}

export async function exportMetadataTemplate(): Promise<MetadataTemplateItem[]> {
  const response = await fetch(apiUrl('/api/metadata/export-template'));
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '资料模板导出失败');
  return data;
}

export async function importMetadataTemplate(items: MetadataTemplateItem[]): Promise<MetadataImportResult> {
  const response = await fetch(apiUrl('/api/metadata/import'), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(items)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '资料导入失败');
  return data;
}

export async function importAlbumCoversZip(file: File): Promise<CoverImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(apiUrl('/api/covers/import'), {
    method: 'POST',
    body: formData
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '批量封面导入失败');
  return data;
}

// Fetch the CV avatar todo list as CSV and trigger a browser download.
// Returns the number of CV rows downloaded for UI feedback.
export async function downloadCvAvatarTodo(): Promise<number> {
  const response = await fetch(apiUrl('/api/cv-avatars/todo-export'));
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'CV 头像清单导出失败');
  }
  const blob = await response.blob();
  const text = await blob.text();
  const lines = text.replace(/^\ufeff/, '').split(/\r\n|\r|\n/).filter(Boolean);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'cv-avatar-todo.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return Math.max(0, lines.length - 1);
}

export async function approveAiPendingMetadata(id: string): Promise<{ item: AiPendingMetadata; album: Album }> {
  const response = await fetch(apiUrl(`/api/metadata/pending/${id}/approve`), { method: 'POST' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'AI 资料批准失败');
  return { item: data.item, album: data.album };
}

export async function rejectAiPendingMetadata(id: string): Promise<AiPendingMetadata> {
  const response = await fetch(apiUrl(`/api/metadata/pending/${id}/reject`), { method: 'POST' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'AI 资料拒绝失败');
  return data.item;
}

export async function researchAiPendingMetadata(id: string): Promise<{ item: AiPendingMetadata; album: Album; autoApplied: boolean }> {
  const response = await fetch(apiUrl(`/api/metadata/pending/${id}/research`), { method: 'POST' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'AI 资料重新搜索失败');
  return { item: data.item, album: data.album, autoApplied: Boolean(data.autoApplied) };
}

export async function estimateLibraryMetadata(mode: MetadataAnalyzeMode = 'all'): Promise<MetadataAnalyzeEstimate> {
  const response = await fetch(apiUrl('/api/metadata/analyze-batch/estimate'), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ kind: 'drama', mode, limit: 50 })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'DeepSeek 整理数量预估失败');
  return data;
}

export async function analyzeLibraryMetadata(
  mode: MetadataAnalyzeMode = 'all',
  onProgress?: (job: MetadataAnalyzeJob) => void
): Promise<{ job: MetadataAnalyzeJob; albums: Album[] }> {
  const startResponse = await fetch(apiUrl('/api/metadata/analyze-batch/jobs'), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ kind: 'drama', mode, limit: 50 })
  });
  const startData = await startResponse.json();
  if (!startResponse.ok) throw new Error(startData.error || 'DeepSeek 全库整理失败');

  let job = startData.job as MetadataAnalyzeJob;
  onProgress?.(job);

  while (job.status === 'queued' || job.status === 'running') {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const progressResponse = await fetch(apiUrl(`/api/metadata/analyze-batch/jobs/${job.id}`));
    const progressData = await progressResponse.json();
    if (!progressResponse.ok) throw new Error(progressData.error || 'DeepSeek 整理进度读取失败');
    job = progressData.job;
    onProgress?.(job);
  }

  if (job.status === 'failed') throw new Error(job.error || 'DeepSeek 全库整理失败');
  return { job, albums: await fetchAlbums() };
}

export async function generateAlbumCover(albumId: string): Promise<Album> {
  const response = await fetch(apiUrl(`/api/albums/${albumId}/cover/generate`), { method: 'POST' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'AI 封面生成失败');
  return data.album;
}
