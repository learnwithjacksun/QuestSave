export type Platform =
  | "tiktok"
  | "instagram"
  | "twitter"
  | "youtube"
  | "pinterest"
  | "facebook"
  | "threads"
  | "soundcloud"
  | "douyin"
  | "xiaohongshu"
  | "xiaohongshu-profile"
  | "snackvideo"
  | "cocofun"
  | "kuaishou"
  | "capcut"
  | "gdrive"
  | "mediafire"
  | "spotify"
  | "yts";

export interface YoutubeSearchAuthor {
  name: string;
  url: string;
}

export interface YoutubeSearchVideo {
  type: string;
  videoId: string;
  url: string;
  title: string;
  description: string;
  thumbnail: string;
  seconds: number;
  timestamp: string;
  ago: string;
  views: number;
  author: YoutubeSearchAuthor;
}

export interface YoutubeSearchResult {
  platform: "yts";
  query: string;
  videos: YoutubeSearchVideo[];
}

export type MediaType = "video" | "image" | "audio" | "mixed";

export interface ClipFormat {
  id: string;
  ext: string;
  qualityLabel: string;
  mediaKind: "video" | "audio" | "image";
  filesize: number | null;
  height: number | null;
}

export interface ClipSlide {
  id: string;
  thumbnail: string;
  title: string;
  downloadId?: string;
  mediaKind?: MediaType | "video" | "image" | "audio";
}

export interface ClipPreview {
  platform: Platform;
  sourceUrl: string;
  mediaType: MediaType;
  title: string;
  author: string;
  thumbnail: string;
  stats: {
    likes: number | null;
    comments: number | null;
    views: number | null;
  };
  slides: ClipSlide[];
  formats: ClipFormat[];
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

export type ClipVisibility = "private" | "public";

export interface SavedClip {
  id: string;
  platform: string;
  sourceUrl: string;
  title: string;
  author: string;
  thumbnail: string;
  formatId?: string;
  mediaType: MediaType | string;
  playUrl?: string;
  visibility?: ClipVisibility;
  ownerUsername?: string;
  createdAt: string;
}

export interface SharedClip {
  shareId: string;
  sharedAt: string;
  sharedBy: {
    id: string;
    username: string;
  };
  clip: SavedClip;
}

export type LibraryTab = "saved" | "shared";

export type FypTab = "discover" | "library";

export type FeedOrigin = "library" | "shared" | "preview" | "public" | "youtube";

export interface FeedClip extends SavedClip {
  origin: FeedOrigin;
  sharedBy?: string;
}

export interface PreviewWatchState {
  preview?: FeedClip;
  playlist?: FeedClip[];
}
