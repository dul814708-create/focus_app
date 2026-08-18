import { computeStreak, daysWithActivity, weeklyMinutes, toLocalDateStr, parseLocalDate } from './streak.js';

export function renderDashboard(sessions) {
  const todayStr = toLocalDateStr(new Date());

  const streak = computeStreak(sessions, todayStr);
  document.getElementById('streakNum').textContent = String(streak).padStart(2, '0');

  const todaysSessions = sessions.filter((s) => toLocalDateStr(new Date(s.created_at)) === todayStr);
  const todayFocus = todaysSessions.filter((s) => s.type === 'focus');
  const todayMinutes = todayFocus.reduce((sum, s) => sum + (s.actual_minutes || 0), 0);
  document.getElementById('todayMinutes').textContent = String(todayMinutes);
  document.getElementById('todayCount').textContent = String(todayFocus.length);

  renderStreakDots(sessions, todayStr);
  renderWeekBars(sessions, todayStr);
  renderSessionList(todayFocus);
}

function renderStreakDots(sessions, todayStr) {
  const activeDays = daysWithActivity(sessions);
  const container = document.getElementById('streakDots');
  container.innerHTML = '';
  const today = parseLocalDate(todayStr);
  for (let i = 9; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dStr = toLocalDateStr(d);
    const dot = document.createElement('span');
    dot.className = 'dot' + (activeDays.has(dStr) ? ' on' : '');
    container.appendChild(dot);
  }
}

function renderWeekBars(sessions, todayStr) {
  const minutes = weeklyMinutes(sessions, todayStr);
  const todayIdx = (parseLocalDate(todayStr).getDay() + 6) % 7; // JS getDay(): Sun=0..Sat=6 → convert to Mon=0..Sun=6
  const max = Math.max(60, ...minutes);
  const container = document.getElementById('weekBars');
  container.innerHTML = '';
  minutes.forEach((m, i) => {
    const bar = document.createElement('i');
    const pct = Math.max(6, Math.round((m / max) * 100));
    bar.style.height = pct + '%';
    if (i === todayIdx) bar.classList.add('today');
    container.appendChild(bar);
  });
}

function renderSessionList(todayFocus) {
  const list = document.getElementById('sessionList');
  list.innerHTML = '';
  if (todayFocus.length === 0) {
    const li = document.createElement('li');
    li.innerHTML = '<span>今天还没有专注记录</span>';
    list.appendChild(li);
    return;
  }
  todayFocus.forEach((s) => {
    const li = document.createElement('li');
    const status = s.completed ? '' : ' · 中断';
    li.innerHTML = `<span>${escapeHtml(s.task_name || '未命名任务')}</span><span class="t">${s.actual_minutes}min${status}</span>`;
    list.appendChild(li);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
