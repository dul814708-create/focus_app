# 开工（防拖延工具·第一阶段）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个可以在电脑（打包成 exe）和手机（网页）上使用的个人防拖延工具：专注仪式计时器、连续天数看板、睡前签到，数据通过 Supabase 在两端同步。

**Architecture:** 纯前端单页应用（原生 HTML/CSS/JS ES Module，无构建步骤），通过 CDN 引入 Supabase JS 客户端做登录与数据存储；电脑端用 nativefier 把部署好的网页打包成 Windows exe；手机端直接访问同一网址、添加到主屏幕。

**Tech Stack:** 原生 HTML/CSS/JavaScript（ES Modules，无打包工具）、Supabase（Auth + Postgres，通过 `https://esm.sh/@supabase/supabase-js@2`）、GitHub Pages（静态托管）、nativefier（Windows exe 打包）。

## Global Constraints

- 单用户产品，不做注册/多用户体系 —— 唯一账号在 Supabase 后台手动创建，App 内只做登录
- 不搭建自动化测试框架；每个任务用浏览器控制台或手动操作验证（来自设计文档「八、验证方式」）
- 专注期间不做网站/应用硬拦截；不做夜间推送提醒；不做开机自启动（来自设计文档「二、范围」）
- 连续天数判定：当天有一条 `focus` 或 `checkin` 记录即达标；断掉后直接归零，不保留历史最高记录（设计文档「四、4」）
- 视觉：系统字体（-apple-system）+ 等宽数字（SF Mono 系）；浅色强调色固定 `#8C6FCB`（薰衣草紫），深色强调色固定 `#9C97E8`（靛紫），两者独立配置，不是同一色值的明暗映射；专注计时器为细圆环进度条（设计文档「九、视觉设计」）
- 本机（用于开发/打包）默认未安装 Node.js —— 打包 exe 前需要用户自行安装一次，其余开发流程全程不依赖 Node/npm

---

## File Structure

```
D:\focus_app\
  index.html              # 登录屏 + 主应用外壳（含所有挂载点，任务2一次性建好）
  style.css                # 全部样式（含明暗主题 token，任务2一次性建好）
  .gitignore
  src/
    config.js              # Supabase URL / anon key
    supabaseClient.js       # 创建 Supabase 客户端实例
    auth.js                  # 登录/登出/取会话
    streak.js                 # 连续天数、周统计等纯函数（无 DOM 依赖，最容易独立验证）
    timer.js                   # 倒计时纯逻辑（无 DOM 依赖）
    data.js                     # sessions 表增删查 + 离线队列
    ui.js                         # 根据数据渲染看板 DOM（纯渲染函数，不含事件绑定）
    main.js                        # 入口：事件绑定、登录流程、专注仪式/签到的交互编排
  supabase/
    schema.sql                     # 建表 + RLS 策略，粘到 Supabase SQL Editor 里跑
```

---

### Task 1: Supabase 项目与数据表设置

这是用户在 Supabase 后台完成的一次性手动操作，不涉及写代码，但后续所有任务都依赖这里产出的 URL / anon key / 账号。

**Files:**
- Create: `supabase/schema.sql`

**Interfaces:**
- Produces: Supabase 项目的 `Project URL`、`anon public key`；一个已存在的登录账号（邮箱+密码）—— 供 Task 3、Task 4 使用

- [ ] **Step 1: 创建 Supabase 项目**

访问 https://supabase.com ，注册/登录后点 "New project"，项目名填 `focus-app`，选一个离自己近的区域，记下设置密码。创建完成后进入项目 Dashboard。

- [ ] **Step 2: 写入建表 SQL**

创建文件 `D:\focus_app\supabase\schema.sql`：

```sql
create table if not exists sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id),
  type text not null check (type in ('focus', 'checkin')),
  task_name text,
  planned_minutes integer,
  actual_minutes integer,
  completed boolean,
  note text,
  created_at timestamptz not null default now()
);

alter table sessions enable row level security;

create policy "individual access"
  on sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 3: 在 Supabase 里执行建表 SQL**

Supabase Dashboard → 左侧 "SQL Editor" → New query → 粘贴 `schema.sql` 的内容 → Run。执行成功后左侧 "Table Editor" 应该能看到 `sessions` 表，字段与上面一致。

- [ ] **Step 4: 创建唯一的登录账号**

Supabase Dashboard → 左侧 "Authentication" → "Users" → "Add user" → 填入自己的邮箱和一个密码 → 确认创建（不用勾发邮件确认，直接创建即可，因为这个项目不做邮箱验证流程）。记下这组邮箱+密码，后面登录用。

- [ ] **Step 5: 记录连接信息**

Supabase Dashboard → 左侧 "Settings" → "API"，记下：
- `Project URL`（形如 `https://xxxxxxxx.supabase.co`）
- `anon public` key（一长串字符串）

这两个值在 Task 3 会填进 `src/config.js`。

- [ ] **Step 6: Commit**

```bash
cd D:/focus_app
git add supabase/schema.sql
git commit -m "Add Supabase schema for sessions table with RLS"
```

---

### Task 2: 项目骨架 —— index.html + style.css + 本地服务器验证

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `.gitignore`

