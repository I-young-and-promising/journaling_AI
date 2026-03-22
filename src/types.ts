export interface DiaryEntry {
  id: number;
  title: string;
  content: string;
  date: string;
  mood?: string;
  mood_emoji?: string;
  weather?: string;
  image_data?: string;
}
