import { create } from 'zustand';

export type CardSort = 'createdAt' | 'updatedAt' | 'due';

interface CardStoreState {
  query: string;
  selectedTags: string[];
  sort: CardSort;
  descending: boolean;
  index: number;
  selectedIds: string[];

  setQuery(query: string): void;
  toggleTag(tag: string): void;
  clearTags(): void;
  setSort(sort: CardSort): void;
  toggleDirection(): void;
  setIndex(index: number): void;
  setDescending(d: boolean): void;
  toggleSelect(id: string): void;
  setSelectAll(ids: string[], selected: boolean): void;
  clearSelect(): void;
  resetNavigation(): void;
}

export const useCardStore = create<CardStoreState>((set) => ({
  query: '',
  selectedTags: [],
  sort: 'createdAt',
  descending: true,
  index: 0,
  selectedIds: [],

  setQuery: (query) =>
    set({ query, index: 0, selectedIds: [] }),

  toggleTag: (tag) =>
    set((s) => ({
      selectedTags: s.selectedTags.includes(tag)
        ? s.selectedTags.filter((t) => t !== tag)
        : [...s.selectedTags, tag],
      index: 0,
    })),

  clearTags: () => set({ selectedTags: [], index: 0 }),

  setSort: (sort) => set({ sort }),

  toggleDirection: () => set((s) => ({ descending: !s.descending })),

  setDescending: (descending) => set({ descending }),

  setIndex: (index) => set({ index }),

  toggleSelect: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    })),

  setSelectAll: (ids, selected) =>
    set(() => ({
      selectedIds: selected ? [...new Set(ids)] : [],
    })),

  clearSelect: () => set({ selectedIds: [] }),

  resetNavigation: () => set({ index: 0 }),
}));