**Interfaces:**
- Produces: 所有后续 JS 要挂载的 DOM 元素 ID —— `loginScreen`, `loginForm`, `emailInput`, `passwordInput`, `loginError`, `appScreen`, `themeToggle`, `todayDate`, `taskNameInput`, `durationSegmented`（内含 `button[data-minutes]`）, `ringProgress`, `ringTimeText`, `startBtn`, `timerControls`, `pauseResumeBtn`, `resetBtn`, `skipBtn`, `streakNum`, `todayMinutes`, `todayCount`, `streakDots`, `weekBars`, `sessionList`, `checkinYesBtn`, `checkinNoBtn`, `noteInput`
- Produces: CSS 变量 token —— `--bg --surface --surface-inset --ink --ink-soft --ink-faint --accent --accent-ink --accent-soft --hairline --warm --shadow-1 --shadow-2`（浅色/深色两套值都定义好）

- [ ] **Step 1: 写 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>开工</title>
<link rel="stylesheet" href="style.css" />
</head>
<body>
  <div id="loginScreen" class="screen-login">
    <form id="loginForm" class="login-card">
      <h1>开工</h1>
      <input id="emailInput" type="email" placeholder="邮箱" autocomplete="username" required />
      <input id="passwordInput" type="password" placeholder="密码" autocomplete="current-password" required />
      <button type="submit">登录</button>
      <p id="loginError" class="login-error" hidden></p>
    </form>
  </div>

  <div id="appScreen" class="page" hidden>
    <div class="topbar">
      <button class="theme-toggle" id="themeToggle">切换到深色</button>
    </div>
    <header class="hero">
      <p class="date" id="todayDate"></p>
      <h1>今天</h1>
    </header>

    <section class="card">
      <h2>专注仪式</h2>
      <input class="task-input" id="taskNameInput" type="text" placeholder="要做的事" />
      <div class="segmented" id="durationSegmented">
        <button type="button" data-minutes="25">25′</button>
        <button type="button" data-minutes="45" class="on">45′</button>
        <button type="button" data-minutes="60">60′</button>
        <button type="button" data-minutes="90">90′</button>
        <button type="button" data-minutes="custom">自定义</button>
      </div>
      <div class="ritual-body">
        <div class="ring-wrap">
          <svg width="180" height="180" viewBox="0 0 180 180">
            <circle cx="90" cy="90" r="78" fill="none" stroke="var(--hairline)" stroke-width="8"/>
            <circle id="ringProgress" cx="90" cy="90" r="78" fill="none" stroke="var(--accent)" stroke-width="8"
              stroke-dasharray="490" stroke-dashoffset="490" stroke-linecap="round"
              transform="rotate(-90 90 90)"/>
          </svg>
          <div class="ring-time">
            <span class="num" id="ringTimeText">45:00</span>
            <span class="cap">剩余</span>
          </div>
        </div>
        <button class="start-btn" id="startBtn"><span class="tri"></span>开始专注</button>
        <div class="timer-controls" id="timerControls" hidden>
          <button type="button" id="pauseResumeBtn">暂停</button>
          <button type="button" id="resetBtn">重置</button>
          <button type="button" id="skipBtn">跳过</button>
        </div>
        <p class="sub">中途不拦分心网页，跑完如实记录结果</p>
      </div>
    </section>

    <section class="card">
      <h2>连续天数</h2>
      <div class="stat-row">
        <div class="stat warm"><div class="num" id="streakNum">0</div><div class="lbl">连续天数</div></div>
        <div class="stat"><div class="num" id="todayMinutes">0</div><div class="lbl">今日分钟</div></div>
        <div class="stat"><div class="num" id="todayCount">0</div><div class="lbl">今日次数</div></div>
      </div>
      <div class="dots" id="streakDots"></div>
      <h2>本周专注</h2>
      <div class="bars" id="weekBars"></div>
      <div class="bars-lbl">
        <span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span>
      </div>
    </section>

    <section class="card">
      <h2>今日记录</h2>
      <ul class="list" id="sessionList"></ul>
    </section>

    <section class="card">
      <h2>睡前签到</h2>
      <div class="check-row">
        <button type="button" class="yes" id="checkinYesBtn">今天做到了</button>
        <button type="button" class="no" id="checkinNoBtn">没做到</button>
      </div>
      <input class="note-input" id="noteInput" type="text" placeholder="明天第一件事" />
    </section>
  </div>

  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: 写 style.css**

