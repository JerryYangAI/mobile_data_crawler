<template>
  <div class="story">
    <div class="col-main">
      <div class="eyebrow">A SOLO BUILD · 开发者的话</div>
      <h2>我一个人，把一台安卓手机<br>教成了会自己<em>逛店记账</em>的爬虫。</h2>
      <div class="prose">
        <p>最开始，它只是个"手机操作 Agent"——能看屏幕、能点能滑，但采下来的数据只躺在日志里，谈不上"工具"。</p>
        <p>为了让它真正能干活，我给它加了<strong>稳定的截图证据链、采集状态管理、多模态字段提取、去重指纹、复核队列、一键导出</strong>；又做了<strong>自动轮询模式</strong>——你只管拿着手机翻页，听到"叮"一声，一个商品就被结构化收进库里。从"能操作"到"能采集"，中间是无数个调参数、修边界情况、跟超时和限流死磕的夜晚。</p>
        <p>现在，它能从<strong>任意一个 App 或微信小程序</strong>里，把你想要的<strong>任意品类、任意商品的数据</strong>一条条采下来——不需要网页版、不需要接口，只要手机上能看到的，它就能结构化地记下来。这是我一行行写出来、一次次实测跑通的东西。</p>
        <p>如果它帮你省下了时间，或者给了你继续开发的灵感——<strong>请我扫码喝杯咖啡吧</strong>。你的每一笔赞助，都会变成我继续把它做得更好的动力。 🙌</p>
      </div>

      <div class="usecase">
        <div class="uc-tag">场景案例 · 一个真实的用法</div>
        <p class="uc-body">你要做一份<strong>牛奶品类的市场调研</strong>：想把某个商超 App 上<strong>所有和"牛奶"相关的商品</strong>——品牌、规格、价格、卖点、配料——全部扒下来做对比分析。</p>
        <p class="uc-body">过去这得靠人一条条截图、手动抄进表格，几百个 SKU 抄到眼花。用这个工具：打开那个 App，搜"牛奶"，开启自动采集，<strong>一边翻页一边自动入库</strong>，翻完导出 Excel（带截图）——几百条结构化数据，一杯咖啡的时间就到手了。</p>
      </div>

      <ul class="milestones">
        <li><b>L1</b>手动截图 → 多模态提取 → 结构化入库</li>
        <li><b>L1.5</b>帧变化检测 + 自动轮询，解放双手</li>
        <li><b>全能</b>任意 App / 小程序 · 任意品类 · 任意商品</li>
        <li><b>可导出</b>CSV / 带截图 Excel，即拿即用做分析</li>
      </ul>

      <a class="gh-link" :href="githubUrl" target="_blank" rel="noreferrer">⭐ 觉得有用？去 GitHub 点个 Star 支持一下 →</a>
    </div>

    <div class="col-qr">
      <div class="qr-card">
        <div class="hd">☕ 赞助这个工具</div>
        <div class="sub">微信扫一扫，金额随意。<br>你的支持是独立开发者最实在的鼓励。</div>
        <div class="qr-frame">
          <img :src="qrSrc" alt="微信收款码" class="qr-img" @error="qrOk = false" v-show="qrOk" />
          <div class="qr-ph" v-if="!qrOk">
            <div class="qr-ph-ic">📷</div>
            <div class="qr-ph-t">收款码待放入</div>
            <div class="qr-ph-d">把微信收款码图片存为<br><code>frontend/public/wechat-pay-qr.png</code></div>
          </div>
        </div>
        <div class="wx-badge">
          <svg viewBox="0 0 24 24" fill="currentColor" width="17" height="17"><circle cx="12" cy="12" r="10" opacity=".18"/><path d="M8 12l2.4 2 5-5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          微信支付 · JY(*广)
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
defineProps({ githubUrl: { type: String, default: '#' } })
// 微信收款码：放到 frontend/public/wechat-pay-qr.png 即自动显示；未放则显示占位提示
const qrSrc = ref('/wechat-pay-qr.png')
const qrOk = ref(true)
</script>

<style scoped>
.story { display: grid; grid-template-columns: 1.5fr 1fr; gap: 28px; align-items: start; padding: 8px 2px 20px; }
@media (max-width: 860px){ .story { grid-template-columns: 1fr; } }
.eyebrow { font-family: var(--mono); font-size: 11px; letter-spacing: .22em; color: var(--sig); text-transform: uppercase; }
h2 { font-size: 29px; line-height: 1.18; letter-spacing: -.02em; margin: 12px 0 0; color: var(--ink); }
h2 em { font-style: normal; color: var(--sig); }
.prose { color: var(--ink-2); font-size: 15px; line-height: 1.75; margin-top: 18px; max-width: 60ch; }
.prose p { margin: 0 0 14px; }
.prose strong { color: var(--ink); font-weight: 600; }
.usecase { margin-top: 22px; background: var(--panel); border: 1px solid var(--line); border-left: 3px solid var(--sig); border-radius: 12px; padding: 16px 18px; }
.uc-tag { font-family: var(--mono); font-size: 10px; letter-spacing: .16em; color: var(--sig); text-transform: uppercase; margin-bottom: 9px; }
.uc-body { color: var(--ink-2); font-size: 14px; line-height: 1.7; margin: 0 0 10px; }
.uc-body:last-child { margin-bottom: 0; }
.uc-body strong { color: var(--ink); font-weight: 600; }
.milestones { list-style: none; padding: 0; margin: 22px 0 0; display: grid; gap: 0; border-left: 2px solid var(--line); }
.milestones li { position: relative; padding: 9px 0 9px 20px; font-size: 13.5px; color: var(--ink-2); }
.milestones li::before { content:""; position:absolute; left:-5px; top:15px; width:8px; height:8px; border-radius:50%; background: var(--sig); box-shadow: 0 0 0 3px var(--bg); }
.milestones li b { color: var(--ink); font-family: var(--mono); font-size: 12px; margin-right: 8px; }
.gh-link { display: inline-block; margin-top: 20px; color: var(--sig); font-size: 13px; font-weight: 600; text-decoration: none; }
.gh-link:hover { text-decoration: underline; }

.qr-card { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 22px; text-align: center; position: sticky; top: 78px; }
.hd { font-size: 15px; font-weight: 700; color: var(--ink); }
.sub { font-size: 12.5px; color: var(--muted); margin-top: 5px; line-height: 1.5; }
.qr-frame { width: 200px; height: 200px; margin: 18px auto 0; border-radius: 14px; background: #fff; padding: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.35); display: grid; place-items: center; }
.qr-img { width: 100%; height: 100%; object-fit: contain; }
.qr-ph { color: #64748b; }
.qr-ph-ic { font-size: 30px; }
.qr-ph-t { font-size: 13px; font-weight: 700; margin-top: 6px; color: #334155; }
.qr-ph-d { font-size: 10px; margin-top: 8px; line-height: 1.5; }
.qr-ph-d code { font-family: var(--mono); background: #f1f5f9; border-radius: 4px; padding: 1px 4px; color: #b91c1c; }
.wx-badge { display: inline-flex; align-items: center; gap: 7px; margin-top: 16px; color: var(--live); font-size: 13px; font-weight: 600; }
</style>
