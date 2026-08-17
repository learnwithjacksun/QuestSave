export type Platform =
  | "tiktok"
  | "instagram"
  | "twitter"
  | "youtube"
  | "pinterest"
  | "facebook";
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

export type FeedOrigin = "library" | "shared" | "preview" | "public";

export interface FeedClip extends SavedClip {
  origin: FeedOrigin;
  sharedBy?: string;
}

export interface PreviewWatchState {
  preview: FeedClip;
}