```css
:root{
  --bg:#F5F5F7; --surface:#FFFFFF; --surface-inset:#F0F0F2;
  --ink:#1D1D1F; --ink-soft:#6E6E73; --ink-faint:#AEAEB2;
  --accent-ink:#FFFFFF; --hairline:#E3E3E6; --warm:#C98A4B;
  --shadow-1:0 1px 2px rgba(0,0,0,.04); --shadow-2:0 12px 28px -14px rgba(29,29,31,.18);
  --accent:#8C6FCB; --accent-soft:rgba(140,111,203,.12);
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#000000; --surface:#1C1C1E; --surface-inset:#2C2C2E;
    --ink:#F5F5F7; --ink-soft:#98989D; --ink-faint:#5A5A5E;
    --accent-ink:#0B1220; --hairline:#38383A; --warm:#D9A26C;
    --shadow-1:0 1px 2px rgba(0,0,0,.5); --shadow-2:0 16px 32px -16px rgba(0,0,0,.6);
    --accent:#9C97E8; --accent-soft:rgba(156,151,232,.18);
  }
}
:root[data-theme="dark"]{
  --bg:#000000; --surface:#1C1C1E; --surface-inset:#2C2C2E;
  --ink:#F5F5F7; --ink-soft:#98989D; --ink-faint:#5A5A5E;
  --accent-ink:#0B1220; --hairline:#38383A; --warm:#D9A26C;
  --shadow-1:0 1px 2px rgba(0,0,0,.5); --shadow-2:0 16px 32px -16px rgba(0,0,0,.6);
  --accent:#9C97E8; --accent-soft:rgba(156,151,232,.18);
}
:root[data-theme="light"]{
  --bg:#F5F5F7; --surface:#FFFFFF; --surface-inset:#F0F0F2;
  --ink:#1D1D1F; --ink-soft:#6E6E73; --ink-faint:#AEAEB2;
  --accent-ink:#FFFFFF; --hairline:#E3E3E6; --warm:#C98A4B;
  --shadow-1:0 1px 2px rgba(0,0,0,.04); --shadow-2:0 12px 28px -14px rgba(29,29,31,.18);
  --accent:#8C6FCB; --accent-soft:rgba(140,111,203,.12);
}

*{box-sizing:border-box;}
html,body{margin:0;padding:0;}
body{
  background:var(--bg); color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
}
@media (prefers-reduced-motion: reduce){ *{transition:none !important; animation:none !important;} }
[hidden]{display:none !important;}

.screen-login{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1.25rem;}
.login-card{background:var(--surface);border-radius:20px;padding:2rem 1.75rem;box-shadow:var(--shadow-1),var(--shadow-2);width:100%;max-width:340px;display:flex;flex-direction:column;gap:.9rem;}
.login-card h1{margin:0 0 .3rem;font-size:1.6rem;font-weight:700;}
.login-card input{border:none;background:var(--surface-inset);color:var(--ink);font-family:inherit;font-size:1rem;padding:.8rem 1rem;border-radius:12px;}
.login-card input:focus{outline:2px solid var(--accent);outline-offset:1px;}
.login-card button[type="submit"]{border:none;background:var(--accent);color:var(--accent-ink);padding:.85rem;border-radius:14px;font-size:1rem;font-weight:600;cursor:pointer;font-family:inherit;}
.login-error{color:#D6455A;font-size:.82rem;margin:0;}

.page{max-width:520px;margin:0 auto;padding:2rem 1.25rem 5rem;}
.topbar{display:flex;justify-content:flex-end;margin-bottom:1.4rem;}
.theme-toggle{border:1px solid var(--hairline);background:var(--surface);color:var(--ink-soft);font-size:.78rem;padding:.4rem .85rem;border-radius:999px;cursor:pointer;font-family:inherit;box-shadow:var(--shadow-1);}
.theme-toggle:focus-visible{outline:2px solid var(--ink);outline-offset:2px;}

header.hero{margin-bottom:1.75rem;}
header.hero .date{font-size:.85rem;color:var(--ink-soft);font-weight:590;margin:0 0 .2rem;}
header.hero h1{font-size:2.1rem;font-weight:700;letter-spacing:-.015em;margin:0;text-wrap:balance;}

.card{background:var(--surface);border-radius:20px;padding:1.5rem 1.4rem;box-shadow:var(--shadow-1),var(--shadow-2);margin-bottom:1.1rem;}
.card h2{font-size:.72rem;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-soft);font-weight:700;margin:0 0 1.1rem;}

.task-input{width:100%;border:none;background:var(--surface-inset);color:var(--ink);font-family:inherit;font-size:1rem;padding:.8rem 1rem;border-radius:12px;}
.task-input:focus{outline:2px solid var(--accent);outline-offset:1px;}
.task-input::placeholder{color:var(--ink-faint);}

.segmented{display:flex;background:var(--surface-inset);border-radius:11px;padding:3px;margin-top:.85rem;gap:2px;}
.segmented button{flex:1;border:none;background:transparent;color:var(--ink-soft);font-family:inherit;font-size:.82rem;font-weight:590;padding:.5rem .3rem;border-radius:9px;cursor:pointer;}
.segmented button.on{background:var(--surface);color:var(--ink);box-shadow:var(--shadow-1);}
.segmented button:focus-visible{outline:2px solid var(--accent);outline-offset:-2px;}

.ritual-body{display:flex;flex-direction:column;align-items:center;gap:1.4rem;margin-top:1.7rem;}
.ring-wrap{position:relative;width:180px;height:180px;}
.ring-time{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}
.ring-time .num{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:2.5rem;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.01em;color:var(--ink);}
.ring-time .cap{font-size:.72rem;color:var(--ink-soft);letter-spacing:.06em;text-transform:uppercase;margin-top:.15rem;}

.start-btn{width:100%;border:none;background:var(--accent);color:var(--accent-ink);padding:.95rem;border-radius:14px;font-size:1rem;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:.5rem;box-shadow:var(--shadow-1);}
.start-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.start-btn .tri{width:0;height:0;border-style:solid;border-width:6px 0 6px 10px;border-color:transparent transparent transparent var(--accent-ink);}
.sub{color:var(--ink-soft);font-size:.8rem;text-align:center;margin:.6rem 0 0;}

.timer-controls{display:flex;gap:.6rem;width:100%;}
.timer-controls button{flex:1;border:1px solid var(--hairline);background:var(--surface-inset);color:var(--ink);padding:.65rem;border-radius:12px;font-size:.85rem;cursor:pointer;font-family:inherit;}
.timer-controls button:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}

.stat-row{display:flex;gap:.9rem;margin-bottom:1.3rem;}
.stat{flex:1;background:var(--surface-inset);border-radius:14px;padding:.9rem 1rem;}
.stat .num{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:1.7rem;font-weight:700;font-variant-numeric:tabular-nums;color:var(--ink);}
.stat.warm .num{color:var(--warm);}
.stat .lbl{font-size:.72rem;color:var(--ink-soft);margin-top:.15rem;}

.dots{display:flex;gap:.4rem;margin-bottom:1.4rem;}
.dot{width:9px;height:9px;border-radius:50%;background:var(--hairline);}
.dot.on{background:var(--accent);}

.list{list-style:none;margin:0;padding:0;}
.list li{display:flex;justify-content:space-between;align-items:center;padding:.7rem 0;border-bottom:1px solid var(--hairline);font-size:.92rem;}
.list li:last-child{border-bottom:none;padding-bottom:0;}
.list .t{color:var(--ink-soft);font-size:.82rem;font-variant-numeric:tabular-nums;}

.bars{display:flex;align-items:flex-end;gap:.5rem;height:44px;margin:1.3rem 0 .6rem;}
.bars i{flex:1;background:var(--hairline);border-radius:3px;display:block;}
.bars i.today{background:var(--accent);}
.bars-lbl{display:flex;gap:.5rem;}
.bars-lbl span{flex:1;text-align:center;font-size:.68rem;color:var(--ink-faint);}

.check-row{display:flex;gap:.7rem;margin-bottom:1rem;}
.check-row button{flex:1;border:none;padding:.75rem;border-radius:12px;font-size:.88rem;font-weight:600;cursor:pointer;font-family:inherit;}
.check-row .yes{background:var(--accent);color:var(--accent-ink);}
.check-row .no{background:var(--surface-inset);color:var(--ink-soft);}
.check-row button:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}
.note-input{width:100%;border:none;background:var(--surface-inset);color:var(--ink);padding:.75rem 1rem;border-radius:12px;font-family:inherit;font-size:.88rem;}
.note-input:focus{outline:2px solid var(--accent);outline-offset:1px;}
.note-input::placeholder{color:var(--ink-faint);}
```

