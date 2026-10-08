# Changelog

[Русская версия](#история-изменений)

## Unreleased

- Hide disabled platform cards, title previews, and combined editor fields while retaining their switches and drafts.

- Add persistent Twitch and YouTube switches to the subtitle and combined editors, excluding disabled platforms from validation and manual updates.
- Keep platform drafts when toggling and prevent submissions with no selected platform available or while a combined update is pending.

## 1.2.2 — 2026-08-23

- Display only the version number without a product-name prefix.

## 1.2.1 — 2026-08-23

- Show the DockBar version alongside the last-updated timestamp.
- Derive the displayed version directly from the release package version.

## 1.2.0 — 2026-08-23

- Automatically applies the saved YouTube title, category, and tags when Streamer.bot detects that a YouTube broadcast has started.
- Leaves metadata unchanged on a fresh installation until YouTube values have been explicitly saved.
- Waits for the live broadcast to become available without retrying completed metadata writes.

## 1.1.0 — 2026-08-19

- Made all editors near-full-screen, with a fixed header/footer and scrollable work area.
- Moved Templates above platform cards.
- Added Russian, English, Spanish, and Simplified Chinese HTML builds.
- Added safe `?demo=1` showcase mode and repository screenshots.
- Removed duplicate tracked build/import intermediates and added OSS documentation.

## История изменений

[English version](#changelog)

### Не выпущено

- Карточки, предпросмотр названия и поля общего редактора отключённых платформ скрываются; тумблеры и введённые данные сохраняются.

- Добавлены тумблеры Twitch и YouTube в редакторы подзаголовка и общей информации с сохранением выбора в браузере. Отключённые платформы исключаются из проверки и ручных обновлений.
- Введённые данные сохраняются при переключении; применение блокируется без доступных выбранных платформ и во время общего обновления.

### 1.2.2 — 2026-08-23

- Отображается только номер версии без префикса с названием продукта.

### 1.2.1 — 2026-08-23

- Версия DockBar выводится рядом со временем последнего обновления.
- Отображаемая версия берётся напрямую из версии релизного пакета.

### 1.2.0 — 2026-08-23

- Сохранённые название, категория и теги YouTube теперь применяются автоматически, когда Streamer.bot обнаруживает запуск эфира.
- На чистой установке метаданные не меняются, пока параметры YouTube не будут явно сохранены.
- Ожидание появления live-эфира больше не приводит к повтору уже выполненных записей метаданных.

### 1.1.0 — 2026-08-19

- Редакторы стали почти полноэкранными: шапка и действия закреплены, прокручивается только рабочая область.
- «Шаблоны» перенесены выше карточек платформ.
- Добавлена сборка HTML на русском, английском, испанском и упрощённом китайском.
- Добавлены безопасный демонстрационный режим `?demo=1` и скриншоты в репозитории.
- Удалены дублирующиеся промежуточные артефакты сборки/импорта и добавлена OSS-документация.
