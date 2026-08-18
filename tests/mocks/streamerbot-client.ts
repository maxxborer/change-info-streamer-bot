type CodeEventHandler = (payload: unknown) => void;

interface ActionShape {
  id: string;
  name: string;
  group: string;
  enabled: boolean;
}

const apiAction: ActionShape = { id: "api-action", name: "STREAM INFO | API", group: "STREAM INFO", enabled: true };
const presetAction: ActionShape = { id: "preset-pubg", name: "PRESET | PUBG", group: "STREAM INFO", enabled: true };

function defaultState() {
  return {
    apiVersion: 2,
    twitch: { connected: true, live: true, accountName: "Twitch account", login: "tester", title: "Twitch title", categoryId: "493057", categoryName: "PUBG: BATTLEGROUNDS", categoryImageUrl: "", tags: ["PUBG"] },
    youtube: { connected: true, live: true, accountName: "YouTube account", broadcastId: "video-1", status: "live", title: "YouTube title", categoryId: "20", categoryName: "Видеоигры", tags: ["PUBG"] },
    templates: { twitchTemplate: "🔴 %subtitle%| !tg", youtubeTemplate: "🔴 [PUBG] %subtitle%| !yt", subtitle: "Старт", configured: true },
  };
}

interface MockStreamerbot {
  actions: ActionShape[];
  state: ReturnType<typeof defaultState>;
  actionCalls: Array<{ id: string; args: Record<string, unknown> }>;
  connectCalls: number;
  failConnect: boolean;
  reset(): void;
}

const mockKey = "__changeInfoStreamerbotMock__";
const globalMocks = globalThis as typeof globalThis & { [mockKey]?: MockStreamerbot };

export const mockStreamerbot: MockStreamerbot = globalMocks[mockKey] ?? (globalMocks[mockKey] = {
  actions: [apiAction, presetAction] as ActionShape[],
  state: defaultState(),
  actionCalls: [] as Array<{ id: string; args: Record<string, unknown> }>,
  connectCalls: 0,
  failConnect: false,
  reset(): void {
    this.actions = [apiAction, presetAction];
    this.state = defaultState();
    this.actionCalls = [];
    this.connectCalls = 0;
    this.failConnect = false;
  },
});

export class StreamerbotClient {
  ready = true;
  private readonly handlers = new Map<string, CodeEventHandler>();
  private readonly options: { onConnect?: () => void; onError?: (error: unknown) => void };

  constructor(options: { onConnect?: () => void; onError?: (error: unknown) => void }) {
    this.options = options;
  }

  async on(event: string, handler: CodeEventHandler): Promise<void> {
    this.handlers.set(event, handler);
  }

  async connect(): Promise<void> {
    mockStreamerbot.connectCalls += 1;
    queueMicrotask(() => {
      if (mockStreamerbot.failConnect) this.options.onError?.(new Error("WebSocket password required"));
      else this.options.onConnect?.();
    });
  }

  async disconnect(): Promise<void> {}

  async getActions(): Promise<{ actions: ActionShape[] }> {
    return { actions: mockStreamerbot.actions };
  }

  async doAction(action: { id: string }, args: Record<string, unknown> = {}): Promise<void> {
    mockStreamerbot.actionCalls.push({ id: action.id, args });
    if (action.id !== apiAction.id) return;
    const command = String(args.command ?? "");
    const payload = typeof args.payloadJson === "string" ? JSON.parse(args.payloadJson) as Record<string, unknown> : {};
    let data: Record<string, unknown> = {};
    if (command === "getState") data = mockStreamerbot.state;
    if (command === "searchTwitchCategories") data = { results: [{ id: "493057", name: "PUBG: BATTLEGROUNDS", imageUrl: "" }] };
    if (command === "updateTwitch" || command === "updateYouTube") data = { fields: { title: true, category: true, tags: true } };
    if (command === "saveTemplates") {
      mockStreamerbot.state.templates = { twitchTemplate: String(payload.twitchTemplate ?? ""), youtubeTemplate: String(payload.youtubeTemplate ?? ""), subtitle: String(payload.subtitle ?? ""), configured: true };
      data = { templates: mockStreamerbot.state.templates };
    }
    const response = { apiVersion: 2, requestId: String(args.requestId ?? ""), command, ok: true, data, error: null };
    queueMicrotask(() => this.handlers.get("Custom.CodeEvent")?.({ data: { eventName: "stream_info_api_response", args: response } }));
  }
}
