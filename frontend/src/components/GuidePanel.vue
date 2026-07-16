<template>
  <div class="guide">
    <div class="guide-head">
      <span class="eyebrow">从零开始</span>
      <h2>第一次用？跟着这几步，五分钟就能开始采集。</h2>
      <p>你不需要懂代码。整个过程就是：把手机连上电脑 → 打开工具 → 拿起手机翻商品 → 数据自动进库。</p>
    </div>

    <div class="prep">
      <div class="item"><span class="ico">📱</span><div><div class="h">一台安卓手机</div><div class="d">装好你要采的 App 或小程序，保持能正常浏览商品</div></div></div>
      <div class="item"><span class="ico">🔌</span><div><div class="h">一根 USB 数据线</div><div class="d">能传数据的线（不是只能充电的那种）</div></div></div>
      <div class="item"><span class="ico">💻</span><div><div class="h">一台电脑</div><div class="d">工具跑在电脑上，采集结果也存在电脑里，安全可控</div></div></div>
    </div>

    <div class="steps">
      <div class="step" v-for="s in steps" :key="s.n">
        <div class="num">{{ s.n }}</div>
        <div class="body">
          <h3>{{ s.title }}</h3>
          <p v-for="(p, i) in s.paras" :key="i" v-html="p"></p>
          <div class="tip" v-if="s.tip"><span class="tip-ic">💡</span><span v-html="s.tip"></span></div>
          <div class="sound-key" v-if="s.sounds">
            <span class="sk"><i style="background:var(--live)"></i>上扬"叮" = 成功入库</span>
            <span class="sk"><i style="background:var(--muted)"></i>低音 = 不是商品页，自动跳过</span>
          </div>
        </div>
      </div>
    </div>

    <div class="faq">
      <h3>常见问题</h3>
      <details v-for="(f, i) in faqs" :key="i">
        <summary>{{ f.q }}</summary>
        <div class="a" v-html="f.a"></div>
      </details>
    </div>
  </div>
</template>

<script setup>
const steps = [
  { n: 1, title: '把手机连上电脑，打开"调试模式"',
    paras: ['用数据线把手机插到电脑上。手机会弹出<b>"是否允许 USB 调试？"</b>——点<b>允许</b>（勾"一律允许"以后就不用再点）。',
            '然后把手机<b>解锁、屏幕保持常亮</b>（建议临时把息屏时间调到最长）。'],
    tip: '没弹"USB 调试"提示？先去手机的<b>设置 → 关于本机 → 连点版本号 7 次</b>打开"开发者选项"，再进去把"USB 调试"打开。' },
  { n: 2, title: '打开工具，选中你的手机',
    paras: ['在电脑浏览器打开工具，进入<b>「数据采集」</b>。左上角"设备"下拉里应该能看到你的手机——选它。',
            '右边的黑框会<b>实时显示手机当前画面</b>，说明连接成功了。'],
    tip: '下拉是空的？说明手机没连上——检查数据线、重插一次，或回第 1 步确认"USB 调试"点了允许。' },
  { n: 3, title: '填个批次名，选"自动入库"，点开始',
    paras: ['在<b>"采集批次"</b>框里随手起个名字，比如采牛奶就填 <code>milk</code>。这样以后好找、好导出。',
            '采集模式选<b>「💾 自动入库」</b>，点绿色的<b>「开始」</b>按钮——按钮变亮就是运行起来了。'] },
  { n: 4, title: '拿起手机，正常翻商品就行',
    paras: ['打开你要采的 App，翻到商品详情页，<b>停留 2~3 秒</b>——电脑"<b>叮</b>"一声，这个商品就被记下来了。翻下一个，再"叮"……',
            '你什么都不用在电脑上操作，一只手翻手机就行。系统自动读屏、提取品牌/价格/规格/卖点/配料并入库。'],
    sounds: true,
    tip: '<b>别在一个商品页里反复上下滑</b>——每滑一次可能会重复拍。翻到下一个商品即可。' },
  { n: 5, title: '逛完点"停止"，复核 + 导出',
    paras: ['翻完点<b>「停止」</b>，等队列清空的提示音。右边「已采集」列表能看到所有商品，点截图能放大核对。',
            '确认没问题，点<b>「✅ 一键全部复核」</b>批量通过；然后<b>「导出 CSV」</b>或<b>「导出 Excel（含截图）」</b>——一份带图带数据的表格就到手了。'] },
]
const faqs = [
  { q: '一直不响"叮"，是坏了吗？', a: '大概率是：① 每个商品页要<b>停够 2~3 秒</b>；② 手机必须<b>亮屏解锁</b>；③ 确认当前在商品<b>详情页</b>（列表页、首页不会采）。' },
  { q: '提示"暂停中（不在目标 App）"怎么办？', a: '这是保护机制——你切到了别的界面（比如回微信消息），系统会自动暂停拍摄，不误采隐私内容。回到目标 App 就自动继续。' },
  { q: '采到重复的商品了？', a: '正常。同页多拍了会自动标"重复"，复核时一眼能看到，删掉即可。系统宁可多采也不漏采——漏了的数据补不回来。' },
  { q: '数据会丢吗？存在哪？', a: '不会。所有数据和截图都存在<b>你自己的电脑</b>上。采集全程只读手机屏幕，<b>绝不点击、不下单、不碰你的账号</b>。' },
  { q: '微信小程序也能采吗？', a: '能。任意 App 和小程序都支持。走小程序采集时，记得<b>填一个批次名</b>，方便事后归类。' },
]
</script>