- [ ] **Step 3: 写 .gitignore**

```
node_modules/
开工-win32-x64/
*.log
.DS_Store
```

- [ ] **Step 4: 本地起服务验证页面能打开**

在 `D:\focus_app` 目录下运行（用 Python，不依赖 Node）：

```bash
python -m http.server 8000
```

浏览器打开 `http://localhost:8000`，应该看到登录卡片（邮箱、密码输入框、登录按钮），没有任何控制台报错（此时点登录还不会有反应，因为 `src/main.js` 还不存在，属于预期内的 404，Task 4 会补上）。

- [ ] **Step 5: Commit**

```bash
cd D:/focus_app
git add index.html style.css .gitignore
git commit -m "Add app shell (login + main screen) and design tokens"
```

---

### Task 3: Supabase 客户端接入

**Files:**
- Create: `src/config.js`
- Create: `src/supabaseClient.js`

**Interfaces:**
- Consumes: Task 1 产出的 Project URL / anon key
- Produces: `supabase`（从 `src/supabaseClient.js` 导出的已初始化客户端实例），供 `auth.js`、`data.js` 导入使用

- [ ] **Step 1: 写 config.js（填入自己的真实值）**

```javascript
export const SUPABASE_URL = '替换成你的 Project URL，例如 https://xxxxxxxx.supabase.co';
export const SUPABASE_ANON_KEY = '替换成你的 anon public key';
```

- [ ] **Step 2: 写 supabaseClient.js**

```javascript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

- [ ] **Step 3: 验证客户端能连上项目**

确保 `python -m http.server 8000` 还在跑，浏览器打开 `http://localhost:8000`，按 F12 打开控制台，粘贴：

```javascript
const { supabase } = await import('./src/supabaseClient.js');
const { data, error } = await supabase.auth.getSession();
console.log({ data, error });
```

预期：`error` 为 `null`，`data.session` 为 `null`（还没登录），且没有网络请求失败的报错。如果报 `Failed to fetch` 或域名解析失败，检查 `config.js` 里的 URL 有没有抄错。

- [ ] **Step 4: Commit**

```bash
cd D:/focus_app
git add src/supabaseClient.js
git commit -m "Add Supabase client setup"
```

