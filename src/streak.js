export function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysWithActivity(sessions) {
  const set = new Set();
  for (const s of sessions) {
    set.add(toLocalDateStr(new Date(s.created_at)));
  }
  return set;
}

export function computeStreak(sessions, todayStr) {
  const activeDays = daysWithActivity(sessions);
  let streak = 0;
  const cursor = parseLocalDate(todayStr);
  while (activeDays.has(toLocalDateStr(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function weeklyMinutes(sessions, todayStr) {
  const today = parseLocalDate(todayStr);
  const dow = today.getDay(); // 0=周日..6=周六
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  const monday = new Date(today);
  monday.setDate(monday.getDate() - mondayOffset);

  const minutesByDay = {};
  for (const s of sessions) {
    if (s.type !== 'focus') continue;
    const dStr = toLocalDateStr(new Date(s.created_at));
    minutesByDay[dStr] = (minutesByDay[dStr] || 0) + (s.actual_minutes || 0);
  }

  const result = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    result.push(minutesByDay[toLocalDateStr(d)] || 0);
  }
  return result;
}
