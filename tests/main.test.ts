import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockStreamerbot } from "./mocks/streamerbot-client";

vi.mock("@streamerbot/client", async () => import("./mocks/streamerbot-client"));

const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  await Promise.resolve();
};

function action(name: string, index = 0): HTMLButtonElement {
  const button = document.querySelectorAll<HTMLButtonElement>(`[data-action="${name}"]`)[index];
  if (!button) throw new Error(`Action ${name} is not rendered.`);
  return button;
}

function click(name: string, index = 0): void {
  action(name, index).click();
}

function setValue(selector: string, value: string): HTMLInputElement | HTMLTextAreaElement {
  const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (!field) throw new Error(`Field ${selector} is not rendered.`);
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  return field;
}

async function boot(): Promise<void> {
  await import("../src/main");
  await flush();
  await flush();
}

function commands(): string[] {
  return mockStreamerbot.actionCalls.map((call) => String(call.args.command ?? ""));
}

describe("Stream Info HTML actions", () => {
  const open = vi.fn(() => null);
  const writeText = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.resetModules();
    mockStreamerbot.reset();
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    vi.stubGlobal("open", open);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    open.mockClear();
    writeText.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens every normal editor action and keeps a modal open when an input is clicked", async () => {
    await boot();
    click("edit-twitch");
    expect(document.querySelector(".modal")).not.toBeNull();
    click("title-mode");
    const subtitle = document.querySelector<HTMLInputElement>('[data-input="edit-subtitle"]');
    expect(subtitle).not.toBeNull();
    subtitle?.click();
    expect(document.querySelector(".modal")).not.toBeNull();
    setValue('[data-input="edit-subtitle"]', "Новый подзаголовок");
    expect(document.querySelector('[data-input="edit-subtitle"]')).not.toBeNull();
    click("close-modal");
    expect(document.querySelector(".modal")).toBeNull();

    click("edit-youtube");
    expect(document.querySelector(".modal")).not.toBeNull();
    click("close-modal");
    click("open-all");
    expect(document.querySelector(".modal.wide")).not.toBeNull();
    click("close-modal");
  });

  it("runs refresh, links, preset, template and settings actions without real platform changes", async () => {
    await boot();
    const beforeRefresh = commands().filter((command) => command === "getState").length;
    click("refresh-state");
    await flush();
    expect(commands().filter((command) => command === "getState").length).toBeGreaterThan(beforeRefresh);

    click("open-link", 0);
    expect(open).toHaveBeenCalledWith("https://www.twitch.tv/tester", "_blank", "noopener,noreferrer");

    click("run-preset");
    await flush();
    expect(mockStreamerbot.actionCalls.some((call) => call.id === "preset-pubg")).toBe(true);

    setValue('[data-input="main-twitch-template"]', "🔴 %subtitle% | test");
    click("save-templates");
    await flush();
    expect(commands()).toContain("saveTemplates");
    expect(document.querySelector(".template-value, .template-token")).not.toBeNull();

    setValue('[data-input="main-twitch-template"]', "Переопределённый %subtitle%");
    click("reset-main-templates");
    expect((document.querySelector('[data-input="main-twitch-template"]') as HTMLTextAreaElement).value).toContain("!tg");

    click("open-settings");
    setValue('[data-input="settings-host"]', "localhost");
    click("save-settings");
    await flush();
    expect(mockStreamerbot.connectCalls).toBeGreaterThan(1);
  });

  it("adds/removes chips, selects a local YouTube category and saves individual changes through mocks", async () => {
    await boot();
    click("edit-twitch");
    setValue('[data-input="tag-draft"]', "Rust");
    const tagDraft = document.querySelector<HTMLInputElement>('[data-input="tag-draft"]');
    tagDraft?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(document.querySelectorAll('[data-action="remove-tag"]')).toHaveLength(2);
    click("remove-tag", 1);
    expect(document.querySelectorAll('[data-action="remove-tag"]')).toHaveLength(1);
    setValue('[data-input="edit-title"]', "Новое Twitch название");
    click("save-edit");
    await flush();
    expect(commands()).toContain("updateTwitch");

    click("edit-youtube");
    setValue('[data-input="category-query"]', "В");
    expect(document.querySelector('[data-action="choose-category"]')).not.toBeNull();
    click("choose-category");
    expect(document.querySelector('[data-action="choose-category"]')).toBeNull();
  });

  it("saves the combined form through mock Action replies and leaves no real side effects", async () => {
    await boot();
    click("open-all");
    setValue('[data-input="all-subtitle"]', "Рейтинг");
    click("save-all");
    await flush();
    await flush();
    expect(commands()).toContain("saveTemplates");
    expect(commands()).toContain("updateTwitch");
    expect(commands()).toContain("updateYouTube");
  });

  it("opens the known YouTube broadcast in Studio before falling back to channel settings", async () => {
    await boot();
    const links = document.querySelectorAll<HTMLButtonElement>('[data-action="open-link"]');
    links[3]?.click();
    expect(open).toHaveBeenCalledWith("https://studio.youtube.com/video/video-1/livestreaming", "_blank", "noopener,noreferrer");
  });

  it("closes notices and verifies import-screen copy/toggle/check actions", async () => {
    mockStreamerbot.actions = [];
    await boot();
    click("toggle-import");
    expect(document.querySelector(".import-code")).not.toBeNull();
    click("copy-import");
    await flush();
    expect(writeText).toHaveBeenCalledTimes(1);
    click("check-action");
    await flush();
    expect(document.querySelector('[data-action="check-action"]')).not.toBeNull();

    mockStreamerbot.actions = [{ id: "api-action", name: "STREAM INFO | API", group: "STREAM INFO", enabled: true }];
    click("check-action");
    await flush();
    setValue('[data-input="main-twitch-template"]', "Тест %subtitle%");
    click("save-templates");
    await flush();
    expect(document.querySelector(".notice")).not.toBeNull();
    click("close-notice");
    expect(document.querySelector(".notice")).toBeNull();
  });

  it("renders password reconnect and a usable YouTube dashboard when no broadcast is live", async () => {
    mockStreamerbot.failConnect = true;
    await boot();
    setValue('[data-input="auth-password"]', "secret");
    click("connect-password");
    await flush();
    expect(mockStreamerbot.connectCalls).toBeGreaterThan(1);

    vi.resetModules();
    mockStreamerbot.reset();
    mockStreamerbot.state.youtube.live = false;
    mockStreamerbot.state.youtube.status = "offline";
    mockStreamerbot.state.youtube.broadcastId = "";
    document.body.innerHTML = '<div id="app"></div>';
    await boot();
    const youtubeCard = document.querySelector<HTMLElement>('[data-platform="youtube"]');
    expect(youtubeCard?.classList.contains("compact-unavailable")).toBe(true);
    expect(youtubeCard?.querySelector(".card-body")).toBeNull();
    expect(youtubeCard?.querySelector(".youtube-warning")).not.toBeNull();
    const links = document.querySelectorAll<HTMLButtonElement>('[data-action="open-link"]');
    expect(links[3]?.disabled).toBe(false);
    links[3]?.click();
    expect(open).toHaveBeenCalledWith("https://studio.youtube.com/channel/UC-test-channel/livestreaming/dashboard", "_blank", "noopener,noreferrer");
  });
});
