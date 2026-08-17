import type { YouTubeCategory } from "./types";

const ICONS: Record<string, string> = {
  game: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.1 8.5h9.8a4 4 0 0 1 3.8 5.1l-1 3.2a2.4 2.4 0 0 1-4.2.8l-1.2-1.7h-4.6l-1.2 1.7a2.4 2.4 0 0 1-4.2-.8l-1-3.2a4 4 0 0 1 3.8-5.1Z M8 11v4m-2-2h4m8-1.5h.01M16.5 14h.01"/></svg>',
  music: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-2-2.45M19 16a2.5 2.5 0 1 1-2-2.45M9 10l10-2"/></svg>',
  sport: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0 3 4-3 3-3-3 3-4Zm-7 9 4-2 3 3-2 4-5-1v-4Zm14 0v4l-5 1-2-4 3-3 4 2Z"/></svg>',
  car: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 16-1 3m15-3 1 3M3 14l2.2-6.1A2 2 0 0 1 7.1 6.5h9.8a2 2 0 0 1 1.9 1.4L21 14v3H3v-3Zm3 0h.01M18 14h.01"/></svg>',
  science: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6m-3 0v6l5.3 8.2A2.5 2.5 0 0 1 15.2 21H8.8a2.5 2.5 0 0 1-2.1-3.8L12 9m-3.2 7h6.4"/></svg>',
  film: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h11v14H4zM15 9l5-3v12l-5-3M4 9h11M8 5l3 4m0-4 3 4M8 19l3-4m0 4 3-4"/></svg>',
  people: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20m12-9a3 3 0 1 0 0-6m6 15v-1.5a4 4 0 0 0-3-3.9M9.5 11a3 3 0 1 0 0-6"/></svg>',
  news: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h13v16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 4h6m-6 4h7m-7 4h4m8-8h.01M20 12h.01M20 16h.01"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.5c0 5-8.8 10.7-8.8 10.7S3.2 13.5 3.2 8.5a4.4 4.4 0 0 1 7.8-2.8L12 7l1-1.3a4.4 4.4 0 0 1 7.8 2.8Z"/></svg>',
  default: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h8m-8 3h8m-8 3h5"/></svg>',
};

function category(id: string, name: string, icon: keyof typeof ICONS): YouTubeCategory {
  return { id, name, iconSvg: ICONS[icon]! };
}

// Full standard set returned by YouTube videoCategories for a Russian locale.
export const YOUTUBE_CATEGORIES: YouTubeCategory[] = [
  category("1", "Фильмы и анимация", "film"),
  category("2", "Авто и транспорт", "car"),
  category("10", "Музыка", "music"),
  category("15", "Домашние животные и животные", "heart"),
  category("17", "Спорт", "sport"),
  category("18", "Короткометражные фильмы", "film"),
  category("19", "Путешествия и события", "people"),
  category("20", "Видеоигры", "game"),
  category("21", "Видеоблоги", "people"),
  category("22", "Люди и блоги", "people"),
  category("23", "Комедия", "people"),
  category("24", "Развлечения", "film"),
  category("25", "Новости и политика", "news"),
  category("26", "Практические советы и стиль", "people"),
  category("27", "Образование", "science"),
  category("28", "Наука и технологии", "science"),
  category("29", "НКО и активизм", "heart"),
  category("30", "Кино", "film"),
  category("31", "Аниме и анимация", "film"),
  category("32", "Боевики и приключения", "film"),
  category("33", "Классика", "film"),
  category("34", "Комедийные фильмы", "film"),
  category("35", "Документальные фильмы", "film"),
  category("36", "Драма", "film"),
  category("37", "Семейные фильмы", "film"),
  category("38", "Зарубежные фильмы", "film"),
  category("39", "Ужасы", "film"),
  category("40", "Научная фантастика и фэнтези", "film"),
  category("41", "Триллеры", "film"),
  category("42", "Короткие ролики", "film"),
  category("43", "Шоу", "film"),
  category("44", "Трейлеры", "film"),
];

export const FALLBACK_CATEGORY_SVG = ICONS.default!;
