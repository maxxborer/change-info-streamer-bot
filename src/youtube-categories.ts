import type { YouTubeCategory } from "./types";
import { uiIcon } from "./icons";

const ICONS: Record<string, string> = {
  game: uiIcon("game"),
  music: uiIcon("music"),
  sport: uiIcon("sport"),
  car: uiIcon("car"),
  science: uiIcon("science"),
  film: uiIcon("film"),
  people: uiIcon("people"),
  news: uiIcon("news"),
  heart: uiIcon("heart"),
  default: uiIcon("defaultCategory"),
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
