export type MediaKind = 'drama' | 'book' | 'course';

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
  episodes: Episode[];
};

export type NasConfig = {
  type: 'local' | 'smb' | 'webdav';
  label: string;
  root: string;
  connected: boolean;
  lastScanAt?: string;
};

export type Category = {
  id: string;
  name: string;
};

export type AppView = 'home' | 'files' | 'search' | 'me';
