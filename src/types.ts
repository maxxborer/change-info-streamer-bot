export interface TwitchCategory {
  id: string;
  name: string;
  imageUrl: string;
}

export interface YouTubeCategory {
  id: string;
  name: string;
  iconSvg: string;
}

export interface TwitchState {
  connected: boolean;
  live: boolean;
  accountName?: string;
  login?: string;
  broadcasterId?: string;
  title?: string;
  categoryId?: string;
  categoryName?: string;
  categoryImageUrl?: string;
  tags?: string[];
}

export interface YouTubeState {
  connected: boolean;
  live: boolean;
  accountName?: string;
  broadcastId?: string;
  status?: string;
  title?: string;
  categoryId?: string;
  categoryName?: string;
  tags?: string[];
}

export interface StreamState {
  apiVersion: number;
  twitch: TwitchState;
  youtube: YouTubeState;
}

export interface ActionResponse {
  apiVersion: number;
  requestId: string;
  command: string;
  ok: boolean;
  data: Record<string, unknown> | null;
  error: { message: string } | null;
}

export interface ConnectionSettings {
  host: string;
  port: number;
  endpoint: string;
  password: string;
  rememberPassword: boolean;
  twitchTemplate: string;
  youtubeTemplate: string;
  lastSubtitle: string;
}

export interface ActionSummary {
  id: string;
  name: string;
  group: string;
  enabled: boolean;
}

export type Platform = "twitch" | "youtube";

export interface EditForm {
  platform: Platform;
  titleMode: "subtitle" | "full";
  subtitle: string;
  title: string;
  category: TwitchCategory | YouTubeCategory | null;
  tags: string[];
  tagDraft: string;
  categoryQuery: string;
}

export interface AllForm {
  subtitle: string;
  twitchCategory: TwitchCategory | null;
  youtubeCategory: YouTubeCategory | null;
  twitchTags: string[];
  youtubeTags: string[];
  twitchTagDraft: string;
  youtubeTagDraft: string;
  twitchCategoryQuery: string;
  youtubeCategoryQuery: string;
}