注意：`src/config.js` 里的 anon key 是可以公开的（Supabase 用 RLS 保护数据，不是靠隐藏这个 key），所以正常提交即可，不需要额外加进 `.gitignore`。

---

### Task 4: 登录与主框架 —— auth.js + main.js 骨架

**Files:**
- Create: `src/auth.js`
- Create: `src/main.js`

**Interfaces:**
- Consumes: `supabase`（来自 `src/supabaseClient.js`）
- Produces: `signIn(email, password)`, `signOut()`, `getSession()`, `onAuthChange(callback)`（`src/auth.js` 导出，供 `src/main.js` 使用）
- Produces: `main.js` 里的 `refreshDashboard()` 函数与 `showApp()` 流程 —— Task 8（ui.js）、Task 9（专注仪式）、Task 10（睡前签到）都会依赖这里已经建立的登录后主流程

- [ ] **Step 1: 写 auth.js**

```javascript
import { supabase } from './supabaseClient.js';

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}
```

- [ ] **Step 2: 写 main.js（先写登录 + 主题切换部分，专注仪式和签到留空占位，Task 9/10 会继续往这个文件追加）**

```javascript
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
```

- [ ] **Step 3: 手动验证登录流程**

浏览器打开 `http://localhost:8000`，用 Task 1 创建的邮箱+密码登录：
1. 输错密码 → 应该看到"登录失败，请检查邮箱和密码"
2. 输对邮箱密码 → 登录卡片消失，出现"今天"主界面，顶部日期显示今天的日期和星期
3. 刷新页面（F5） → 应该直接进入主界面，不需要重新登录（session 已持久化）
4. 右上角点"切换到深色" → 背景变黑、强调色变成靛紫；再点一次变回浅色薰衣草紫

- [ ] **Step 4: Commit**

```bash
cd D:/focus_app
git add src/auth.js src/main.js
git commit -m "Add auth module and app shell login flow"
```

---

### Task 5: 连续天数/统计纯逻辑 —— streak.js

**Files:**
- Create: `src/streak.js`

**Interfaces:**
- Consumes: `sessions` 数组，元素形如 `{ type: 'focus'|'checkin', created_at: ISO字符串, actual_minutes?: number }`
- Produces: `toLocalDateStr(date)`, `parseLocalDate(dateStr)`, `daysWithActivity(sessions)`, `computeStreak(sessions, todayStr)`, `weeklyMinutes(sessions, todayStr)` —— 供 Task 8（ui.js）使用

- [ ] **Step 1: 写 streak.js**

```javascript
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
```

- [ ] **Step 2: 浏览器控制台验证**

`http://localhost:8000` 页面下 F12 控制台：

```javascript
const { computeStreak, weeklyMinutes, toLocalDateStr } = await import('./src/streak.js');

const sessions = [
  { type: 'focus', created_at: '2026-08-18T03:00:00.000Z', actual_minutes: 45 },
  { type: 'focus', created_at: '2026-08-17T03:00:00.000Z', actual_minutes: 25 },
  { type: 'checkin', created_at: '2026-08-15T20:00:00.000Z' },
];

console.log(computeStreak(sessions, '2026-08-18'));
// 期望：2（18号、17号连续，16号没有记录所以断了）

console.log(weeklyMinutes(sessions, '2026-08-18'));
// 期望：长度为7的数组，对应周一到周日；18号（周二）那一格是45，17号（周一）是25，其余是0
```

对照实际输出和期望是否一致；如果时区不对导致日期偏移，检查是不是哪里用了 `new Date('YYYY-MM-DD')` 而不是 `parseLocalDate`。

- [ ] **Step 3: Commit**

```bash
cd D:/focus_app
git add src/streak.js
git commit -m "Add streak and weekly stats pure logic"
```

---

### Task 6: 计时器纯逻辑 —— timer.js

**Files:**
- Create: `src/timer.js`

**Interfaces:**
- Produces: `createTimer({ totalSeconds, onTick, onComplete })`，返回 `{ start(), pause(), resume(), reset(), skip(), getRemaining() }`；`onComplete` 回调参数为 `{ completed: boolean, actualSeconds: number }` —— 供 Task 9（专注仪式联调）使用

- [ ] **Step 1: 写 timer.js**

```javascript
export function createTimer({ totalSeconds, onTick, onComplete }) {
  let remaining = totalSeconds;
  let intervalId = null;

  function tick() {
    remaining -= 1;
    onTick(remaining);
    if (remaining <= 0) {
      clearInterval(intervalId);
      intervalId = null;
      onComplete({ completed: true, actualSeconds: totalSeconds });
    }
  }

  function start() {
    if (intervalId) return;
    intervalId = setInterval(tick, 1000);
  }

  function pause() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function resume() {
    start();
  }

  function reset() {
    pause();
    remaining = totalSeconds;
    onTick(remaining);
  }

  function skip() {
    pause();
    const actualSeconds = totalSeconds - remaining;
    onComplete({ completed: false, actualSeconds });
  }

  function getRemaining() {
    return remaining;
  }

  return { start, pause, resume, reset, skip, getRemaining };
}
```

- [ ] **Step 2: 浏览器控制台验证**

