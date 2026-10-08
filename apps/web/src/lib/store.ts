import { localStore } from './localStore';
import { cloudStore, supabase } from './supabase';
import type { Store } from './types';

export const store: Store = supabase ? cloudStore : localStore;
export const isCloud = store.mode === 'cloud';
