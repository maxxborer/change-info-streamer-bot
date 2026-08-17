using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

public class CPHInline
{
    private const int ApiVersion = 1;
    private const string ReplyEvent = "stream_info_api_response";

    public bool Execute()
    {
        string command = null;
        string requestId = null;

        try
        {
            CPH.TryGetArg("command", out command);
            CPH.TryGetArg("requestId", out requestId);
            CPH.TryGetArg("payloadJson", out string payloadJson);

            if (string.IsNullOrWhiteSpace(command))
                throw new InvalidOperationException("Команда не указана.");
            if (string.IsNullOrWhiteSpace(requestId))
                throw new InvalidOperationException("requestId не указан.");

            JObject payload = string.IsNullOrWhiteSpace(payloadJson) ? new JObject() : JObject.Parse(payloadJson);
            JObject data;

            switch (command)
            {
                case "getState":
                    data = GetState();
                    break;
                case "searchTwitchCategories":
                    data = SearchTwitchCategories(payload.Value<string>("query"));
                    break;
                case "updateTwitch":
                    data = UpdateTwitch(payload);
                    break;
                case "updateYouTube":
                    data = UpdateYouTube(payload);
                    break;
                default:
                    throw new InvalidOperationException("Неизвестная команда: " + command);
            }

            bool ok = data["ok"] == null || data.Value<bool>("ok");
            Reply(requestId, command, ok, data, ok ? null : "Не все поля удалось изменить.");
        }
        catch (Exception ex)
        {
            CPH.LogError("[STREAM INFO | API] " + ex.Message);
            if (!string.IsNullOrWhiteSpace(requestId))
                Reply(requestId, command ?? "unknown", false, null, ex.Message);
        }

        // C# responses are delivered out-of-band through the code event.
        return true;
    }

    private JObject GetState()
    {
        return new JObject
        {
            ["apiVersion"] = ApiVersion,
            ["twitch"] = GetTwitchState(),
            ["youtube"] = GetYouTubeState()
        };
    }

    private JObject GetTwitchState()
    {
        // As with YouTube, an unauthenticated fresh installation can throw
        // instead of returning a null broadcaster.
        try
        {
            var broadcaster = CPH.TwitchGetBroadcaster();
            if (broadcaster == null || string.IsNullOrWhiteSpace(broadcaster.UserId))
            {
                return new JObject
                {
                    ["connected"] = false,
                    ["live"] = false
                };
            }

            JObject channel = TwitchGet("channels?broadcaster_id=" + Uri.EscapeDataString(broadcaster.UserId));
            JObject channelInfo = FirstData(channel);
            if (channelInfo == null)
                throw new InvalidOperationException("Twitch не вернул сведения о канале.");

            string categoryId = channelInfo.Value<string>("game_id") ?? "";
            string categoryName = channelInfo.Value<string>("game_name") ?? "";
            string imageUrl = GetTwitchCategoryImage(categoryId);
            JObject stream = TwitchGet("streams?user_id=" + Uri.EscapeDataString(broadcaster.UserId));

            return new JObject
            {
                ["connected"] = true,
                ["accountName"] = broadcaster.UserName ?? broadcaster.UserLogin,
                ["login"] = broadcaster.UserLogin ?? "",
                ["broadcasterId"] = broadcaster.UserId,
                ["live"] = FirstData(stream) != null,
                ["title"] = channelInfo.Value<string>("title") ?? "",
                ["categoryId"] = categoryId,
                ["categoryName"] = categoryName,
                ["categoryImageUrl"] = imageUrl,
                ["tags"] = channelInfo["tags"] as JArray ?? new JArray()
            };
        }
        catch (Exception ex)
        {
            CPH.LogVerbose("[STREAM INFO | API] Twitch unavailable: " + ex.Message);
            return new JObject { ["connected"] = false, ["live"] = false };
        }
    }