<style scoped>
.guide { padding: 8px 2px 24px; }
.guide-head { max-width: 66ch; margin-bottom: 24px; }
.eyebrow { font-family: var(--mono); font-size: 11px; letter-spacing: .2em; color: var(--sig); text-transform: uppercase; }
.guide-head h2 { font-size: 26px; letter-spacing: -.02em; margin: 12px 0 8px; color: var(--ink); }
.guide-head p { color: var(--ink-2); font-size: 15px; line-height: 1.7; margin: 0; }
.prep { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 28px; }
@media (max-width: 720px){ .prep { grid-template-columns: 1fr; } }
.prep .item { background: var(--panel); border: 1px solid var(--line); border-radius: 11px; padding: 14px; display: flex; gap: 11px; align-items: flex-start; }
.prep .ico { font-size: 20px; }
.prep .h { font-size: 13.5px; font-weight: 600; color: var(--ink); }
.prep .d { font-size: 12px; color: var(--muted); margin-top: 2px; line-height: 1.5; }
.steps { display: grid; gap: 12px; margin-bottom: 30px; }
.step { display: grid; grid-template-columns: 46px 1fr; gap: 16px; background: var(--panel); border: 1px solid var(--line); border-radius: 13px; padding: 16px 18px; align-items: start; }
.step .num { width: 40px; height: 40px; border-radius: 11px; background: var(--sig-soft); color: var(--sig); font-family: var(--mono); font-size: 17px; font-weight: 700; display: grid; place-items: center; border: 1px solid color-mix(in srgb,var(--sig) 30%,transparent); }
.step h3 { margin: 3px 0 8px; font-size: 15.5px; color: var(--ink); }
.step p { margin: 0 0 8px; color: var(--ink-2); font-size: 14px; line-height: 1.7; }
.step p :deep(b) { color: var(--ink); font-weight: 600; }
.step :deep(code) { font-family: var(--mono); font-size: 12px; background: var(--panel-2); border: 1px solid var(--line-soft); border-radius: 5px; padding: 1px 6px; color: var(--live); }
.tip { display: flex; gap: 9px; align-items: flex-start; margin-top: 10px; padding: 9px 12px; background: color-mix(in srgb,var(--amber) 9%,transparent); border-radius: 9px; font-size: 12.5px; color: var(--ink-2); line-height: 1.6; }
.tip :deep(b) { color: var(--amber); }
.tip-ic { flex: none; }
.sound-key { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.sk { font-size: 12px; color: var(--ink-2); display: inline-flex; align-items: center; gap: 7px; background: var(--panel-2); border: 1px solid var(--line-soft); border-radius: 20px; padding: 5px 11px; }
.sk i { width: 8px; height: 8px; border-radius: 50%; }
.faq h3 { font-family: var(--mono); font-size: 12px; letter-spacing: .12em; color: var(--muted); text-transform: uppercase; margin: 0 0 12px; }
.faq details { border: 1px solid var(--line); border-radius: 10px; background: var(--panel); margin-bottom: 8px; }
.faq summary { cursor: pointer; padding: 13px 16px; font-size: 14px; font-weight: 600; color: var(--ink); list-style: none; display: flex; justify-content: space-between; align-items: center; }
.faq summary::-webkit-details-marker { display: none; }
.faq summary::after { content: "+"; font-family: var(--mono); color: var(--sig); font-size: 18px; }
.faq details[open] summary::after { content: "−"; }
.faq .a { padding: 0 16px 14px; color: var(--ink-2); font-size: 13.5px; line-height: 1.7; }
.faq .a :deep(b) { color: var(--ink); }
</style>
