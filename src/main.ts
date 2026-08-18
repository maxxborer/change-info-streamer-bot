import { StreamerbotClient } from "@streamerbot/client";
import { brandIcon, uiIcon } from "./icons";
import { FALLBACK_CATEGORY_SVG, YOUTUBE_CATEGORIES } from "./youtube-categories";
import { STREAMERBOT_IMPORT } from "./streamerbot-import";
import { DEFAULT_TWITCH_TEMPLATE, DEFAULT_YOUTUBE_TEMPLATE, isTemplateValid, titleFromTemplate } from "./templates";
import type {
  ActionResponse,
  ActionSummary,
  AllForm,
  ConnectionSettings,
  EditForm,
  Platform,
  StreamState,
  TemplateState,
  TwitchCategory,
  TwitchState,
  YouTubeCategory,
  YouTubeState,
} from "./types";
import "./styles.css";

const API_VERSION = 3;
const ACTION_GROUP = "STREAM INFO";
const ACTION_NAME = "STREAM INFO | API";
const CODE_EVENT = "stream_info_api_response";
const STORAGE_KEY = "change-info-streamer-bot.settings.v1";
const REQUEST_TIMEOUT = 15_000;

type ConnectionStatus = "connecting" | "connected" | "disconnected";
type ActionStatus = "unknown" | "ready" | "missing" | "disabled" | "outdated";
type Modal = "settings" | "twitch" | "youtube" | "all" | null;
type CardEffect = "success" | "flash-error" | null;

interface Notice {
  id: string;
  title: string;
  lines: string[];
}

interface TemplateDraft {
  twitchTemplate: string;
  youtubeTemplate: string;
  subtitle: string;
}

interface PresetAction extends ActionSummary {
  label: string;
}

interface AppState {
  connection: ConnectionStatus;
  connectionError: string | null;
  authNeeded: boolean;
  actionStatus: ActionStatus;
  action: ActionSummary | null;
  stream: StreamState | null;
  modal: Modal;
  settingsDraft: ConnectionSettings;
  templateDraft: TemplateDraft;
  presetActions: PresetAction[];
  runningPresetId: string | null;
  templatesSaving: boolean;
  templatesDirty: boolean;
  editForm: EditForm | null;
  allForm: AllForm | null;
  twitchResults: TwitchCategory[];
  twitchSearchFor: string;
  loadingPlatforms: Set<Platform>;
  cardEffects: Record<Platform, CardEffect>;
  cardErrors: Record<Platform, boolean>;
  notices: Notice[];
  showImport: boolean;
  importCopied: boolean;
  lastUpdated: Date | null;
}

const defaults: ConnectionSettings = {
  host: "127.0.0.1",
  port: 8080,
  endpoint: "/",
  password: "",
  rememberPassword: false,
  twitchTemplate: DEFAULT_TWITCH_TEMPLATE,
  youtubeTemplate: DEFAULT_YOUTUBE_TEMPLATE,
  lastSubtitle: "",
};

function loadSettings(): ConnectionSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<ConnectionSettings>;
    return {
      ...defaults,
      ...saved,
      password: saved.rememberPassword ? saved.password ?? "" : "",
      port: Number.isFinite(saved.port) ? Number(saved.port) : defaults.port,
    };
  } catch {
    return { ...defaults };
  }
}

let settings = loadSettings();
const state: AppState = {
  connection: "connecting",
  connectionError: null,
  authNeeded: false,
  actionStatus: "unknown",
  action: null,
  stream: null,
  modal: null,
  settingsDraft: { ...settings },
  templateDraft: {
    twitchTemplate: settings.twitchTemplate,
    youtubeTemplate: settings.youtubeTemplate,
    subtitle: settings.lastSubtitle,
  },
  presetActions: [],
  runningPresetId: null,
  templatesSaving: false,
  templatesDirty: false,
  editForm: null,
  allForm: null,
  twitchResults: [],
  twitchSearchFor: "",
  loadingPlatforms: new Set(),
  cardEffects: { twitch: null, youtube: null },
  cardErrors: { twitch: false, youtube: false },
  notices: [],
  showImport: false,
  importCopied: false,
  lastUpdated: null,
};

const appElement = document.querySelector<HTMLDivElement>("#app");
if (!appElement) throw new Error("Не найден контейнер приложения.");
const app: HTMLDivElement = appElement;

let client: StreamerbotClient | null = null;
let requestResolvers = new Map<string, { resolve: (response: ActionResponse) => void; reject: (reason: Error) => void; timer: number }>();
let pollingId: number | null = null;
let searchTimer: number | null = null;
let actionCheckRunning = false;

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function uuid(): string {
  return crypto.randomUUID();
}

