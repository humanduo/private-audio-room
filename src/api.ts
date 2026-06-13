import type {
  Album,
  AlbumRecommendation,
  Category,
  FavoriteFolder,
  MediaKind,
  MetadataAnalyzeEstimate,
  MetadataAnalyzeJob,
  MetadataAnalyzeMode,
  NasConfig,
  SearchMode,
  UserProfile
} from './types';

const jsonHeaders = { 'Content-Type': 'application/json' };

export async function fetchAlbums(kind?: MediaKind, q?: string, category?: string, searchMode: SearchMode = 'text'): Promise<Album[]> {
  const params = new URLSearchParams();
  if (kind) params.set('kind', kind);
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  if (searchMode !== 'text') params.set('searchMode', searchMode);
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

export async function fetchFavoriteFolders(): Promise<FavoriteFolder[]> {
  const response = await fetch('/api/favorite-folders');
  if (!response.ok) throw new Error('收藏夹加载失败');
  const data = await response.json();
  return data.favoriteFolders;
}

export async function fetchAlbumRecommendations(albumId: string): Promise<AlbumRecommendation[]> {
  const response = await fetch(`/api/albums/${albumId}/recommendations?limit=6`);
  if (!response.ok) throw new Error('相关推荐加载失败');
  const data = await response.json();
  return data.recommendations;
}

export async function createFavoriteFolder(name: string): Promise<FavoriteFolder[]> {
  const response = await fetch('/api/favorite-folders', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ name })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '收藏夹创建失败');
  return data.favoriteFolders;
}

export async function addAlbumToFavoriteFolder(folderId: string, albumId: string): Promise<FavoriteFolder[]> {
  const response = await fetch(`/api/favorite-folders/${folderId}/albums/${albumId}`, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '收藏失败');
  return data.favoriteFolders;
}

export async function removeAlbumFromFavoriteFolder(folderId: string, albumId: string): Promise<FavoriteFolder[]> {
  const response = await fetch(`/api/favorite-folders/${folderId}/albums/${albumId}`, { method: 'DELETE' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '取消收藏失败');
  return data.favoriteFolders;
}

export async function fetchProfile(): Promise<UserProfile> {
  const response = await fetch('/api/profile');
  if (!response.ok) throw new Error('个人资料加载失败');
  const data = await response.json();
  return data.profile;
}

export async function updateProfileAvatar(avatar: string): Promise<UserProfile> {
  const response = await fetch('/api/profile', {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ avatar })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '头像保存失败');
  return data.profile;
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

export async function updateAlbumMetadata(albumId: string, metadata: Partial<Album>): Promise<Album> {
  const response = await fetch(`/api/albums/${albumId}/metadata`, {
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
  const response = await fetch(`/api/albums/${albumId}/metadata/analyze`, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'DeepSeek 资料整理失败');
  return { metadata: data.metadata, album: data.album };
}

export async function estimateLibraryMetadata(mode: MetadataAnalyzeMode = 'all'): Promise<MetadataAnalyzeEstimate> {
  const response = await fetch('/api/metadata/analyze-batch/estimate', {
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
  const startResponse = await fetch('/api/metadata/analyze-batch/jobs', {
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
    const progressResponse = await fetch(`/api/metadata/analyze-batch/jobs/${job.id}`);
    const progressData = await progressResponse.json();
    if (!progressResponse.ok) throw new Error(progressData.error || 'DeepSeek 整理进度读取失败');
    job = progressData.job;
    onProgress?.(job);
  }

  if (job.status === 'failed') throw new Error(job.error || 'DeepSeek 全库整理失败');
  return { job, albums: await fetchAlbums() };
}

export async function generateAlbumCover(albumId: string): Promise<Album> {
  const response = await fetch(`/api/albums/${albumId}/cover/generate`, { method: 'POST' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'AI 封面生成失败');
  return data.album;
}
