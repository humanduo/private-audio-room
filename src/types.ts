export type MediaKind = 'drama' | 'book' | 'course';
export type SearchMode = 'text' | 'cv';

export type Episode = {
  id: string;
  title: string;
  duration: string;
  filePath?: string;
  progress?: number;
  isPreview?: boolean;
};

export type Album = {
  id: string;
  kind: MediaKind;
  title: string;
  subtitle: string;
  cover: string;
  creator: string;
  status: 'new' | 'listening' | 'finished';
  progress: number;
  totalEpisodes: number;
  updatedAt: string;
  tags: string[];
  description: string;
  author?: string;
  cast?: string[];
  summary?: string;
  genres?: string[];
  relationship?: string;
  audience?: string;
  finishStatus?: string;
  aiMetaStatus?: 'none' | 'suggested' | 'saved' | 'failed';
  aiMetaUpdatedAt?: string;
  episodes: Episode[];
};

export type NasConfig = {
  type: 'local' | 'smb' | 'webdav';
  label: string;
  root: string;
  connected: boolean;
  lastScanAt?: string;
};

export type AppConfig = {
  name: string;
  publicUrl: string;
  mediaRoot: string;
  maxScanFiles: number;
  supportedAudioExtensions: string[];
  supportedCoverNames: string[];
};

export type Category = {
  id: string;
  name: string;
};

export type FavoriteFolder = {
  id: string;
  name: string;
  albumIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type AlbumRecommendation = {
  album: Album;
  score: number;
  reasons: string[];
};

export type MetadataAnalyzeJob = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  kind: MediaKind;
  mode: string;
  limit: number;
  total: number;
  processed: number;
  updated: number;
  failed: number;
  currentAlbumTitle: string;
  results: Array<{ id: string; title: string; ok: boolean; error?: string; needsReview?: boolean; aiMetaStatus?: string }>;
  startedAt: string;
  finishedAt?: string;
  error?: string;
};

export type MetadataAnalyzeMode = 'missing-only' | 'failed-only' | 'all';

export type MetadataAnalyzeEstimate = {
  kind: MediaKind;
  mode: MetadataAnalyzeMode;
  modeLabel: string;
  limit: number;
  total: number;
  totalBeforeLimit: number;
};

export type UserProfile = {
  avatar: string;
};

export type AppView = 'home' | 'files' | 'search' | 'me';
