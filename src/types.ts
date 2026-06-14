export type MediaKind = 'drama' | 'book' | 'course';
export type SearchMode = 'text' | 'cv';

export type Episode = {
  id: string;
  title: string;
  duration: string;
  filePath?: string;
  relativePath?: string;
  progress?: number;
  currentTime?: number;
  durationSeconds?: number;
  lastPlayedAt?: string;
  isPreview?: boolean;
};

export type Album = {
  id: string;
  kind: MediaKind;
  title: string;
  subtitle: string;
  cover: string;
  coverUpdatedAt?: number;
  creator: string;
  status: 'new' | 'listening' | 'finished';
  progress: number;
  totalEpisodes: number;
  updatedAt: string;
  tags: string[];
  description: string;
  author?: string;
  cast?: string[];
  platform?: string;
  summary?: string;
  genres?: string[];
  relationship?: string;
  audience?: string;
  finishStatus?: string;
  metadataSources?: string[];
  metadataSource?: string;
  metadataVerified?: boolean;
  metadataUpdatedAt?: string;
  metadataEditedManually?: boolean;
  currentEpisodeId?: string;
  currentTime?: number;
  durationSeconds?: number;
  lastPlayedAt?: string;
  aiMetaStatus?: 'none' | 'suggested' | 'saved' | 'failed';
  aiMetaUpdatedAt?: string;
  episodes: Episode[];
};

export type PlaybackProgress = {
  albumId: string;
  episodeId: string;
  episodeTitle: string;
  mediaUrl: string;
  relativePath: string;
  currentTime: number;
  duration: number;
  progress: number;
  updatedAt: string;
};

export type AiPendingMetadata = {
  id: string;
  albumId: string;
  title: string;
  metadata: Partial<Album> & {
    confidence?: number;
    sources?: string[];
    needsReview?: boolean;
  };
  sources: string[];
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
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
  skipped: number;
  currentAlbumTitle: string;
  results: Array<{ id: string; title: string; ok: boolean; error?: string; needsReview?: boolean; aiMetaStatus?: string; skipped?: boolean }>;
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
  cvAvatars?: Record<string, string>;
};

export type AppView = 'home' | 'files' | 'search' | 'me';