    private JObject GetYouTubeState()
    {
        // Streamer.bot 1.0.x can throw before returning null when YouTube has
        // never been authenticated. A missing platform must remain a normal
        // state for the UI, not fail the combined getState response.
        try
        {
            var broadcaster = CPH.YouTubeGetBroadcaster();
            var broadcast = CPH.YouTubeGetLatestMonitoredBroadcast();
            bool live = broadcast != null && string.Equals(broadcast.Status, "live", StringComparison.OrdinalIgnoreCase);

            if (broadcast == null)
            {
                return new JObject
                {
                    ["connected"] = broadcaster != null,
                    ["live"] = false,
                    ["accountName"] = broadcaster == null ? "" : broadcaster.UserName ?? ""
                };
            }

            return new JObject
            {
                ["connected"] = broadcaster != null,
                ["accountName"] = broadcaster == null ? "" : broadcaster.UserName ?? "",
                ["live"] = live,
                ["broadcastId"] = broadcast.Id ?? "",
                ["status"] = broadcast.Status ?? "",
                ["title"] = broadcast.Title ?? "",
                ["categoryId"] = broadcast.CategoryId ?? "",
                ["categoryName"] = broadcast.CategoryName ?? "",
                ["tags"] = new JArray((broadcast.Tags ?? new List<string>()).ToArray())
            };
        }
        catch (Exception ex)
        {
            CPH.LogVerbose("[STREAM INFO | API] YouTube unavailable: " + ex.Message);
            return new JObject { ["connected"] = false, ["live"] = false };
        }
    }

