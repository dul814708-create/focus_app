# 交接文档 —— 开工（防拖延工具）

写给完全没有上下文的新会话看。上一个会话（从头设计到部署）已经结束，这份文档是唯一的记忆延续。

## 一、这是什么项目

个人防拖延 / 专注计时工具，代号"开工"。属于一个更大计划的**第一阶段**：

- **第一阶段（本仓库，已完成）**：防拖延核心功能 + 平台地基（登录、同步、电脑exe/手机网页）
- **第二阶段（未开始）**：学习工作台（课表、考试倒计时、任务管理、备忘录），接在同一个平台上
- **不在这个项目里**：小红书收藏整理，那是一个完全独立的项目，方案是飞书多维表格 + MacroDroid + Tampermonkey，跟这个仓库无关，不要混进来

设计背景和完整需求见 [`docs/superpowers/specs/2026-08-18-focus-app-design.md`](docs/superpowers/specs/2026-08-18-focus-app-design.md)。核心是：用户容易拖延、被手机打断，以前装过同类工具但新鲜劲一过就弃用了。所以这版刻意做得简单——**没有**强制拦截网站/应用、**没有**push通知、**没有**开机自启动、**没有**真人监督打卡，纯靠"开场仪式 + 连续天数 + 数据反馈"这套自我激励机制。改动这些克制的设计决策之前，先确认这是不是又要走回"功能一大堆但没人用"的老路。

## 二、技术栈 & 架构

