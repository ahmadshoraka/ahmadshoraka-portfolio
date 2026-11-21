"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { computeDailyTargets, todayKey } from "@/lib/calories";
import {
  clearProfile,
  loadDiary,
  loadProfile,
  saveDiary,
  saveProfile,
  type ChatMessage,
  loadChat,
  saveChat,
} from "@/lib/storage/client-store";
import type {
  ActivityLevel,
  DiaryEntry,
  DiaryEntrySource,
  Sex,
  UserLevel,
  UserProfile,
} from "@/lib/types";

type OnboardingInput = {
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  activity: ActivityLevel;
  level: UserLevel;
};

type VoroodContextValue = {
  ready: boolean;
  profile: UserProfile | null;
  entriesToday: DiaryEntry[];
  eatenCalories: number;
  remainingCalories: number;
  eatenProteinG: number;
  eatenCarbG: number;
  eatenFatG: number;
  chat: ChatMessage[];
  completeOnboarding: (input: OnboardingInput) => void;
  addEntry: (entry: Omit<DiaryEntry, "id" | "dateKey" | "createdAt"> & { dateKey?: string }) => void;
  removeEntry: (id: string) => void;
  resetAll: voidFn;
  appendChat: (role: ChatMessage["role"], content: string) => void;
};

type voidFn = () => void;

const VoroodContext = createContext<VoroodContextValue | null>(null);

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function VoroodProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setProfile(loadProfile());
    setDiary(loadDiary());
    setChat(loadChat());
    setReady(true);
  }, []);

  const dateKey = todayKey();
  const entriesToday = useMemo(
    () => diary.filter((e) => e.dateKey === dateKey),
    [diary, dateKey],
  );

  const eatenCalories = entriesToday.reduce((s, e) => s + e.calories, 0);
  const eatenProteinG = entriesToday.reduce((s, e) => s + e.proteinG, 0);
  const eatenCarbG = entriesToday.reduce((s, e) => s + e.carbG, 0);
  const eatenFatG = entriesToday.reduce((s, e) => s + e.fatG, 0);
  const remainingCalories = (profile?.dailyCalorieTarget ?? 0) - eatenCalories;

  const completeOnboarding = useCallback((input: OnboardingInput) => {
    const targets = computeDailyTargets(input);
    const now = new Date().toISOString();
    const next: UserProfile = {
      id: uid("usr"),
      ...input,
      ...targets,
      createdAt: now,
      updatedAt: now,
    };
    saveProfile(next);
    setProfile(next);
  }, []);

  const addEntry = useCallback(
    (
      entry: Omit<DiaryEntry, "id" | "dateKey" | "createdAt"> & {
        dateKey?: string;
        source: DiaryEntrySource;
      },
    ) => {
      const next: DiaryEntry = {
        id: uid("ent"),
        dateKey: entry.dateKey ?? todayKey(),
        name: entry.name,
        calories: entry.calories,
        proteinG: entry.proteinG,
        carbG: entry.carbG,
        fatG: entry.fatG,
        source: entry.source,
        createdAt: new Date().toISOString(),
      };
      setDiary((prev) => {
        const merged = [next, ...prev].slice(0, 2000);
        saveDiary(merged);
        return merged;
      });
    },
    [],
  );

  const removeEntry = useCallback((id: string) => {
    setDiary((prev) => {
      const merged = prev.filter((e) => e.id !== id);
      saveDiary(merged);
      return merged;
    });
  }, []);

  const resetAll = useCallback(() => {
    clearProfile();
    saveDiary([]);
    saveChat([]);
    setProfile(null);
    setDiary([]);
    setChat([]);
  }, []);

  const appendChat = useCallback((role: ChatMessage["role"], content: string) => {
    setChat((prev) => {
      const merged = [
        ...prev,
        {
          id: uid("msg"),
          role,
          content,
          createdAt: new Date().toISOString(),
        },
      ];
      saveChat(merged);
      return merged;
    });
  }, []);

  const value: VoroodContextValue = {
    ready,
    profile,
    entriesToday,
    eatenCalories,
    remainingCalories,
    eatenProteinG,
    eatenCarbG,
    eatenFatG,
    chat,
    completeOnboarding,
    addEntry,
    removeEntry,
    resetAll,
    appendChat,
  };

  return <VoroodContext.Provider value={value}>{children}</VoroodContext.Provider>;
}

export function useVorood(): VoroodContextValue {
  const ctx = useContext(VoroodContext);
  if (!ctx) throw new Error("useVorood must be used within VoroodProvider");
  return ctx;
}