function saveSettings(): void {
  const persisted: ConnectionSettings = {
    ...settings,
    password: settings.rememberPassword ? settings.password : "",
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

function notify(title: string, lines: string[]): void {
  state.notices.unshift({ id: uuid(), title, lines });
  render();
}

function closeNotice(id: string): void {
  state.notices = state.notices.filter((notice) => notice.id !== id);
  render();
}

function connectionText(): string {
  if (state.connection === "connected") return "Streamer.bot подключён";
  if (state.connection === "connecting") return "Подключение…";
  return "Streamer.bot не подключён";
}

function cardStatus(platform: Platform): "live" | "offline" | "disconnected" {
  const value = state.stream?.[platform];
  if (!value?.connected) return "disconnected";
  return value.live ? "live" : "offline";
}

function renderIcon(name: "refresh" | "settings" | "external" | "dashboard" | "close" | "copy" | "twitch" | "youtube" | "warning"): string {
  if (name === "twitch" || name === "youtube") return brandIcon(name);
  return uiIcon(name);
}

function button(label: string, action: string, options: { title?: string; className?: string; disabled?: boolean; icon?: string; data?: string } = {}): string {
  const title = options.title ? ` title="${escapeHtml(options.title)}"` : "";
  const disabled = options.disabled ? " disabled" : "";
  const data = options.data ? ` ${options.data}` : "";
  return `<button type="button" class="${options.className ?? "button"}" data-action="${action}"${title}${disabled}${data}>${options.icon ?? ""}<span>${escapeHtml(label)}</span></button>`;
}

function iconButton(action: string, title: string, icon: string, disabled = false, data = ""): string {
  return `<button type="button" class="icon-button" data-action="${action}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"${disabled ? " disabled" : ""}${data}>${icon}</button>`;
}

function renderHeader(): string {
  return `<header class="topbar">
    <div class="brand"><span class="brand-mark">S</span><h1>Stream Info</h1></div>
    <div class="header-actions">
      <span class="connection connection-${state.connection}"><i></i>${escapeHtml(connectionText())}</span>
      ${iconButton("refresh-state", "Обновить данные", renderIcon("refresh"), state.connection !== "connected")}
      ${iconButton("open-settings", "Настройки", renderIcon("settings"))}
      ${button("Обновить все", "open-all", { className: "button primary", disabled: !state.stream || state.connection !== "connected" })}
    </div>
  </header>`;
}

function authPanel(): string {
  if (!state.authNeeded) return "";
  return `<section class="auth-panel" aria-label="Авторизация Streamer.bot">
    <div>${renderIcon("warning")}<div><strong>Не удалось авторизоваться в Streamer.bot</strong><span>${escapeHtml(state.connectionError ?? "Укажите пароль WebSocket и подключитесь снова.")}</span></div></div>
    <label>Пароль <input type="password" name="auth-password" data-input="auth-password" value="${escapeHtml(settings.password)}" autocomplete="current-password" /></label>
    ${button("Подключиться", "connect-password", { className: "button primary" })}
  </section>`;
}

function renderImport(): string {
  const outdated = state.actionStatus === "outdated";
  const disabled = state.actionStatus === "disabled";
  const headline = outdated ? "Версия Action устарела. Повторно импортируйте актуальную строку." : disabled ? `Action «${ACTION_NAME}» отключён в Streamer.bot.` : `Для работы требуется Action «${ACTION_NAME}».`;
  const body = disabled ? "Включите его в Streamer.bot и нажмите «Проверить снова»." : `<ol><li>Откройте Streamer.bot.</li><li>Нажмите Import.</li><li>Вставьте строку ниже.</li><li>Завершите импорт.</li></ol>`;
  return `<main class="setup-wrap"><section class="setup-card">
    <div class="setup-icon">${renderIcon(disabled ? "warning" : "copy")}</div>
    <h2>${escapeHtml(headline)}</h2>${body}
    <div class="setup-actions">
      ${button(state.importCopied ? "Скопировано" : "Скопировать Import-строку", "copy-import", { className: "button primary", icon: renderIcon("copy") })}
      ${button(state.showImport ? "Скрыть строку" : "Показать строку", "toggle-import")}
      ${button("Проверить снова", "check-action")}
    </div>
    ${state.showImport ? `<textarea class="import-code" readonly aria-label="Import-строка Streamer.bot">${escapeHtml(STREAMERBOT_IMPORT)}</textarea>` : ""}
  </section></main>`;
}

function platformLogo(platform: Platform): string {
  return `<span class="platform-logo ${platform}">${renderIcon(platform)}</span>`;
}

function tagsHtml(tags: string[]): string {
  return tags.length ? `<div class="tag-list">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>` : '<span class="muted">Нет тегов</span>';
}

function categoryImage(imageUrl: string | undefined): string {
  if (!imageUrl) return `<span class="category-image fallback">${FALLBACK_CATEGORY_SVG}</span>`;
  return `<span class="category-image"><img src="${escapeHtml(imageUrl)}" alt="" data-fallback="category" /><span class="category-fallback">${FALLBACK_CATEGORY_SVG}</span></span>`;
}

function youtubeCategoryIcon(categoryId: string | undefined): string {
  const category = YOUTUBE_CATEGORIES.find((item) => item.id === categoryId);
  return `<span class="category-image youtube-category-icon">${category?.iconSvg ?? FALLBACK_CATEGORY_SVG}</span>`;
}

function categorySummary(visual: string, name: string | null | undefined, id: string | null | undefined): string {
  return `<div class="category-summary">${visual}<div><span>Категория</span><strong>${escapeHtml(name || "—")}</strong><small>ID ${escapeHtml(id || "—")}</small></div></div>`;
}

function renderTwitchCard(twitch: TwitchState): string {
  const status = cardStatus("twitch");
  const loading = state.loadingPlatforms.has("twitch");
  const login = twitch.login ?? "";
  const streamUrl = login ? `https://www.twitch.tv/${encodeURIComponent(login)}` : "";
  const dashboardUrl = login ? `https://dashboard.twitch.tv/u/${encodeURIComponent(login)}/stream-manager` : "";
  return `<section class="platform-card ${status}${state.cardErrors.twitch ? " card-error" : ""}${state.cardEffects.twitch ? ` card-${state.cardEffects.twitch}` : ""}" data-platform="twitch">
    <div class="card-heading"><div>${platformLogo("twitch")}<div><h2>Twitch</h2><span>${escapeHtml(twitch.accountName || "Аккаунт не подключён")}</span></div></div><span class="live-badge ${status}">${status === "live" ? "В эфире" : status === "offline" ? "Не в эфире" : "Не подключён"}</span></div>
    ${loading ? '<div class="card-spinner" aria-label="Выполняется обновление"></div>' : ""}
    <div class="card-body"><div class="stream-title"><span>Название</span><strong>${escapeHtml(twitch.title || "—")}</strong></div><div class="stream-meta">${categorySummary(categoryImage(twitch.categoryImageUrl), twitch.categoryName, twitch.categoryId)}<div class="tags-section"><span>Теги</span>${tagsHtml(asStringArray(twitch.tags))}</div></div></div>
    <div class="card-footer"><div>${button("Изменить", "edit-twitch", { disabled: !twitch.connected || loading })}</div><div class="card-links">${iconButton("open-link", "Открыть стрим", renderIcon("external"), !streamUrl, ` data-url="${escapeHtml(streamUrl)}"`)}${iconButton("open-link", "Открыть дашборд", renderIcon("dashboard"), !dashboardUrl, ` data-url="${escapeHtml(dashboardUrl)}"`)}</div></div>
  </section>`;
}

function renderYouTubeCard(youtube: YouTubeState): string {
  const status = cardStatus("youtube");
  const loading = state.loadingPlatforms.has("youtube");
  const canEdit = Boolean(youtube.connected && youtube.live && youtube.broadcastId);
  const id = youtube.broadcastId ?? "";
  const streamUrl = canEdit ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : "";
  const dashboardUrl = canEdit
    ? `https://studio.youtube.com/video/${encodeURIComponent(id)}/livestreaming`
    : youtube.channelId
      ? `https://studio.youtube.com/channel/${encodeURIComponent(youtube.channelId)}/livestreaming/dashboard`
      : youtube.connected ? "https://studio.youtube.com/" : "";
  const details = canEdit ? `<div class="card-body"><div class="stream-title"><span>Название</span><strong>${escapeHtml(youtube.title || "—")}</strong></div><div class="stream-meta">${categorySummary(youtubeCategoryIcon(youtube.categoryId), youtube.categoryName, youtube.categoryId)}<div class="tags-section"><span>Теги</span>${tagsHtml(asStringArray(youtube.tags))}</div></div></div>` : "";
  return `<section class="platform-card ${status}${!canEdit ? " compact-unavailable" : ""}${state.cardErrors.youtube ? " card-error" : ""}${state.cardEffects.youtube ? ` card-${state.cardEffects.youtube}` : ""}" data-platform="youtube">
    <div class="card-heading"><div>${platformLogo("youtube")}<div><h2>YouTube</h2><span>${escapeHtml(youtube.accountName || "Аккаунт не подключён")}</span></div></div><span class="live-badge ${status}">${youtube.live ? "В эфире" : "Не запущен"}</span></div>
    ${!canEdit ? '<div class="youtube-warning">Стрим YouTube должен быть запущен</div>' : ""}
    ${loading ? '<div class="card-spinner" aria-label="Выполняется обновление"></div>' : ""}
    ${details}
    <div class="card-footer"><div>${button("Изменить", "edit-youtube", { disabled: !canEdit || loading })}</div><div class="card-links">${iconButton("open-link", "Открыть стрим", renderIcon("external"), !streamUrl, ` data-url="${escapeHtml(streamUrl)}"`)}${iconButton("open-link", "Открыть дашборд", renderIcon("dashboard"), !dashboardUrl, ` data-url="${escapeHtml(dashboardUrl)}"`)}</div></div>
  </section>`;
}

function renderMain(): string {
  const stream = state.stream;
  if (!stream) return `<main class="empty-state"><div class="loader"></div><p>Получаем данные Streamer.bot…</p></main>`;
  const stamp = state.lastUpdated ? state.lastUpdated.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
  return `<main class="content"><div class="cards">${renderTwitchCard(stream.twitch)}${renderYouTubeCard(stream.youtube)}</div><div class="bottom-panels">${templatePanel()}${presetPanel()}</div><p class="updated-at">Обновлено: ${escapeHtml(stamp)}</p></main>`;
}

function renderCategoryOption(category: TwitchCategory | YouTubeCategory, kind: Platform, scope: string): string {
  const visual = kind === "twitch" ? categoryImage((category as TwitchCategory).imageUrl) : `<span class="category-image youtube-category-icon">${(category as YouTubeCategory).iconSvg}</span>`;
  return `<button type="button" class="category-option" data-action="choose-category" data-kind="${kind}" data-scope="${scope}" data-id="${escapeHtml(category.id)}">${visual}<span><strong>${escapeHtml(category.name)}</strong><small>ID: ${escapeHtml(category.id)}</small></span></button>`;
}

function renderTagInput(tags: string[], draft: string, scope: string, disabled: boolean): string {
  return `<div class="chip-input ${disabled ? "disabled" : ""}">${tags.map((tag, index) => `<span class="chip">${escapeHtml(tag)}<button type="button" data-action="remove-tag" data-scope="${scope}" data-index="${index}" aria-label="Удалить тег ${escapeHtml(tag)}">×</button></span>`).join("")}<input data-input="tag-draft" data-scope="${scope}" value="${escapeHtml(draft)}" placeholder="Добавить тег"${disabled ? " disabled" : ""} /></div>`;
}

function categoryControl(platform: Platform, selected: TwitchCategory | YouTubeCategory | null, query: string, scope: string, disabled: boolean): string {
  const results = platform === "twitch" ? state.twitchResults : YOUTUBE_CATEGORIES.filter((item) => `${item.name} ${item.id}`.toLocaleLowerCase("ru-RU").includes(query.toLocaleLowerCase("ru-RU"))).slice(0, 20);
  const visible = query.trim().length >= (platform === "twitch" ? 2 : 1);
  const current = selected ? `${selected.name} · ID ${selected.id}` : "";
  const visual = selected ? (platform === "twitch" ? categoryImage((selected as TwitchCategory).imageUrl) : `<span class="category-image youtube-category-icon">${(selected as YouTubeCategory).iconSvg}</span>`) : "";
  return `<div class="autocomplete">${selected && !query ? `<div class="selected-category">${visual}<span>${escapeHtml(current)}</span></div>` : ""}<label>Категория<input data-input="category-query" data-kind="${platform}" data-scope="${scope}" value="${escapeHtml(query)}" placeholder="${escapeHtml(current || "Начните вводить название или ID")}" autocomplete="off"${disabled ? " disabled" : ""} /></label>${visible && !disabled ? `<div class="autocomplete-list">${results.length ? results.map((item) => renderCategoryOption(item, platform, scope)).join("") : '<span class="empty-option">Ничего не найдено</span>'}</div>` : ""}</div>`;
}

function titleCounter(title: string, max: number): string {
  return `<span class="counter ${title.length > max ? "invalid" : ""}">${title.length} / ${max}</span>`;
}

function renderTemplateValue(template: string, subtitle: string): string {
  const marker = "%subtitle%";
  const markerIndex = template.indexOf(marker);
  if (markerIndex < 0) return escapeHtml(template);
  const before = escapeHtml(template.slice(0, markerIndex));
  const after = escapeHtml(template.slice(markerIndex + marker.length));
  const value = subtitle.trim();
  return `${before}<mark class="template-${value ? "value" : "token"}">${escapeHtml(value || marker)}</mark>${after}`;
}

function renderTemplateSource(template: string): string {
  return escapeHtml(template).replaceAll("%subtitle%", '<mark class="template-token">%subtitle%</mark>');
}

function syntaxEditor(label: string, input: "main-twitch-template" | "main-youtube-template", value: string): string {
  return `<label class="syntax-field"><span>${label}</span><span class="syntax-editor"><pre aria-hidden="true">${renderTemplateSource(value)}\n</pre><textarea data-input="${input}" spellcheck="false" rows="2" aria-label="${escapeHtml(label)}">${escapeHtml(value)}</textarea></span></label>`;
}

function templatePanel(): string {
  const draft = state.templateDraft;
  const valid = isTemplateValid(draft.twitchTemplate) && isTemplateValid(draft.youtubeTemplate);
  const twitchTitle = titleFromTemplate(draft.twitchTemplate, draft.subtitle);
  const youtubeTitle = titleFromTemplate(draft.youtubeTemplate, draft.subtitle);
  return `<section class="template-panel" aria-labelledby="templates-title">
    <div class="panel-heading"><h2 id="templates-title">Шаблоны</h2><span class="template-store">Streamer.bot</span></div>
    <div class="template-grid">
      <label class="subtitle-field">Подзаголовок<input data-input="main-subtitle" value="${escapeHtml(draft.subtitle)}" placeholder="Например: Играем соло рейтинг" /></label>
      ${syntaxEditor("Шаблон Twitch", "main-twitch-template", draft.twitchTemplate)}
      ${syntaxEditor("Шаблон YouTube", "main-youtube-template", draft.youtubeTemplate)}
    </div>
    <div class="template-preview-grid"><div class="template-preview"><span>Twitch</span><strong>${renderTemplateValue(draft.twitchTemplate, draft.subtitle)}</strong>${titleCounter(twitchTitle, 140)}</div><div class="template-preview"><span>YouTube</span><strong>${renderTemplateValue(draft.youtubeTemplate, draft.subtitle)}</strong>${titleCounter(youtubeTitle, 100)}</div></div>
    ${valid ? "" : '<p class="form-errors">%subtitle% допускается не более одного раза в каждом шаблоне.</p>'}
    <div class="template-actions">${button("Сбросить", "reset-main-templates", { icon: uiIcon("refresh") })}${button(state.templatesSaving ? "Сохраняем…" : "Сохранить шаблоны", "save-templates", { className: "button primary", icon: uiIcon("braces"), disabled: !valid || state.templatesSaving })}</div>
  </section>`;
}

function presetPanel(): string {
  const actions = state.presetActions;
  return `<section class="preset-panel" aria-labelledby="presets-title"><div class="panel-heading"><h2 id="presets-title">Пресеты</h2><span class="preset-count">${actions.length}</span></div>${actions.length ? `<div class="preset-list">${actions.map((preset) => button(state.runningPresetId === preset.id ? "Запускаем…" : preset.label, "run-preset", { className: "button preset-button", icon: uiIcon("play"), disabled: state.runningPresetId !== null, data: ` data-preset-id="${escapeHtml(preset.id)}" data-preset-name="${escapeHtml(preset.name)}"` })).join("")}</div>` : '<p class="panel-hint">Добавьте Action в группу <code>STREAM INFO</code> и назовите его <code>PRESET | Название игры</code>.</p>'}</section>`;
}

function editModal(): string {
  const form = state.editForm;
  if (!form || !state.stream) return "";
  const max = form.platform === "twitch" ? 140 : 100;
  const template = form.platform === "twitch" ? settings.twitchTemplate : settings.youtubeTemplate;
  const actualTitle = form.titleMode === "subtitle" ? titleFromTemplate(template, form.subtitle) : form.title;
  const displayTitle = form.titleMode === "subtitle" ? renderTemplateValue(template, form.subtitle) : escapeHtml(form.title);
  const validation = validateEdit(form, actualTitle);
  return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
    <div class="modal-header"><div><span class="eyebrow">${form.platform === "twitch" ? "Twitch" : "YouTube"}</span><h2 id="edit-title">Изменить информацию</h2></div>${iconButton("close-modal", "Закрыть", renderIcon("close"))}</div>
    <div class="modal-body">
      <div class="field-group"><div class="mode-toggle"><button type="button" data-action="title-mode" data-mode="subtitle" class="${form.titleMode === "subtitle" ? "active" : ""}">По шаблону</button><button type="button" data-action="title-mode" data-mode="full" class="${form.titleMode === "full" ? "active" : ""}">Полное название</button></div>
        ${form.titleMode === "subtitle" ? `<label>Подзаголовок<input data-input="edit-subtitle" value="${escapeHtml(form.subtitle)}" /></label><div class="title-preview"><span>Итоговое название</span><strong>${displayTitle}</strong>${titleCounter(actualTitle, max)}</div>` : `<label>Название<input data-input="edit-title" value="${escapeHtml(form.title)}" /></label><div class="field-note">${titleCounter(form.title, max)}</div>`}
      </div>
      ${categoryControl(form.platform, form.category, form.categoryQuery, "edit", false)}
      <label>Теги${renderTagInput(form.tags, form.tagDraft, "edit", false)}</label>
      ${validation.length ? `<p class="form-errors">${validation.map(escapeHtml).join("<br />")}</p>` : ""}
    </div>
    <div class="modal-footer">${button("Отмена", "close-modal")}${button("Сохранить", "save-edit", { className: "button primary", disabled: validation.length > 0 || state.loadingPlatforms.has(form.platform) })}</div>
  </section></div>`;
}

function allSection(platform: Platform, form: AllForm, enabled: boolean): string {
  const max = platform === "twitch" ? 140 : 100;
  const template = platform === "twitch" ? settings.twitchTemplate : settings.youtubeTemplate;
  const title = titleFromTemplate(template, form.subtitle);
  const category = platform === "twitch" ? form.twitchCategory : form.youtubeCategory;
  const query = platform === "twitch" ? form.twitchCategoryQuery : form.youtubeCategoryQuery;
  const tags = platform === "twitch" ? form.twitchTags : form.youtubeTags;
  const draft = platform === "twitch" ? form.twitchTagDraft : form.youtubeTagDraft;
  return `<fieldset class="all-platform ${!enabled ? "unavailable" : ""}"${enabled ? "" : " disabled"}><legend>${platform === "twitch" ? "Twitch" : "YouTube"}</legend>${!enabled ? '<p class="youtube-warning">Стрим YouTube должен быть запущен</p>' : ""}<div class="title-preview"><span>Предпросмотр названия ${platform === "twitch" ? "Twitch" : "YouTube"}</span><strong>${renderTemplateValue(template, form.subtitle)}</strong>${titleCounter(title, max)}</div>${categoryControl(platform, category, query, `all-${platform}`, !enabled)}<label>Теги${renderTagInput(tags, draft, `all-${platform}`, !enabled)}</label></fieldset>`;
}

function allModal(): string {
  const form = state.allForm;
  if (!form || !state.stream) return "";
  const errors = validateAll(form);
  return `<div class="modal-backdrop"><section class="modal wide" role="dialog" aria-modal="true" aria-labelledby="all-title">
    <div class="modal-header"><div><span class="eyebrow">Обе платформы</span><h2 id="all-title">Обновить все</h2></div>${iconButton("close-modal", "Закрыть", renderIcon("close"))}</div>
    <div class="modal-body"><label>Подзаголовок<input data-input="all-subtitle" value="${escapeHtml(form.subtitle)}" /></label><div class="all-grid">${allSection("twitch", form, Boolean(state.stream.twitch.connected))}${allSection("youtube", form, Boolean(state.stream.youtube.connected && state.stream.youtube.live && state.stream.youtube.broadcastId))}</div>${errors.length ? `<p class="form-errors">${errors.map(escapeHtml).join("<br />")}</p>` : ""}</div>
    <div class="modal-footer">${button("Отмена", "close-modal")}${button("Применить", "save-all", { className: "button primary", disabled: errors.length > 0 || state.loadingPlatforms.size > 0 })}</div>
  </section></div>`;
}

function settingsModal(): string {
  const draft = state.settingsDraft;
  return `<div class="modal-backdrop"><section class="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <div class="modal-header"><div><span class="eyebrow">Подключение</span><h2 id="settings-title">Настройки</h2></div>${iconButton("close-modal", "Закрыть", renderIcon("close"))}</div>
    <div class="modal-body"><h3>Подключение к Streamer.bot</h3><div class="settings-grid"><label>Host<input data-input="settings-host" value="${escapeHtml(draft.host)}" /></label><label>Port<input data-input="settings-port" type="number" min="1" max="65535" value="${escapeHtml(draft.port)}" /></label></div><label>Endpoint<input data-input="settings-endpoint" value="${escapeHtml(draft.endpoint)}" /></label><label>Password<input data-input="settings-password" type="password" value="${escapeHtml(draft.password)}" autocomplete="current-password" /></label><label class="check-row"><input data-input="settings-remember" type="checkbox"${draft.rememberPassword ? " checked" : ""} />Запомнить пароль</label></div>
    <div class="modal-footer">${button("Сохранить", "save-settings", { className: "button primary" })}</div>
  </section></div>`;
}

function noticesHtml(): string {
  return `<div class="notices">${state.notices.map((notice) => `<aside class="notice"><div><strong>${escapeHtml(notice.title)}</strong>${notice.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>${iconButton("close-notice", "Закрыть уведомление", renderIcon("close"), false, ` data-notice-id="${notice.id}"`)}</aside>`).join("")}</div>`;
}

function focusedField(): { input: string; scope: string; start: number | null; end: number | null } | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement) && !(active instanceof HTMLTextAreaElement)) return null;
  const input = active.dataset.input;
  if (!input) return null;
  return { input, scope: active.dataset.scope ?? "", start: active.selectionStart, end: active.selectionEnd };
}

function render(): void {
  const focus = focusedField();
  const primary = state.actionStatus === "missing" || state.actionStatus === "disabled" || state.actionStatus === "outdated" ? renderImport() : renderMain();
  const modal = state.modal === "settings" ? settingsModal() : state.modal === "all" ? allModal() : state.modal === "twitch" || state.modal === "youtube" ? editModal() : "";
  app.innerHTML = `${renderHeader()}${authPanel()}${primary}${modal}${noticesHtml()}`;
  if (!focus) return;
  const selector = `[data-input="${focus.input}"]${focus.scope ? `[data-scope="${focus.scope}"]` : ":not([data-scope])"}`;
  const next = app.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (!next) return;
  next.focus();
  if (focus.start !== null && focus.end !== null) next.setSelectionRange(focus.start, focus.end);
}

function normalizeStream(data: Record<string, unknown>): StreamState {
  const twitchRaw = isRecord(data.twitch) ? data.twitch : {};
  const youtubeRaw = isRecord(data.youtube) ? data.youtube : {};
  const templates = normalizeTemplates(data.templates);
  const twitch: TwitchState = {
    connected: twitchRaw.connected === true,
    live: twitchRaw.live === true,
    accountName: String(twitchRaw.accountName ?? ""),
    login: String(twitchRaw.login ?? ""),
    broadcasterId: String(twitchRaw.broadcasterId ?? ""),
    title: String(twitchRaw.title ?? ""),
    categoryId: String(twitchRaw.categoryId ?? ""),
    categoryName: String(twitchRaw.categoryName ?? ""),
    categoryImageUrl: String(twitchRaw.categoryImageUrl ?? ""),
    tags: asStringArray(twitchRaw.tags),
  };
  const youtube: YouTubeState = {
    connected: youtubeRaw.connected === true,
    live: youtubeRaw.live === true,
    accountName: String(youtubeRaw.accountName ?? ""),
    channelId: String(youtubeRaw.channelId ?? ""),
    broadcastId: String(youtubeRaw.broadcastId ?? ""),
    status: String(youtubeRaw.status ?? ""),
    title: String(youtubeRaw.title ?? ""),
    categoryId: String(youtubeRaw.categoryId ?? ""),
    categoryName: String(youtubeRaw.categoryName ?? ""),
    tags: asStringArray(youtubeRaw.tags),
  };
  return { apiVersion: Number(data.apiVersion ?? API_VERSION), twitch, youtube, templates };
}

function normalizeTemplates(value: unknown): TemplateState {
  const raw = isRecord(value) ? value : {};
  return {
    twitchTemplate: typeof raw.twitchTemplate === "string" && raw.twitchTemplate ? raw.twitchTemplate : DEFAULT_TWITCH_TEMPLATE,
    youtubeTemplate: typeof raw.youtubeTemplate === "string" && raw.youtubeTemplate ? raw.youtubeTemplate : DEFAULT_YOUTUBE_TEMPLATE,
    subtitle: typeof raw.subtitle === "string" ? raw.subtitle : "",
    configured: raw.configured === true,
  };
}

function syncTemplates(templates: TemplateState): void {
  const hasLocalCustomTemplate = settings.twitchTemplate !== DEFAULT_TWITCH_TEMPLATE || settings.youtubeTemplate !== DEFAULT_YOUTUBE_TEMPLATE || Boolean(settings.lastSubtitle);
  if (!templates.configured && hasLocalCustomTemplate) return;
  settings = { ...settings, twitchTemplate: templates.twitchTemplate, youtubeTemplate: templates.youtubeTemplate, lastSubtitle: templates.subtitle };
  saveSettings();
  if (!state.templatesDirty) state.templateDraft = { twitchTemplate: templates.twitchTemplate, youtubeTemplate: templates.youtubeTemplate, subtitle: templates.subtitle };
}

function handleCodeEvent(payload: unknown): void {
  const root = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
  if (!root || root.eventName !== CODE_EVENT || !isRecord(root.args)) return;
  const response = root.args as unknown as ActionResponse;
  if (typeof response.requestId !== "string") return;
  const pending = requestResolvers.get(response.requestId);
  if (!pending) return;
  window.clearTimeout(pending.timer);
  requestResolvers.delete(response.requestId);
  pending.resolve(response);
}

async function connect(): Promise<void> {
  state.connection = "connecting";
  state.connectionError = null;
  render();
  for (const pending of requestResolvers.values()) {
    clearTimeout(pending.timer);
    pending.reject(new Error("Подключение к Streamer.bot изменилось."));
  }
  requestResolvers = new Map();
  if (client) {
    try { await client.disconnect(); } catch { /* the old socket may already be closed */ }
  }
  const next = new StreamerbotClient({
    host: settings.host,
    port: settings.port,
    endpoint: settings.endpoint || "/",
    password: settings.password || undefined,
    immediate: false,
    autoReconnect: true,
    retries: -1,
    logLevel: "none",
    onConnect: () => { void onConnected(); },
    onDisconnect: () => {
      state.connection = "disconnected";
      state.actionStatus = "unknown";
      state.stream = null;
      render();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Не удалось подключиться к WebSocket Streamer.bot.";
      state.connectionError = message;
      state.connection = "disconnected";
      state.authNeeded = /auth|password|credential/i.test(message) || Boolean(settings.password);
      render();
    },
  });
  client = next;
  await next.on("Custom.CodeEvent", handleCodeEvent);
  try {
    await next.connect();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось подключиться к Streamer.bot.";
    state.connection = "disconnected";
    state.connectionError = message;
    state.authNeeded = /auth|password|credential/i.test(message) || Boolean(settings.password);
    render();
  }
}

async function onConnected(): Promise<void> {
  state.connection = "connected";
  state.connectionError = null;
  state.authNeeded = false;
  render();
  await verifyAction();
}

async function verifyAction(): Promise<void> {
  if (!client?.ready || actionCheckRunning) return;
  actionCheckRunning = true;
  state.actionStatus = "unknown";
  render();
  try {
    const response = await client.getActions();
    const action = response.actions.find((candidate) => candidate.group === ACTION_GROUP && candidate.name === ACTION_NAME) ?? null;
    state.action = action ? { id: action.id, name: action.name, group: action.group, enabled: action.enabled } : null;
    state.presetActions = response.actions
      .filter((candidate) => candidate.enabled && candidate.group === ACTION_GROUP && candidate.name.startsWith("PRESET |"))
      .map((candidate) => ({ id: candidate.id, name: candidate.name, group: candidate.group, enabled: candidate.enabled, label: candidate.name.slice("PRESET |".length).trim() || candidate.name }));
    state.actionStatus = !action ? "missing" : !action.enabled ? "disabled" : "ready";
    if (state.actionStatus === "ready") await refreshState();
  } catch (error) {
    state.connection = "disconnected";
    state.connectionError = error instanceof Error ? error.message : "Не удалось получить список Actions.";
    state.authNeeded = /auth|password|credential/i.test(state.connectionError);
  } finally {
    actionCheckRunning = false;
    render();
  }
}

async function callAction(command: string, payload: Record<string, unknown> = {}): Promise<ActionResponse> {
  if (!client?.ready || !state.action) throw new Error("Action Streamer.bot пока недоступен.");
  const requestId = uuid();
  const reply = new Promise<ActionResponse>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      requestResolvers.delete(requestId);
      reject(new Error("Streamer.bot не прислал ответ за 15 секунд."));
    }, REQUEST_TIMEOUT);
    requestResolvers.set(requestId, { resolve, reject, timer });
  });
  try {
    await client.doAction({ id: state.action.id }, { command, requestId, payloadJson: JSON.stringify(payload) });
  } catch (error) {
    const pending = requestResolvers.get(requestId);
    if (pending) {
      clearTimeout(pending.timer);
      requestResolvers.delete(requestId);
    }
    throw error;
  }
  return reply;
}

async function saveTemplates(): Promise<void> {
  const draft = state.templateDraft;
  if (!isTemplateValid(draft.twitchTemplate) || !isTemplateValid(draft.youtubeTemplate)) return;
  state.templatesSaving = true;
  render();
  try {
    const response = await callAction("saveTemplates", { ...draft });
    if (!response.ok || !response.data) throw new Error(response.error?.message ?? "Streamer.bot не сохранил шаблоны.");
    const templates = normalizeTemplates(response.data.templates);
    syncTemplates({ ...templates, configured: true });
    state.templatesDirty = false;
    notify("Шаблоны сохранены", ["Они сохранены в Streamer.bot и доступны вашим Action-пресетам."]);
  } catch (error) {
    notify("Не удалось сохранить шаблоны", [error instanceof Error ? error.message : "Неизвестная ошибка."]);
  } finally {
    state.templatesSaving = false;
    render();
  }
}

async function persistSubtitle(subtitle: string): Promise<void> {
  const value = subtitle.trim();
  settings = { ...settings, lastSubtitle: value };
  state.templateDraft.subtitle = value;
  saveSettings();
  if (!client?.ready || !state.action) return;
  try {
    const response = await callAction("saveTemplates", { twitchTemplate: settings.twitchTemplate, youtubeTemplate: settings.youtubeTemplate, subtitle: value });
    if (!response.ok) throw new Error(response.error?.message ?? "Streamer.bot не сохранил подзаголовок.");
  } catch (error) {
    notify("Подзаголовок не сохранён в Streamer.bot", [error instanceof Error ? error.message : "Неизвестная ошибка."]);
  }
}

async function runPreset(id: string, name: string): Promise<void> {
  if (!client?.ready) return;
  state.runningPresetId = id;
  render();
  try {
    await client.doAction({ id }, {});
    window.setTimeout(() => { void refreshState(false); }, 700);
    notify("Action-пресет запущен", [name]);
  } catch (error) {
    notify("Не удалось запустить Action-пресет", [error instanceof Error ? error.message : "Неизвестная ошибка."]);
  } finally {
    state.runningPresetId = null;
    render();
  }
}

async function refreshState(showError = true): Promise<void> {
  if (state.actionStatus !== "ready") return;
  try {
    const response = await callAction("getState");
    if (!response.ok || !response.data) throw new Error(response.error?.message ?? "Action не вернул данные.");
    const stream = normalizeStream(response.data);
    if (stream.apiVersion !== API_VERSION || response.apiVersion !== API_VERSION) {
      state.actionStatus = "outdated";
      state.stream = null;
      return;
    }
    syncTemplates(stream.templates);
    state.stream = stream;
    state.lastUpdated = new Date();
  } catch (error) {
    if (showError) notify("Не удалось обновить данные", [error instanceof Error ? error.message : "Неизвестная ошибка."]);
  } finally {
    render();
  }
}

function categoryFromState(platform: Platform): TwitchCategory | YouTubeCategory | null {
  if (platform === "twitch") {
    const item = state.stream?.twitch;
    if (!item?.categoryId && !item?.categoryName) return null;
    return { id: item.categoryId ?? "", name: item.categoryName ?? "", imageUrl: item.categoryImageUrl ?? "" };
  }
  const item = state.stream?.youtube;
  if (!item?.categoryId && !item?.categoryName) return null;
  return YOUTUBE_CATEGORIES.find((category) => category.id === item.categoryId) ?? { id: item.categoryId ?? "", name: item.categoryName ?? "", iconSvg: FALLBACK_CATEGORY_SVG };
}

function openEdit(platform: Platform): void {
  if (!state.stream) return;
  const current = state.stream[platform];
  if (!current.connected || (platform === "youtube" && !current.live)) return;
  state.editForm = {
    platform,
    titleMode: "full",
    subtitle: settings.lastSubtitle,
    title: current.title ?? "",
    category: categoryFromState(platform),
    tags: [...asStringArray(current.tags)],
    tagDraft: "",
    categoryQuery: "",
  };
  state.modal = platform;
  render();
}

function openAll(): void {
  if (!state.stream) return;
  state.allForm = {
    subtitle: settings.lastSubtitle,
    twitchCategory: categoryFromState("twitch") as TwitchCategory | null,
    youtubeCategory: categoryFromState("youtube") as YouTubeCategory | null,
    twitchTags: [...asStringArray(state.stream.twitch.tags)],
    youtubeTags: [...asStringArray(state.stream.youtube.tags)],
    twitchTagDraft: "",
    youtubeTagDraft: "",
    twitchCategoryQuery: "",
    youtubeCategoryQuery: "",
  };
  state.modal = "all";
  render();
}

function clearModal(): void {
  state.modal = null;
  state.editForm = null;
  state.allForm = null;
  state.twitchResults = [];
  state.twitchSearchFor = "";
  render();
}

function tagsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function validateTwitch(title: string, tags: string[]): string[] {
  const errors: string[] = [];
  if (!title.trim()) errors.push("Название Twitch обязательно.");
  if (title.length > 140) errors.push("Название Twitch: максимум 140 символов.");
  if (tags.length > 10) errors.push("Twitch: максимум 10 тегов.");
  if (tags.some((tag) => !tag.trim() || tag.length > 25 || /\s/.test(tag))) errors.push("Теги Twitch: до 25 символов, без пробелов.");
  if (new Set(tags.map((tag) => tag.toLocaleLowerCase("ru-RU"))).size !== tags.length) errors.push("Теги Twitch не должны повторяться.");
  return errors;
}

function validateYouTube(title: string, tags: string[]): string[] {
  const errors: string[] = [];
  if (!title.trim()) errors.push("Название YouTube обязательно.");
  if (title.length > 100) errors.push("Название YouTube: максимум 100 символов.");
  if (/[<>]/.test(title)) errors.push("Название YouTube не может содержать < или >.");
  if (tags.join(",").length > 500) errors.push("Общий размер тегов YouTube: максимум 500 символов.");
  if (tags.some((tag) => !tag.trim())) errors.push("Тег не может быть пустым.");
  if (new Set(tags.map((tag) => tag.toLocaleLowerCase("ru-RU"))).size !== tags.length) errors.push("Теги YouTube не должны повторяться.");
  return errors;
}

function validateEdit(form: EditForm, title: string): string[] {
  return form.platform === "twitch" ? validateTwitch(title, form.tags) : validateYouTube(title, form.tags);
}

function validateAll(form: AllForm): string[] {
  const messages: string[] = [];
  if (state.stream?.twitch.connected) messages.push(...validateTwitch(titleFromTemplate(settings.twitchTemplate, form.subtitle), form.twitchTags));
  if (state.stream?.youtube.connected && state.stream.youtube.live) messages.push(...validateYouTube(titleFromTemplate(settings.youtubeTemplate, form.subtitle), form.youtubeTags));
  return messages;
}

function flashCard(platform: Platform, ok: boolean): void {
  if (ok) {
    state.cardErrors[platform] = false;
    state.cardEffects[platform] = "success";
    window.setTimeout(() => { state.cardEffects[platform] = null; render(); }, 3_000);
  } else {
    state.cardErrors[platform] = true;
    state.cardEffects[platform] = "flash-error";
    window.setTimeout(() => { state.cardEffects[platform] = null; render(); }, 5_000);
  }
}

function fieldsToLines(fields: unknown, platform: Platform): string[] {
  const source = isRecord(fields) ? fields : {};
  const labels: Record<string, string> = { title: "Название", category: "Категория", tags: "Теги" };
  const lines = Object.entries(source).map(([key, value]) => `${labels[key] ?? key}: ${value === true ? "успешно" : "ошибка"}`);
  return lines.length ? lines : [platform === "twitch" ? "Изменения Twitch не применены." : "Изменения YouTube не применены."];
}

async function updatePlatform(platform: Platform, payload: Record<string, unknown>): Promise<boolean> {
  if (!Object.keys(payload).length) return true;
  state.loadingPlatforms.add(platform);
  render();
  try {
    const response = await callAction(platform === "twitch" ? "updateTwitch" : "updateYouTube", payload);
    const ok = response.ok;
    flashCard(platform, ok);
    if (!ok) notify(`Не удалось изменить ${platform === "twitch" ? "Twitch" : "YouTube"}`, fieldsToLines(response.data?.fields, platform));
    await refreshState(false);
    return ok;
  } catch (error) {
    flashCard(platform, false);
    notify(`Не удалось изменить ${platform === "twitch" ? "Twitch" : "YouTube"}`, [error instanceof Error ? error.message : "Неизвестная ошибка."]);
    await refreshState(false);
    return false;
  } finally {
    state.loadingPlatforms.delete(platform);
    render();
  }
}

async function saveEdit(): Promise<void> {
  const form = state.editForm;
  const stream = state.stream;
  if (!form || !stream) return;
  const current = stream[form.platform];
  const template = form.platform === "twitch" ? settings.twitchTemplate : settings.youtubeTemplate;
  const title = form.titleMode === "subtitle" ? titleFromTemplate(template, form.subtitle) : form.title.trim();
  const errors = validateEdit(form, title);
  if (errors.length) { render(); return; }
  const payload: Record<string, unknown> = {};
  if (title !== (current.title ?? "")) payload.title = title;
  if (form.platform === "twitch") {
    const category = form.category as TwitchCategory | null;
    if (category && category.id !== current.categoryId) payload.categoryId = category.id;
  } else {
    const category = form.category as YouTubeCategory | null;
    if (category && category.name !== current.categoryName) payload.categoryName = category.name;
  }
  if (!tagsEqual(form.tags, asStringArray(current.tags))) payload.tags = form.tags;
  if (!Object.keys(payload).length) { notify("Нет изменений", ["Значения уже совпадают с текущими."]); return; }
  if (form.titleMode === "subtitle") {
    await persistSubtitle(form.subtitle);
  }
  const success = await updatePlatform(form.platform, payload);
  if (success) clearModal();
}

async function saveAll(): Promise<void> {
  const form = state.allForm;
  const stream = state.stream;
  if (!form || !stream) return;
  const errors = validateAll(form);
  if (errors.length) { render(); return; }
  await persistSubtitle(form.subtitle);
  const twitchPayload: Record<string, unknown> = {};
  const twitchTitle = titleFromTemplate(settings.twitchTemplate, form.subtitle);
  if (stream.twitch.connected) {
    if (twitchTitle !== stream.twitch.title) twitchPayload.title = twitchTitle;
    if (form.twitchCategory && form.twitchCategory.id !== stream.twitch.categoryId) twitchPayload.categoryId = form.twitchCategory.id;
    if (!tagsEqual(form.twitchTags, asStringArray(stream.twitch.tags))) twitchPayload.tags = form.twitchTags;
  }
  const youtubePayload: Record<string, unknown> = {};
  const youtubeAvailable = Boolean(stream.youtube.connected && stream.youtube.live && stream.youtube.broadcastId);
  if (youtubeAvailable) {
    const youtubeTitle = titleFromTemplate(settings.youtubeTemplate, form.subtitle);
    if (youtubeTitle !== stream.youtube.title) youtubePayload.title = youtubeTitle;
    if (form.youtubeCategory && form.youtubeCategory.name !== stream.youtube.categoryName) youtubePayload.categoryName = form.youtubeCategory.name;
    if (!tagsEqual(form.youtubeTags, asStringArray(stream.youtube.tags))) youtubePayload.tags = form.youtubeTags;
  }
  const jobs: Promise<boolean>[] = [];
  if (Object.keys(twitchPayload).length) jobs.push(updatePlatform("twitch", twitchPayload));
  if (youtubeAvailable && Object.keys(youtubePayload).length) jobs.push(updatePlatform("youtube", youtubePayload));
  if (!youtubeAvailable) notify("YouTube: Пропущено", ["Стрим YouTube должен быть запущен."]);
  if (!jobs.length) { if (youtubeAvailable) notify("Нет изменений", ["Значения уже совпадают с текущими."]); return; }
  const results = await Promise.all(jobs);
  if (results.every(Boolean)) clearModal();
}

function addTag(scope: string): void {
  const holder = getTagHolder(scope);
  if (!holder) return;
  const value = holder.draft.trim();
  if (!value) return;
  if (!holder.tags.some((tag) => tag.localeCompare(value, "ru", { sensitivity: "accent" }) === 0)) holder.tags.push(value);
  holder.setDraft("");
  render();
}

function getTagHolder(scope: string): { tags: string[]; draft: string; setDraft: (value: string) => void } | null {
  if (scope === "edit" && state.editForm) return { tags: state.editForm.tags, draft: state.editForm.tagDraft, setDraft: (value) => { if (state.editForm) state.editForm.tagDraft = value; } };
  if (scope === "all-twitch" && state.allForm) return { tags: state.allForm.twitchTags, draft: state.allForm.twitchTagDraft, setDraft: (value) => { if (state.allForm) state.allForm.twitchTagDraft = value; } };
  if (scope === "all-youtube" && state.allForm) return { tags: state.allForm.youtubeTags, draft: state.allForm.youtubeTagDraft, setDraft: (value) => { if (state.allForm) state.allForm.youtubeTagDraft = value; } };
  return null;
}

function chooseCategory(kind: Platform, scope: string, id: string): void {
  const category = kind === "twitch" ? state.twitchResults.find((item) => item.id === id) : YOUTUBE_CATEGORIES.find((item) => item.id === id);
  if (!category) return;
  if (scope === "edit" && state.editForm) { state.editForm.category = category; state.editForm.categoryQuery = ""; }
  if (scope === "all-twitch" && state.allForm && kind === "twitch") { state.allForm.twitchCategory = category as TwitchCategory; state.allForm.twitchCategoryQuery = ""; }
  if (scope === "all-youtube" && state.allForm && kind === "youtube") { state.allForm.youtubeCategory = category as YouTubeCategory; state.allForm.youtubeCategoryQuery = ""; }
  state.twitchResults = [];
  render();
}

function scheduleTwitchSearch(query: string): void {
  if (searchTimer) window.clearTimeout(searchTimer);
  state.twitchResults = [];
  if (query.trim().length < 2) { render(); return; }
  const requested = query.trim();
  state.twitchSearchFor = requested;
  searchTimer = window.setTimeout(async () => {
    try {
      const response = await callAction("searchTwitchCategories", { query: requested });
      const result = isRecord(response.data) && Array.isArray(response.data.results) ? response.data.results : [];
      if (state.twitchSearchFor !== requested) return;
      state.twitchResults = result.filter(isRecord).map((item) => ({ id: String(item.id ?? ""), name: String(item.name ?? ""), imageUrl: String(item.imageUrl ?? "") })).filter((item) => item.id && item.name);
    } catch (error) {
      if (state.twitchSearchFor === requested) notify("Не удалось найти категорию Twitch", [error instanceof Error ? error.message : "Неизвестная ошибка."]);
    }
    render();
  }, 300);
  render();
}

function openExternal(url: string): void {
  if (!url) return;
  const tab = window.open(url, "_blank", "noopener,noreferrer");
  if (tab) tab.opener = null;
}

function updateInput(target: HTMLInputElement | HTMLTextAreaElement): void {
  const input = target.dataset.input;
  const scope = target.dataset.scope ?? "";
  if (!input) return;
  switch (input) {
    case "auth-password": settings.password = target.value; break;
    case "settings-host": state.settingsDraft.host = target.value.trim(); break;
    case "settings-port": state.settingsDraft.port = Number(target.value); break;
    case "settings-endpoint": state.settingsDraft.endpoint = target.value.trim() || "/"; break;
    case "settings-password": state.settingsDraft.password = target.value; break;
    case "settings-remember": if (target instanceof HTMLInputElement) state.settingsDraft.rememberPassword = target.checked; break;
    case "main-twitch-template": state.templateDraft.twitchTemplate = target.value; state.templatesDirty = true; break;
    case "main-youtube-template": state.templateDraft.youtubeTemplate = target.value; state.templatesDirty = true; break;
    case "main-subtitle": state.templateDraft.subtitle = target.value; state.templatesDirty = true; break;
    case "edit-subtitle": if (state.editForm) state.editForm.subtitle = target.value; break;
    case "edit-title": if (state.editForm) state.editForm.title = target.value; break;
    case "all-subtitle": if (state.allForm) state.allForm.subtitle = target.value; break;
    case "tag-draft": { const holder = getTagHolder(scope); if (holder) holder.setDraft(target.value); break; }
    case "category-query": {
      const kind = target.dataset.kind as Platform;
      if (scope === "edit" && state.editForm) state.editForm.categoryQuery = target.value;
      if (scope === "all-twitch" && state.allForm) state.allForm.twitchCategoryQuery = target.value;
      if (scope === "all-youtube" && state.allForm) state.allForm.youtubeCategoryQuery = target.value;
      if (kind === "twitch") scheduleTwitchSearch(target.value); else render();
      return;
    }
    default: return;
  }
  render();
}

async function copyImport(): Promise<void> {
  try {
    await navigator.clipboard.writeText(STREAMERBOT_IMPORT);
  } catch {
    const area = document.createElement("textarea");
    area.value = STREAMERBOT_IMPORT;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  state.importCopied = true;
  render();
}

app.addEventListener("input", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) updateInput(target);
});

app.addEventListener("change", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) updateInput(target);
});

app.addEventListener("keydown", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.dataset.input !== "tag-draft") return;
  const scope = target.dataset.scope ?? "";
  if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addTag(scope); }
  if (event.key === "Backspace" && !target.value) {
    const holder = getTagHolder(scope);
    if (holder?.tags.length) { holder.tags.pop(); render(); }
  }
});

app.addEventListener("click", (event) => {
  if (event.target instanceof HTMLElement && event.target.classList.contains("modal-backdrop")) { clearModal(); return; }
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (target.hasAttribute("disabled")) return;
  switch (action) {
    case "refresh-state": void refreshState(); break;
    case "open-settings": state.settingsDraft = { ...settings }; state.modal = "settings"; render(); break;
    case "connect-password": void connect(); break;
    case "copy-import": void copyImport(); break;
    case "toggle-import": state.showImport = !state.showImport; render(); break;
    case "check-action": void verifyAction(); break;
    case "edit-twitch": openEdit("twitch"); break;
    case "edit-youtube": openEdit("youtube"); break;
    case "open-all": openAll(); break;
    case "open-link": openExternal(target.dataset.url ?? ""); break;
    case "close-modal": clearModal(); break;
    case "title-mode": if (state.editForm) { state.editForm.titleMode = target.dataset.mode === "subtitle" ? "subtitle" : "full"; render(); } break;
    case "remove-tag": { const holder = getTagHolder(target.dataset.scope ?? ""); const index = Number(target.dataset.index); if (holder && Number.isInteger(index)) { holder.tags.splice(index, 1); render(); } break; }
    case "choose-category": chooseCategory(target.dataset.kind as Platform, target.dataset.scope ?? "", target.dataset.id ?? ""); break;
    case "save-edit": void saveEdit(); break;
    case "save-all": void saveAll(); break;
    case "save-templates": void saveTemplates(); break;
    case "reset-main-templates": state.templateDraft = { twitchTemplate: DEFAULT_TWITCH_TEMPLATE, youtubeTemplate: DEFAULT_YOUTUBE_TEMPLATE, subtitle: state.templateDraft.subtitle }; state.templatesDirty = true; render(); break;
    case "run-preset": void runPreset(target.dataset.presetId ?? "", target.dataset.presetName ?? "Action-пресет"); break;
    case "save-settings": {
      settings = { ...state.settingsDraft, endpoint: state.settingsDraft.endpoint || "/", port: Math.max(1, Math.min(65535, Number(state.settingsDraft.port) || 8080)) };
      saveSettings(); clearModal(); void connect(); break;
    }
    case "close-notice": closeNotice(target.dataset.noticeId ?? ""); break;
    default: break;
  }
});

app.addEventListener("error", (event) => {
  const image = event.target;
  if (image instanceof HTMLImageElement && image.dataset.fallback === "category") image.parentElement?.classList.add("failed");
}, true);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void refreshState(false);
});

function startPolling(): void {
  if (pollingId !== null) window.clearInterval(pollingId);
  pollingId = window.setInterval(() => {
    if (document.visibilityState === "visible") void refreshState(false);
  }, 30_000);
}

render();
startPolling();
void connect();
