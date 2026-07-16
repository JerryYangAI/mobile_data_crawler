<template>
  <!-- 开屏 -->
  <div class="splash" v-if="isLoading">
    <div class="splash-in">
      <div class="splash-mark">
        <span class="sm-glyph">🕷</span>
        <span class="sm-ring"></span>
      </div>
      <h1 class="splash-title">手机<span class="hl">AI爬虫</span>工具</h1>
      <div class="splash-sub">PHONE-AI-CRAWLER · 任意 App · 任意品类 · 任意商品</div>
      <div class="splash-bar"><span></span></div>
    </div>
  </div>

  <div class="app" v-else>
    <!-- 顶栏 -->
    <header class="cmd">
      <div class="cmd-in">
        <div class="brand">
          <span class="mark">🕷</span>
          <div>
            <h1>手机AI爬虫工具</h1>
            <div class="tag">PHONE-AI-CRAWLER · v2.0</div>
          </div>
        </div>
        <div class="cmd-right">
          <a class="ghost" :href="GITHUB_URL" target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M12 2C6.5 2 2 6.6 2 12.2c0 4.5 2.9 8.3 6.8 9.6.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.4-3.4-1.4-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .8.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.3 9.3 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10.2 10.2 0 0 0 22 12.2C22 6.6 17.5 2 12 2z"/></svg>
            GitHub
          </a>
          <button class="ghost sponsor" @click="activeTab = 'sponsor'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.5-9.5-9C.7 8.5 2.2 5 5.5 5 7.5 5 9 6.2 12 9c3-2.8 4.5-4 6.5-4 3.3 0 4.8 3.5 3 7-2.5 4.5-9.5 9-9.5 9z"/></svg>
            赞助支持
          </button>
          <span class="status"><span class="dot"></span>ONLINE</span>
        </div>
      </div>
    </header>

    <main class="app-main">
      <el-tabs v-model="activeTab" class="mode-tabs">
        <el-tab-pane label="🤖 Agent 模式" name="agent"><ControlPanel /></el-tab-pane>
        <el-tab-pane label="📊 数据采集" name="collector" lazy><CollectorPanel /></el-tab-pane>
        <el-tab-pane label="❤ 赞助支持" name="sponsor" lazy><SponsorPanel :github-url="GITHUB_URL" /></el-tab-pane>
        <el-tab-pane label="📖 小白用户指南" name="guide" lazy><GuidePanel /></el-tab-pane>
      </el-tabs>
    </main>

    <footer class="app-foot">手机AI爬虫工具 · 由 JY(广哥) 独立开发与维护 · <a :href="GITHUB_URL" target="_blank" rel="noreferrer">{{ GITHUB_URL.replace('https://', '') }}</a></footer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import ControlPanel from './components/ControlPanel.vue'
import CollectorPanel from './components/CollectorPanel.vue'
import SponsorPanel from './components/SponsorPanel.vue'
import GuidePanel from './components/GuidePanel.vue'

const GITHUB_URL = 'https://github.com/JerryYangAI/mobile_data_crawler'
const isLoading = ref(true)
const activeTab = ref('collector')

onMounted(() => {
  setTimeout(() => { isLoading.value = false }, 2600)
})
</script>

