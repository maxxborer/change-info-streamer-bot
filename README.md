# Stream Info для Streamer.bot

Готовый файл: `change-info-streamer-bot.html`.

## Использование

1. Запустите Streamer.bot и убедитесь, что его встроенный WebSocket-сервер включён.
2. Откройте `change-info-streamer-bot.html` двойным кликом.
3. Если появится предложение импорта, скопируйте строку из HTML (или из `streamerbot-import.txt`) и вставьте её в **Import** Streamer.bot.
4. Нажмите «Проверить снова» и пользуйтесь карточками Twitch и YouTube.

Никакой веб-сервер, `npm`, `pnpm dev`, OAuth-экран или отдельная программа для обычного использования не нужны. Файл подключается к `ws://127.0.0.1:8080/` автоматически. Если в Streamer.bot включена WebSocket-аутентификация, пароль вводится в компактном блоке под шапкой или в настройках.

В HTML уже встроены JavaScript, CSS, логотипы, иконки, список YouTube-категорий, библиотека Streamer.bot Client и настоящая Import-строка. Twitch OAuth-токен и Client ID используются только внутри C# Action в Streamer.bot и не попадают в HTML.

## Разработка и сборка

Требуется Node.js. Одна команда создаёт все пользовательские артефакты:

```powershell
npm install
npm run build
```

Результаты сборки:

- `dist/change-info-streamer-bot.html`
- `change-info-streamer-bot.html`
- `streamerbot-import.txt`

Исходный C# Action находится в `streamerbot/action.cs`; Import-строка пересобирается из него автоматически. Перед сдачей выполнены строгая проверка TypeScript, single-file build, проверка отсутствия внешних JS/CSS-ресурсов, проверка Import-пакета и обмен `DoAction → Custom.CodeEvent` на изолированном Streamer.bot 1.0.7. Проверки реального эфира и изменения Twitch/YouTube намеренно не выполнялись: для них нужны подключённые аккаунты владельца.
