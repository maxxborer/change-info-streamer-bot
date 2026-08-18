# Stream Info для Streamer.bot

Готовый файл: `change-info-streamer-bot.html`.

## Использование

1. Запустите Streamer.bot и убедитесь, что его встроенный WebSocket-сервер включён.
2. Откройте `change-info-streamer-bot.html` двойным кликом.
3. Если появится предложение импорта, скопируйте строку из HTML (или из `streamerbot-import.txt`) и вставьте её в **Import** Streamer.bot.
4. Нажмите «Проверить снова» и пользуйтесь карточками Twitch и YouTube.

Если раньше появлялось окно *Minimum Version Required* в Streamer.bot 1.0.7, используйте обновлённую Import-строку из текущей версии HTML: её порог совместимости исправлен для 1.0.7. Action API имеет версию 3, поэтому импортируйте строку ещё раз — HTML сам покажет требование, если на стороне Streamer.bot осталась старая версия.

Никакой веб-сервер, `npm`, `pnpm dev`, OAuth-экран или отдельная программа для обычного использования не нужны. Файл подключается к `ws://127.0.0.1:8080/` автоматически. Если в Streamer.bot включена WebSocket-аутентификация, пароль вводится в компактном блоке под шапкой или в настройках.

В HTML уже встроены JavaScript, CSS, логотипы, иконки, список YouTube-категорий, библиотека Streamer.bot Client и настоящая Import-строка. Twitch OAuth-токен и Client ID используются только внутри C# Action в Streamer.bot и не попадают в HTML.

Кнопка YouTube Studio открывает страницу активного эфира. Во всех не-live состояниях она открывает раздел прямых трансляций подключённого YouTube-канала, а не устаревшую запись завершённого broadcast.

## Шаблоны и игровые пресеты

Редактор шаблонов находится на главном экране. «Сохранить шаблоны» сохраняет два шаблона и последний подзаголовок не только в браузере, но и в постоянных глобальных переменных Streamer.bot. Поэтому ими можно управлять из ваших существующих Actions.

Для игрового пресета создайте свой Action в группе `STREAM INFO`, дайте ему имя вида `PRESET | PUBG` и выполните в нём три шага:

1. Сохраните нужные значения в глобальные переменные ниже.
2. Вызовите `STREAM INFO | API` с аргументом `command = applyPreset`.
3. Вернитесь в HTML и обновите данные: этот Action появится кнопкой в блоке «Игровые пресеты».

| Переменная | Значение |
| --- | --- |
| `stream_info.template.twitch` | шаблон Twitch с единственным `%subtitle%` |
| `stream_info.template.youtube` | шаблон YouTube с единственным `%subtitle%` |
| `stream_info.template.subtitle` | подзаголовок |
| `stream_info.preset.twitchCategoryId` | Twitch category ID, например `493057` |
| `stream_info.preset.youtubeCategoryName` | название категории YouTube |
| `stream_info.preset.twitchTagsJson` | JSON-массив Twitch-тегов, например `["Русский","PUBG"]` |
| `stream_info.preset.youtubeTagsJson` | JSON-массив YouTube-тегов |

Пустая переменная означает «не менять это поле». `applyPreset` применяет Twitch и активный YouTube-эфир по отдельности; если YouTube не запущен, Twitch обновится, а YouTube будет отмечен как пропущенный. Пара методов для чтения и записи таких постоянных переменных есть в [документации Streamer.bot](https://docs.streamer.bot/api/csharp/methods/core/globals/get-global-var).

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

Исходный C# Action находится в `streamerbot/action.cs`; Import-строка пересобирается из него автоматически. Перед сдачей выполнены строгая проверка TypeScript, UI-тесты с полностью подменённым WebSocket-клиентом, single-file build, проверка отсутствия внешних JS/CSS-ресурсов и проверка Import-пакета. Проверки реального эфира и изменения Twitch/YouTube намеренно не выполнялись: для них нужны подключённые аккаунты владельца.
