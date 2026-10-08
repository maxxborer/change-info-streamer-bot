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
  channelId?: string;
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
  templates: TemplateState;
}

export interface TemplateState {
  twitchTemplate: string;
  youtubeTemplate: string;
  subtitle: string;
  configured: boolean;
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
  twitchEnabled: boolean;
  youtubeEnabled: boolean;
}

export interface ActionSummary {
  id: string;
  name: string;
  group: string;
  enabled: boolean;
}

export type Platform = "twitch" | "youtube";

export interface AllForm {
  twitchTitle: string;
  youtubeTitle: string;
  twitchTitleMode: "subtitle" | "full";
  youtubeTitleMode: "subtitle" | "full";
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
