import { getSession, signIn } from './auth.js';

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
}

async function refreshDashboard() {
  // Task 8 会在这里接入 fetchSessions() + renderDashboard()
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

boot();