`http://localhost:8000` 页面 F12 控制台：

```javascript
const { createTimer } = await import('./src/timer.js');
const t = createTimer({
  totalSeconds: 3,
  onTick: (r) => console.log('tick', r),
  onComplete: (res) => console.log('complete', res),
});
t.start();
```

等 3 秒，期望依次打印 `tick 2`、`tick 1`、`tick 0`、`complete {completed: true, actualSeconds: 3}`。再跑一次并在第 1 秒时调用 `t2.skip()`（新建一个 `t2` 单独测），期望打印 `complete {completed: false, actualSeconds: 1}` 左右（取决于点击时机）。

- [ ] **Step 3: Commit**

```bash
cd D:/focus_app
git add src/timer.js
git commit -m "Add countdown timer pure logic"
```

---

### Task 7: 数据层 —— data.js（增删查 + 离线队列）

**Files:**
- Create: `src/data.js`

**Interfaces:**
- Consumes: `supabase`（来自 `src/supabaseClient.js`）
- Produces: `makeId()`, `fetchSessions(sinceDays = 60)`, `insertSession(record)`（返回 `{ synced: boolean }`）, `flushQueue()`（返回 `{ flushed: number, remaining: number }`）, `queueLength()` —— 供 Task 9、Task 10 使用

- [ ] **Step 1: 写 data.js**

```javascript
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
  return raw ? JSON.parse(raw) : [];
}

export async function flushQueue() {
  const queue = readQueue();
  if (queue.length === 0) return { flushed: 0, remaining: 0 };
  const remaining = [];
  let flushed = 0;
  for (const record of queue) {
    const { error } = await supabase.from('sessions').upsert(record);
    if (error) remaining.push(record);
    else flushed += 1;
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return { flushed, remaining: remaining.length };
}

export function queueLength() {
  return readQueue().length;
}
```

- [ ] **Step 2: 验证在线写入**

先确保已经在页面登录（Task 4 的登录流程），F12 控制台：

```javascript
const { makeId, insertSession, fetchSessions } = await import('./src/data.js');
await insertSession({
  id: makeId(), type: 'checkin', task_name: null,
  planned_minutes: null, actual_minutes: null, completed: null,
  note: 'data.js 测试', created_at: new Date().toISOString(),
});
const rows = await fetchSessions();
console.log(rows);
```

期望：`rows` 里能看到刚插入的那条 `note: 'data.js 测试'` 记录。也可以去 Supabase Dashboard 的 Table Editor 里刷新 `sessions` 表确认。

- [ ] **Step 3: 验证离线队列**

浏览器 F12 → Network 面板 → 勾选 "Offline"（模拟断网）。控制台：

```javascript
const { makeId, insertSession, queueLength } = await import('./src/data.js');
const r = await insertSession({
  id: makeId(), type: 'checkin', task_name: null,
  planned_minutes: null, actual_minutes: null, completed: null,
  note: '离线测试', created_at: new Date().toISOString(),
});
console.log(r, queueLength());
```

期望：`r` 是 `{ synced: false }`，`queueLength()` 返回 1（说明写入失败后进了本地队列，没有报错崩溃）。

然后在 Network 面板取消勾选 "Offline"（恢复网络），控制台：

```javascript
const { flushQueue, fetchSessions } = await import('./src/data.js');
console.log(await flushQueue());
console.log(await fetchSessions());
```

期望：`flushQueue()` 返回 `{ flushed: 1, remaining: 0 }`，`fetchSessions()` 的结果里能看到 `note: '离线测试'` 那条记录。

- [ ] **Step 4: Commit**

```bash
cd D:/focus_app
git add src/data.js
git commit -m "Add sessions data layer with offline queue"
```

---

### Task 8: 看板渲染 —— ui.js

**Files:**
- Create: `src/ui.js`
- Modify: `src/main.js` — 把 `refreshDashboard()` 里的占位注释换成真实调用

**Interfaces:**
- Consumes: `computeStreak`, `daysWithActivity`, `weeklyMinutes`, `toLocalDateStr`, `parseLocalDate`（来自 `src/streak.js`）；DOM 元素 `streakNum`, `todayMinutes`, `todayCount`, `streakDots`, `weekBars`, `sessionList`（来自 `index.html`）
- Produces: `renderDashboard(sessions)` —— 供 `src/main.js` 调用

- [ ] **Step 1: 写 ui.js**

```javascript
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
  const max = Math.max(60, ...minutes);
  const container = document.getElementById('weekBars');
  container.innerHTML = '';
  minutes.forEach((m, i) => {
    const bar = document.createElement('i');
    const pct = Math.max(6, Math.round((m / max) * 100));
    bar.style.height = pct + '%';
    if (i === minutes.length - 1) bar.classList.add('today');
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
```

- [ ] **Step 2: 接入 main.js**

打开 `src/main.js`，把 Task 4 写的这一段：

```javascript
async function refreshDashboard() {
  // Task 8 会在这里接入 fetchSessions() + renderDashboard()
}
```

替换成：

```javascript
async function refreshDashboard() {
  const sessions = await fetchSessions();
  renderDashboard(sessions);
}
```

