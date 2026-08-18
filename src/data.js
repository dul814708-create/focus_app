import { supabase } from './supabaseClient.js';

const QUEUE_KEY = 'focusapp_offline_queue';

export function makeId() {
  return crypto.randomUUID();
}

export async function fetchSessions(sinceDays = 60) {
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function insertSession(record) {
  const { error } = await supabase.from('sessions').upsert(record);
  if (error) {
    queueRecord(record);
    return { synced: false };
  }
  return { synced: true };
}

function queueRecord(record) {
  const queue = readQueue();
  queue.push(record);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function readQueue() {
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function flushQueue() {
  const snapshot = readQueue();
  if (snapshot.length === 0) return { flushed: 0, remaining: 0 };
  const succeededIds = new Set();
  for (const record of snapshot) {
    const { error } = await supabase.from('sessions').upsert(record);
    if (!error) succeededIds.add(record.id);
  }
  const current = readQueue();
  const remaining = current.filter((r) => !succeededIds.has(r.id));
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return { flushed: succeededIds.size, remaining: remaining.length };
}

export function queueLength() {
  return readQueue().length;
}
