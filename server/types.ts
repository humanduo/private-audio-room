export type MediaKind = 'drama' | 'book' | 'course';

export type Episode = {
  id: string;
  title: string;
  duration: string;
  filePath?: string;
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
  currentEpisodeId?: string;
  currentTime?: number;
  durationSeconds?: number;
  lastPlayedAt?: string;
  aiMetaStatus?: 'none' | 'suggested' | 'saved' | 'failed';
  aiMetaUpdatedAt?: string;
  episodes: Episode[];
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

export type UserProfile = {
  avatar: string;
  cvAvatars?: Record<string, string>;
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