并在文件顶部的 import 区域加两行：

```javascript
import { fetchSessions, flushQueue } from './data.js';
import { renderDashboard } from './ui.js';
```

同时找到 `showApp()` 函数（Task 4 写的），在 `await refreshDashboard();` 这行之后追加离线补传逻辑，并注册"网络恢复"事件，让断网期间攒下的记录一联网就自动同步：

```javascript
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
```

- [ ] **Step 3: 手动验证**

刷新 `http://localhost:8000`，登录后应该能看到："连续天数"卡片里的数字、10个小圆点、本周柱状图、"今日记录"列表都基于 Task 7 测试时插入的数据变化（比如 checkin 测试记录会让今天的圆点变亮、连续天数至少是 1）。用 F12 控制台再插入一条 `type: 'focus', actual_minutes: 30, completed: true` 的记录后手动调用 `location.reload()`，确认"今日分钟"和"今日记录"列表相应更新。

- [ ] **Step 4: Commit**

```bash
cd D:/focus_app
git add src/ui.js src/main.js
git commit -m "Add dashboard rendering wired to real session data"
```

---

### Task 9: 专注仪式联调（main.js 追加）

**Files:**
- Modify: `src/main.js` — 在文件末尾（`boot();` 调用之前）追加专注仪式相关代码

**Interfaces:**
- Consumes: `createTimer`（来自 `src/timer.js`）；`makeId`, `insertSession`（来自 `src/data.js`）；DOM 元素 `taskNameInput`, `durationSegmented`, `ringProgress`, `ringTimeText`, `startBtn`, `timerControls`, `pauseResumeBtn`, `resetBtn`, `skipBtn`

- [ ] **Step 1: 在 main.js 顶部 import 区域追加**

```javascript
import { createTimer } from './timer.js';
import { makeId, insertSession } from './data.js';
```

- [ ] **Step 2: 在 `boot();` 这一行之前插入以下代码**

```javascript
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
```

- [ ] **Step 3: 手动验证**

刷新页面，登录后：
1. 时长选段点"25′" → 圆环下方数字变成 `25:00`
2. 任务名填"测试任务"，点"开始专注" → 按钮消失，出现暂停/重置/跳过三个按钮，数字开始每秒倒数，圆环同步变化
3. 点"暂停" → 数字停止变化，按钮文字变"继续"；点"继续" → 恢复倒数
4. 点"跳过" → 计时停止，"今日记录"卡片里出现一条"测试任务"，时长是跳过时刻的已用分钟数，且标了"中断"；"今日次数"+1
5. 把时长改成自定义 5 秒左右测试自然跑完（在控制台临时改 `selectedMinutes` 也行），确认跑完后自动记录且不带"中断"标记，界面自动回到"开始专注"按钮状态

- [ ] **Step 4: Commit**

```bash
cd D:/focus_app
git add src/main.js
git commit -m "Wire up focus ritual timer to session recording"
```

---

### Task 10: 睡前签到联调（main.js 追加）

**Files:**
- Modify: `src/main.js` — 在文件末尾（`boot();` 调用之前）追加签到相关代码

**Interfaces:**
- Consumes: `makeId`, `insertSession`（来自 `src/data.js`，Task 9 已 import）；DOM 元素 `checkinYesBtn`, `checkinNoBtn`, `noteInput`

- [ ] **Step 1: 在 `boot();` 这一行之前插入**

```javascript
document.getElementById('checkinYesBtn').addEventListener('click', () => saveCheckin(true));
document.getElementById('checkinNoBtn').addEventListener('click', () => saveCheckin(false));

async function saveCheckin(done) {
  if (!done) {
    alert('已记录，明天加油');
    return;
  }
  const note = document.getElementById('noteInput').value.trim();
  const record = {
    id: makeId(),
    type: 'checkin',
    task_name: null,
    planned_minutes: null,
    actual_minutes: null,
    completed: null,
    note: note || null,
    created_at: new Date().toISOString(),
  };
  await insertSession(record);
  await refreshDashboard();
  alert('已签到');
}
```

- [ ] **Step 2: 手动验证**

刷新页面，登录后，在"睡前签到"卡片：
1. 填"明天第一件事"输入框，点"没做到" → 弹出"已记录，明天加油"，但"今日记录"和连续天数不应该有变化（没写库）
2. 点"今天做到了" → 弹出"已签到"，看板刷新；如果今天还没有 focus 记录，连续天数应该 +1（因为 checkin 也算达标）
3. 去 Supabase Table Editor 刷新 `sessions` 表，确认能看到 `type = checkin` 且 `note` 是刚才填的内容的新记录

- [ ] **Step 3: Commit**

```bash
cd D:/focus_app
git add src/main.js
git commit -m "Wire up bedtime checkin to session recording"
```

---

### Task 11: 部署到 GitHub Pages

**Files:**
- 无新文件；操作 GitHub 仓库设置

**Interfaces:**
- Produces: 一个公网可访问的 URL（形如 `https://<username>.github.io/focus_app/`），供 Task 12（nativefier 打包）和手机浏览器使用

- [ ] **Step 1: 在 GitHub 上创建仓库并推送**

