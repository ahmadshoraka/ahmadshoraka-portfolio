import type { DiaryEntry, UserProfile } from "../types";
import { STORAGE_KEYS } from "./keys";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadProfile(): UserProfile | null {
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(STORAGE_KEYS.profile);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function saveProfile(profile: UserProfile): void {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
}

export function clearProfile(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(STORAGE_KEYS.profile);
}

export function loadDiary(): DiaryEntry[] {
  if (!canUseStorage()) return [];
  const raw = localStorage.getItem(STORAGE_KEYS.diary);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DiaryEntry[];
  } catch {
    return [];
  }
}

export function saveDiary(entries: DiaryEntry[]): void {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_KEYS.diary, JSON.stringify(entries));
}

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export function loadChat(): ChatMessage[] {
  if (!canUseStorage()) return [];
  const raw = localStorage.getItem(STORAGE_KEYS.chat);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

export function saveChat(messages: ChatMessage[]): void {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_KEYS.chat, JSON.stringify(messages.slice(-40)));
}