- **纯前端**，原生 HTML/CSS/JS（ES Modules），**没有构建工具**，没有 npm/webpack/vite，改代码不需要编译
- **Supabase**（Postgres + Auth）做后端，单用户，登录用邮箱密码，数据表用行级安全（RLS）保护
- **部署**：GitHub Pages，仓库 https://github.com/dul814708-create/focus_app （**Public** 仓库 —— 免费 GitHub 账号的 Pages 功能只支持公开仓库，这是特意改成 Public 的，不是失误）
- **在线地址**：https://dul814708-create.github.io/focus_app/
- **电脑端 exe**：用 [nativefier](https://github.com/nativefier/nativefier) 把上面那个网址包了一层壳，产物在 `D:\focus_app\开工-win32-x64\开工.exe`（这个文件夹被 gitignore 了，不在仓库里，本地丢了要重新跑 nativefier 命令生成）

### 文件结构

```
index.html / style.css          —— 页面骨架 + 全部样式（含亮/暗主题 token）
src/config.js                    —— Supabase 项目 URL + anon/publishable key（这个可以放心提交，见下）
src/supabaseClient.js            —— 初始化 Supabase 客户端
src/auth.js                      —— 登录/登出/取会话
src/streak.js                    —— 连续天数、周统计，纯函数，无 DOM 依赖
src/timer.js                     —— 倒计时逻辑，纯函数，无 DOM 依赖
src/data.js                      —— sessions 表增删查 + 离线队列
src/ui.js                        —— 看板渲染（纯渲染，不含事件绑定）
src/main.js                      —— 入口，事件绑定，全部交互逻辑在这（最大的文件，属正常）
supabase/schema.sql              —— 建表 SQL
docs/superpowers/specs/          —— 设计文档
docs/superpowers/plans/          —— 实施计划（13个任务，全部走完了）
```

### 数据模型

单张 `sessions` 表：`id`（客户端生成的 uuid，用于去重）、`user_id`（默认 `auth.uid()`）、`type`（`'focus'` | `'checkin'` | `'miss'`）、`task_name`、`planned_minutes`、`actual_minutes`、`completed`、`note`、`created_at`。RLS 策略：`auth.uid() = user_id`。

**连续天数规则**：当天有任意一条 `focus` 或 `checkin` 记录就算达标；`miss`（记录"为什么没做到"用的类型）**不算**达标，也**不能算**——这是故意的，改这块逻辑之前一定要看 `src/streak.js` 的 `daysWithActivity()`。今天还没记录时，看板显示的是**昨天**的连续天数（不是直接归零），只有过了一整天没记录才真的归零。

## 三、已完成的工作

用 `superpowers:subagent-driven-development` 流程做的，13 个计划任务全部完成并逐个 review 过，之后又做了一轮全量分支审查，抓出 2 个 Critical + 8 个 Important 问题（离线时界面卡死、断网自动补传失效、周统计高亮错天、缺离线提示、登录过期没处理、计时器后台限流会计时不准、打包成exe后自定义时长会崩、专注记录时间戳算错跨午夜的情况），全部修完并二次审查通过。

之后又加了两版功能/优化：
1. **原因标签 + 最小第一步**：专注中断或睡前"没做到"时，可以选一个原因标签（太累/被打断/不想做/忘了打开），选填不强制；专注前可以填"最小的第一步"降低启动门槛。为此改过一次 Supabase 的 `type` 字段约束（加了 `'miss'`）。
2. **界面动效打磨**：原因标签展开用了滑入动画，时长选择器加了滑动选中背景，按钮加了按压反馈。全部纯 CSS，没引入动画库。

功能上：登录、专注计时、连续天数看板、周统计、今日记录、睡前签到、原因标签，电脑手机数据实时同步，断网自动补传到本地队列、联网后自动重试。**已经端到端手动验证过，用户确认"都正常"。**

## 四、后续计划（第二阶段，还没开始）

学习工作台，接在同一套账号/同步/exe/网页壳上，大致包含：
- 课表 / 日程
- 考试倒计时
- 任务管理（待办事项，跟"专注仪式"是两回事，不要混着设计）
- 备忘录 / 资料整理
- 可能还要"大学生活 / 备考冲刺 / 实习与生活"这种场景切换（原 Obsidian 版本里有）

**这些都还没细聊**，具体交互、数据模型、要不要提醒功能都没定。用户说了"你说开始我们再展开"——**不要自己揣测着开始做**，先按 `superpowers:brainstorming` 流程走一遍设计、出 spec、出 plan，走完用户确认后再进 `subagent-driven-development` 实施。这是本项目一直在用的固定流程，第二阶段也应该照做。

## 五、需要向用户确认的事

- 第二阶段具体什么时候开始、想要哪些细节功能——目前完全没聊过，不要假设
- 如果发现第一阶段哪里用起来不顺手（比如提到过的"最好成绩记录""周/月统计里的月维度"这些设计文档里提过但没做的东西），要不要现在补，还是先放着

## 六、踩过的坑（不要再踩）

1. **nativefier 打包在默认 npm 缓存路径下必现报错**：`Error copying electron app... UNKNOWN: unknown error, copyfile`，换了缓存清理、换了 `--tmpdir` 参数都没用。真正有效的修法是把 npm 的 cache 和 prefix 都挪到 D 盘再全局装：
   ```bash
   npm config set cache "D:/npm-cache" --global
   npm config set prefix "D:/npm-global" --global
   npm install --global nativefier
   nativefier "https://dul814708-create.github.io/focus_app/" --name "开工"
   ```
   不要再用 `npx nativefier` 直接跑，会复现同样的报错。

2. **Node.js 装在 `D:\Program Files\Nodejs\`，不是默认的 `C:\Program Files\nodejs\`**。而且这个会话用的 Bash/PowerShell 工具每次调用都是新 shell，PATH 不会持久化，每次要跑 node/npm/nativefier 相关命令都得自己加：
   ```bash
   export PATH="/d/Program Files/Nodejs:/d/npm-global:$PATH"
   ```

3. **CSS `grid-template-rows: 0fr → 1fr` 的展开动画技巧在这个项目实测环境里不生效**（class 加上去了、样式规则也对，但 computed 值就是卡在 0px，原因不明，可能是这套工具链背后的浏览器引擎版本问题）。改用了更朴素的 `max-height` + `opacity` 过渡，实测有效。以后要做类似的"展开/收起"动画，直接用 `max-height` 方案，不要再选 grid-rows 这个技巧，会白费时间调试。

4. **Supabase 免费版的 Pages 类比坑**：GitHub 免费账号的 Pages 功能**只支持公开仓库**，私有仓库要 GitHub Pro 以上才能开。仓库确认过没有真正敏感信息（只有 Supabase 的 anon/publishable key，设计上就是给前端用的，靠 RLS 保护数据，不是靠隐藏 key）之后才改成了 Public，这是经过用户确认的决定。

5. **`git push` 第一次卡住超时**，大概率是 Windows Credential Manager 弹了个看不见的授权窗口在等用户点。遇到卡住不要一直重试轮询，先让用户看一眼有没有弹窗，然后再重试一次通常就好了。

6. **`git worktree remove` 报 "Permission denied"**：是之前某个子代理起的 `python -m http.server` 忘了关，进程锁着那个目录。查 `tasklist` 找到 python.exe 的 PID，`taskkill //F //PID <pid>` 杀掉再删。以后本地测试完要记得关服务器进程。

7. **Supabase 新项目的 key 现在叫 "Publishable key" 不是 "anon public"**，是同一个东西，改名了而已。`SUPABASE_URL` 必须是项目根地址（`https://xxx.supabase.co`），不是 `/rest/v1/` 那个 REST 端点——用户一开始贴的是带 `/rest/v1/` 的，要记得去掉。

8. **`.superpowers/sdd/` 这个 SDD 流程的临时工作区目录，只有在 worktree 里跑 `sdd-workspace` 脚本时才会自动生成自忽略的 `.gitignore`**。如果之后直接在主仓库（不开 worktree）里做类似的临时任务记录，别忘了手动把 `.superpowers/` 加进 `.gitignore`，不然这些临时文件会被 `git add` 进去。

9. **Supabase 的 `.upsert()` 是整行替换，不是局部更新**。比如"给已保存的记录补一个原因标签"，绝对不能只传 `{id, note}`，会把 `task_name`/`planned_minutes` 等其他字段清空。必须带上完整记录：`{...原记录, note: 新值}`。

10. **Electron 不支持 `window.prompt()`**，网页里能用、打包成 exe 就会直接报错崩溃。自定义时长输入那里已经改成了普通的 `<input type="number">`，以后别的地方也别用 `prompt()`/`confirm()`。

11. **`setInterval` 计时器在窗口被系统限流/切到后台时会计时不准**（这个 app 的核心使用场景就是"开始计时后切到别的窗口干活"，正好是最容易触发限流的情况）。`timer.js` 已经改成基于 `Date.now()` 的挂钟时间计算剩余时间，不是靠数 tick，以后碰到类似的计时需求直接抄这个思路，别再用简单的递减计数器。

12. **`fetchSessions()` 会 throw，`insertSession()` 不会 throw**（后者失败了会自己存本地队列）。两者混用时如果不加 try/catch，离线状态下会导致后续代码（比如重置界面状态）根本不执行，界面卡死。`saveFocusSession`/`saveCheckin` 里已经把 `refreshDashboard()` 包了 try/catch，以后加新的类似流程要保持这个模式。

13. **打包成 exe 之后，改了网页代码要让 exe 生效，光重启不一定够**——Electron 自己缓存资源，有时候要完全退出（连托盘图标一起，或者去任务管理器确认进程真的没了）才会重新拉取，实在不行删掉 `%APPDATA%\开工\Cache` 再开。

## 七、其他提醒

- 用户不太会写代码，交流用中文，喜欢直接明确的答案，不喜欢绕弯子
- 这是个人项目，不需要自动化测试框架，之前全程都是"代码走查 + 手工推演 + curl 验证 + 最后用户自己手动过一遍"，这个验证方式是经过讨论确认的，不是偷懒，别自作主张加测试框架
- 改动前如果涉及产品/设计层面的决策（不是纯 bug 修复），先问用户，别自己拍板——这个项目从头到尾的设计决策都是一步步问出来确认的