到 https://github.com 新建一个仓库（例如 `focus_app`，建议设为 Private，因为里面会包含你的 Supabase Project URL）。然后：

```bash
cd D:/focus_app
git remote add origin https://github.com/<你的用户名>/focus_app.git
git branch -M main
git push -u origin main
```

（这一步会推送代码到远程仓库，执行前请确认这是你想要的操作。）

- [ ] **Step 2: 开启 GitHub Pages**

仓库页面 → Settings → Pages → Source 选 "Deploy from a branch" → Branch 选 `main` / `/ (root)` → Save。等一两分钟，页面会显示发布后的网址，形如 `https://<用户名>.github.io/focus_app/`。

- [ ] **Step 3: 验证线上可访问**

浏览器打开该网址，应该看到和本地一样的登录界面，用 Task 1 的账号登录，确认能看到今天的看板数据（因为数据在 Supabase 云端，和本地跑的时候是同一份）。

- [ ] **Step 4: 手机验证**

用手机浏览器打开同一个网址，登录，确认能看到和电脑上一致的数据。浏览器菜单里选"添加到主屏幕"，桌面会出现一个图标，点击后以接近 App 的方式打开（无地址栏）。

---

### Task 12: 打包 Windows exe（nativefier）

**Files:**
- 无项目内文件改动；产出一个独立的 exe 文件夹（已在 `.gitignore` 里排除，不进版本库）

**Interfaces:**
- Consumes: Task 11 产出的公网 URL

- [ ] **Step 1: 安装 Node.js（本机目前没装，一次性操作）**

前往 https://nodejs.org 下载 LTS 版本安装包并安装（一路默认选项即可）。安装完成后开一个新的终端窗口，运行 `node -v` 确认能打印出版本号。

- [ ] **Step 2: 用 nativefier 打包**

```bash
cd D:/focus_app
npx nativefier@latest "https://<用户名>.github.io/focus_app/" --name "开工"
```

首次运行 `npx` 会临时下载 nativefier，等待几分钟。完成后当前目录下会出现一个 `开工-win32-x64` 文件夹（已被 `.gitignore` 排除）。

- [ ] **Step 3: 验证 exe**

进入 `开工-win32-x64` 文件夹，双击 `开工.exe`：
1. 应该弹出独立窗口（非浏览器地址栏样式），标题栏显示"开工"
2. 能正常登录、看到看板数据、跑一次专注计时并确认记录写入
3. 右键该 exe → 发送到 → 桌面快捷方式（或直接把整个文件夹固定到任务栏），方便以后打开

---

### Task 13: 端到端手动验收

**Files:**
- 无代码改动，对照设计文档「八、验证方式」逐条过一遍

- [ ] **Step 1: 跨设备同步**

电脑上（exe 或浏览器）做一次完整专注（选个短时长方便测试，比如自定义 1 分钟），跑完后打开手机浏览器（或已添加到主屏幕的图标），确认能看到刚才那条记录，且连续天数与电脑端一致。

- [ ] **Step 2: 离线补传**

电脑断网（或用浏览器 DevTools 的 Offline 模式），做一次专注并跑完，确认没有报错、界面依然正常记录（本地队列生效）；恢复网络后（或触发浏览器的 `online` 事件），确认 `showApp()` 里注册的自动补传生效，去 Supabase Table Editor 确认那条记录已经出现在云端。

- [ ] **Step 3: exe 可用性**

双击打包好的 `开工.exe`，确认能独立打开、图标显示正常、登录状态跟网页版共享（同一个 Supabase 账号）。

- [ ] **Step 4: 深浅色与强调色**

分别在浅色和深色模式下检查：浅色强调色应为薰衣草紫、深色强调色应为靛紫，专注计时器保持细圆环样式，与最终确认的效果图一致。

---

## Self-Review Notes

- **Spec coverage**：设计文档「四、核心功能模块」1-4 对应 Task 8-10；「五、数据模型」对应 Task 1 的 schema；「六、账号与同步」对应 Task 3-4；「七、异常处理」对应 Task 7 的离线队列 + Task 8 里 `showApp()` 接入的自动补传 + Task 13 Step 2 验收；「八、验证方式」对应 Task 13 全部；「九、视觉设计」的强调色/字体/计时器形状锁定在 Task 2 的 CSS 里、Task 13 Step 4 复查。
- **发现并修复的缺口**：最初草稿里 `showApp()` 只在登录后拉了一次数据，没有联动 Task 7 的离线队列，会导致断网期间攒的记录恢复网络后不会自动同步。已在 Task 8 Step 2 里把 `flushQueue()` 和 `window.addEventListener('online', ...)` 一并接进 `showApp()`，修复后 Task 13 Step 2 才有实际可验收的行为。
- **命名一致性**：`insertSession` / `fetchSessions` / `flushQueue` / `makeId`（data.js）、`computeStreak` / `weeklyMinutes` / `toLocalDateStr` / `parseLocalDate` / `daysWithActivity`（streak.js）、`createTimer`（timer.js）、`renderDashboard`（ui.js）、`signIn` / `getSession` / `onAuthChange`（auth.js）在各任务间保持一致，未出现改名不同步的情况。