<style>
/* ── 开屏 ── */
.splash { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center;
  background: radial-gradient(circle at 50% 40%, #12161d 0%, #05070b 100%); }
.splash-in { text-align: center; }
.splash-mark { position: relative; width: 88px; height: 88px; margin: 0 auto 26px; display: grid; place-items: center; }
.sm-glyph { font-size: 46px; filter: drop-shadow(0 0 18px rgba(255,90,31,.5)); animation: float 3s ease-in-out infinite; }
.sm-ring { position: absolute; inset: 0; border: 2px solid transparent; border-top-color: #FF5A1F; border-right-color: #FF5A1F;
  border-radius: 50%; animation: spin 2.4s linear infinite; }
.splash-title { color: #fff; font-size: 34px; font-weight: 800; letter-spacing: 2px; margin: 0;
  opacity: 0; animation: fadeUp .8s .3s forwards; }
.splash-title .hl { color: #FF5A1F; }
.splash-sub { font-family: ui-monospace, Menlo, monospace; color: #6B7688; font-size: 12px; letter-spacing: .12em; margin-top: 12px;
  opacity: 0; animation: fadeUp .8s .6s forwards; }
.splash-bar { width: 180px; height: 3px; background: rgba(255,255,255,.08); border-radius: 2px; margin: 30px auto 0; overflow: hidden;
  opacity: 0; animation: fadeUp .8s .9s forwards; }
.splash-bar span { display: block; height: 100%; width: 40%; background: linear-gradient(90deg,#FF5A1F,#24E39B); border-radius: 2px; animation: load 1.6s ease-in-out infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes float { 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(-8px); } }
@keyframes fadeUp { to { opacity: 1; transform: translateY(0); } from { opacity: 0; transform: translateY(12px); } }
@keyframes load { 0%{ transform: translateX(-100%); } 100%{ transform: translateX(350%); } }

/* ── 顶栏 ── */
.app { min-height: 100vh; display: flex; flex-direction: column; }
.cmd { position: sticky; top: 0; z-index: 40; background: rgba(11,14,19,.82); backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--line); }
.cmd-in { max-width: 1440px; margin: 0 auto; height: 60px; padding: 0 26px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.brand { display: flex; align-items: center; gap: 12px; }
.brand .mark { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; font-size: 19px;
  background: linear-gradient(150deg, #FF5A1F, #C8340A); box-shadow: 0 0 0 1px rgba(255,90,31,.4), 0 6px 20px rgba(255,90,31,.28); }
.brand h1 { font-size: 16px; margin: 0; font-weight: 700; color: var(--ink); letter-spacing: -.01em; }
.brand .tag { font-family: var(--mono); font-size: 10px; color: var(--muted); letter-spacing: .08em; }
.cmd-right { display: flex; align-items: center; gap: 8px; }
.ghost { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 13px; border: 1px solid var(--line);
  border-radius: 9px; background: var(--panel); color: var(--ink-2); font-size: 13px; font-weight: 500; text-decoration: none; cursor: pointer;
  transition: border-color .18s, color .18s, transform .18s; }
.ghost:hover { border-color: color-mix(in srgb, var(--sig) 55%, var(--line)); color: var(--ink); transform: translateY(-1px); }
.ghost.sponsor { border-color: color-mix(in srgb, var(--sig) 50%, var(--line)); color: var(--sig); }
.ghost.sponsor:hover { background: var(--sig-soft); }
.status { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 12px; border-radius: 9px;
  background: color-mix(in srgb, var(--live) 12%, transparent); color: var(--live); font-family: var(--mono); font-size: 11px; font-weight: 600; letter-spacing: .06em; }
.status .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--live); animation: pulse 2.2s infinite; }
@keyframes pulse { 0%{ box-shadow: 0 0 0 0 color-mix(in srgb,var(--live) 60%,transparent); } 70%{ box-shadow: 0 0 0 7px transparent; } }

.app-main { flex: 1; max-width: 1440px; width: 100%; margin: 0 auto; padding: 18px 26px 40px; box-sizing: border-box; }
.app-foot { text-align: center; color: var(--muted); font-size: 12px; font-family: var(--mono); padding: 22px 0 34px; letter-spacing: .03em; }
.app-foot a { color: var(--sig); text-decoration: none; }

/* Element Plus tabs 暗色微调 */
.mode-tabs .el-tabs__item { font-weight: 600; }
.mode-tabs .el-tabs__item.is-active { color: var(--sig); }
.mode-tabs .el-tabs__active-bar { background: var(--sig); }
</style>