    private JObject SearchTwitchCategories(string query)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 2)
            return new JObject { ["ok"] = true, ["results"] = new JArray() };

        JObject response = TwitchGet("search/categories?first=20&query=" + Uri.EscapeDataString(query.Trim()));
        JArray results = new JArray();
        foreach (JToken item in (response["data"] as JArray ?? new JArray()))
        {
            string imageUrl = item.Value<string>("box_art_url") ?? "";
            results.Add(new JObject
            {
                ["id"] = item.Value<string>("id") ?? "",
                ["name"] = item.Value<string>("name") ?? "",
                ["imageUrl"] = NormalizeBoxArt(imageUrl)
            });
        }

        return new JObject { ["ok"] = true, ["results"] = results };
    }

    private JObject UpdateTwitch(JObject payload)
    {
        var broadcaster = CPH.TwitchGetBroadcaster();
        if (broadcaster == null || string.IsNullOrWhiteSpace(broadcaster.UserId))
            throw new InvalidOperationException("Twitch broadcaster не подключён в Streamer.bot.");

        JObject fields = new JObject();
        bool allOk = true;

        if (payload["title"] != null)
        {
            string title = payload.Value<string>("title");
            Ensure(!string.IsNullOrWhiteSpace(title) && title.Length <= 140, "Название Twitch должно содержать от 1 до 140 символов.");
            bool result = CPH.SetChannelTitle(title);
            fields["title"] = result;
            allOk &= result;
        }

        if (payload["categoryId"] != null)
        {
            string categoryId = payload.Value<string>("categoryId");
            Ensure(!string.IsNullOrWhiteSpace(categoryId), "Не выбрана категория Twitch.");
            bool result = CPH.SetChannelGameById(categoryId);
            fields["category"] = result;
            allOk &= result;
        }

        if (payload["tags"] != null)
        {
            List<string> tags = ReadTags(payload["tags"]);
            Ensure(tags.Count <= 10 && tags.All(t => t.Length <= 25 && !t.Any(char.IsWhiteSpace)), "Теги Twitch: максимум 10, до 25 символов, без пробелов.");
            bool result = CPH.TwitchSetChannelTags(tags);
            fields["tags"] = result;
            allOk &= result;
        }

        Ensure(fields.HasValues, "Нет изменений Twitch для сохранения.");
        return new JObject { ["ok"] = allOk, ["fields"] = fields };
    }

    private JObject UpdateYouTube(JObject payload)
    {
        var broadcast = CPH.YouTubeGetLatestMonitoredBroadcast();
        if (broadcast == null || !string.Equals(broadcast.Status, "live", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Стрим YouTube должен быть запущен.");

        JObject fields = new JObject();
        bool allOk = true;

        if (payload["title"] != null)
        {
            string title = payload.Value<string>("title");
            Ensure(!string.IsNullOrWhiteSpace(title) && title.Length <= 100 && !title.Contains("<") && !title.Contains(">"), "Название YouTube должно содержать до 100 символов и не включать < или >.");
            bool result = CPH.YouTubeSetTitle(title, broadcast.Id);
            fields["title"] = result;
            allOk &= result;
        }

        if (payload["categoryName"] != null)
        {
            string categoryName = payload.Value<string>("categoryName");
            Ensure(!string.IsNullOrWhiteSpace(categoryName), "Не выбрана категория YouTube.");
            bool result = CPH.YouTubeSetCategory(categoryName, broadcast.Id);
            fields["category"] = result;
            allOk &= result;
        }

        if (payload["tags"] != null)
        {
            List<string> tags = ReadTags(payload["tags"]);
            Ensure(string.Join(",", tags).Length <= 500, "Общий размер тегов YouTube не может превышать 500 символов.");
            bool cleared = CPH.YouTubeClearTags(broadcast.Id);
            bool added = cleared && (tags.Count == 0 || CPH.YouTubeAddTags(tags, broadcast.Id));
            bool result = cleared && added;
            fields["tags"] = result;
            allOk &= result;
        }

        Ensure(fields.HasValues, "Нет изменений YouTube для сохранения.");
        return new JObject { ["ok"] = allOk, ["fields"] = fields };
    }

    private JObject TwitchGet(string path)
    {
        string token = CPH.TwitchOAuthToken;
        string clientId = CPH.TwitchClientId;
        if (string.IsNullOrWhiteSpace(token) || string.IsNullOrWhiteSpace(clientId))
            throw new InvalidOperationException("Twitch OAuth не подключён в Streamer.bot.");

        using (var client = new HttpClient { Timeout = TimeSpan.FromSeconds(10) })
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            client.DefaultRequestHeaders.Add("Client-Id", clientId);
            HttpResponseMessage response = client.GetAsync("https://api.twitch.tv/helix/" + path).GetAwaiter().GetResult();
            string content = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException("Twitch Helix: " + (int)response.StatusCode + " " + content);
            return JObject.Parse(content);
        }
    }

    private string GetTwitchCategoryImage(string categoryId)
    {
        if (string.IsNullOrWhiteSpace(categoryId))
            return "";

        JObject game = FirstData(TwitchGet("games?id=" + Uri.EscapeDataString(categoryId)));
        return game == null ? "" : NormalizeBoxArt(game.Value<string>("box_art_url") ?? "");
    }

    private static JObject FirstData(JObject response)
    {
        return (response["data"] as JArray)?.OfType<JObject>().FirstOrDefault();
    }

    private static string NormalizeBoxArt(string url)
    {
        return url.Replace("{width}", "188").Replace("{height}", "250");
    }

    private static List<string> ReadTags(JToken token)
    {
        var tags = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (string raw in token.Values<string>())
        {
            string tag = (raw ?? "").Trim();
            if (tag.Length == 0)
                throw new InvalidOperationException("Тег не может быть пустым.");
            if (!seen.Add(tag))
                throw new InvalidOperationException("Теги не должны повторяться.");
            tags.Add(tag);
        }
        return tags;
    }

    private void Reply(string requestId, string command, bool ok, JObject data, string message)
    {
        JObject response = new JObject
        {
            ["apiVersion"] = ApiVersion,
            ["requestId"] = requestId,
            ["command"] = command,
            ["ok"] = ok,
            ["data"] = data
        };
        if (!ok)
            response["error"] = new JObject { ["message"] = message ?? "Операция не выполнена." };
        else
            response["error"] = JValue.CreateNull();

        CPH.TriggerCodeEvent(ReplyEvent, response.ToString(Formatting.None));
    }

    private static void Ensure(bool condition, string message)
    {
        if (!condition)
            throw new InvalidOperationException(message);
    }
}
