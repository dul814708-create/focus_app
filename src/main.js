import { getSession, signIn } from './auth.js';
import { fetchSessions, flushQueue } from './data.js';
import { renderDashboard } from './ui.js';
import { createTimer } from './timer.js';
import { makeId, insertSession } from './data.js';

const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

async function boot() {
  const session = await getSession();
  if (session) {
    await showApp();
  } else {
    showLogin();
  }
}

function showLogin() {
  loginScreen.hidden = false;
  appScreen.hidden = true;
}

async function showApp() {
  loginScreen.hidden = true;
  appScreen.hidden = false;
  document.getElementById('todayDate').textContent = formatDateHeading(new Date());
  await refreshDashboard();
  await flushQueue().then(refreshDashboard).catch(() => {});
  window.addEventListener('online', () => {
    flushQueue().then(refreshDashboard).catch(() => {});
  });
}

async function refreshDashboard() {
  const sessions = await fetchSessions();
  renderDashboard(sessions);
}

function formatDateHeading(date) {
  const weekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][date.getDay()];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · ${weekday}`;
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  const email = document.getElementById('emailInput').value;
  const password = document.getElementById('passwordInput').value;
  try {
    await signIn(email, password);
    await showApp();
  } catch (err) {
    loginError.textContent = '登录失败，请检查邮箱和密码';
    loginError.hidden = false;
  }
});

const themeBtn = document.getElementById('themeToggle');
function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.hasAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
}
function renderThemeBtn() {
  themeBtn.textContent = isDark() ? '切换到浅色' : '切换到深色';
}
themeBtn.addEventListener('click', () => {
  document.documentElement.setAttribute('data-theme', isDark() ? 'light' : 'dark');
  renderThemeBtn();
});
renderThemeBtn();

const RING_CIRCUMFERENCE = 490;
let selectedMinutes = 45;
let timer = null;
let currentTaskName = '';

document.querySelectorAll('#durationSegmented button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#durationSegmented button').forEach((b) => b.classList.remove('on'));
    btn.classList.add('on');
    if (btn.dataset.minutes === 'custom') {
      const input = prompt('输入自定义分钟数', '30');
      selectedMinutes = Math.max(1, parseInt(input, 10) || 30);
    } else {
      selectedMinutes = parseInt(btn.dataset.minutes, 10);
    }
    updateRingDisplay(selectedMinutes * 60, selectedMinutes * 60);
  });
});

function updateRingDisplay(remaining, totalSeconds) {
  const ratio = remaining / totalSeconds;
  document.getElementById('ringProgress').setAttribute('stroke-dashoffset', String(RING_CIRCUMFERENCE * ratio));
  document.getElementById('ringTimeText').textContent = formatMMSS(remaining);
}

function formatMMSS(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

document.getElementById('startBtn').addEventListener('click', () => {
  currentTaskName = document.getElementById('taskNameInput').value.trim() || '未命名任务';
  const totalSeconds = selectedMinutes * 60;
  timer = createTimer({
    totalSeconds,
    onTick: (remaining) => updateRingDisplay(remaining, totalSeconds),
    onComplete: async ({ completed, actualSeconds }) => {
      await saveFocusSession(totalSeconds, actualSeconds, completed);
      resetRitualUI(totalSeconds);
    },
  });
  timer.start();
  document.getElementById('startBtn').hidden = true;
  document.getElementById('timerControls').hidden = false;
  document.getElementById('pauseResumeBtn').textContent = '暂停';
});

document.getElementById('pauseResumeBtn').addEventListener('click', (e) => {
  if (!timer) return;
  if (e.target.textContent === '暂停') {
    timer.pause();
    e.target.textContent = '继续';
  } else {
    timer.resume();
    e.target.textContent = '暂停';
  }
});

document.getElementById('resetBtn').addEventListener('click', () => {
  if (!timer) return;
  timer.reset();
  document.getElementById('pauseResumeBtn').textContent = '暂停';
});

document.getElementById('skipBtn').addEventListener('click', () => {
  if (!timer) return;
  timer.skip();
});

async function saveFocusSession(totalSeconds, actualSeconds, completed) {
  const record = {
    id: makeId(),
    type: 'focus',
    task_name: currentTaskName,
    planned_minutes: Math.round(totalSeconds / 60),
    actual_minutes: Math.round(actualSeconds / 60),
    completed,
    note: null,
    created_at: new Date().toISOString(),
  };
  await insertSession(record);
  await refreshDashboard();
}

function resetRitualUI(totalSeconds) {
  timer = null;
  document.getElementById('startBtn').hidden = false;
  document.getElementById('timerControls').hidden = true;
  updateRingDisplay(totalSeconds, totalSeconds);
}

boot();
