<template>
  <el-row :gutter="24">
    <!-- 左栏：设备 + 手机画面 + 手动提取 + 自动采集控制 -->
    <el-col :span="9">
      <el-card shadow="never" class="panel-card">
        <template #header>
          <div class="card-header">
            <span>📱 手机画面</span>
            <el-button size="small" @click="refreshDevices">刷新设备</el-button>
          </div>
        </template>

        <el-form label-width="80px">
          <el-form-item label="设备">
            <el-select v-model="deviceSerial" placeholder="选择设备" style="width: 100%">
              <el-option
                v-for="d in devices"
                :key="d.serial"
                :label="`${d.model} (${d.serial})`"
                :value="d.serial"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="采集批次">
            <el-input v-model="batchName" placeholder="默认按日期分批" />
          </el-form-item>
        </el-form>

        <div class="screen-preview">
          <img v-if="screenshotUrl" :src="screenshotUrl" alt="手机画面" />
          <el-empty v-else description="选择设备后显示画面" :image-size="80" />
        </div>

        <div class="action-bar">
          <el-button size="small" @click="refreshScreen" :disabled="!deviceSerial">刷新画面</el-button>
          <el-button
            type="primary"
            size="large"
            :loading="extracting"
            :disabled="!deviceSerial"
            @click="extractCurrent"
          >
            📸 提取当前屏幕商品信息
          </el-button>
        </div>

        <!-- L1.5 自动轮询 -->
        <el-card shadow="never" class="auto-card" :class="{ 'auto-running': autoRunning }">
          <template #header>
            <div class="card-header">
              <span>⚡ 自动采集 (L1.5)</span>
              <el-tag v-if="autoRunning" :type="autoPaused ? 'warning' : 'success'" effect="dark" size="small">
                {{ autoPaused ? '⏸ 暂停中(不在目标App)' : '● 运行中' }}
              </el-tag>
            </div>
          </template>

          <div class="auto-controls">
            <el-radio-group v-model="autoMode" :disabled="autoRunning" size="small">
              <el-radio-button value="shadow">🕶 影子模式(不入库)</el-radio-button>
              <el-radio-button value="auto">💾 自动入库</el-radio-button>
            </el-radio-group>
            <el-button
              v-if="!autoRunning"
              type="success"
              :disabled="!deviceSerial"
              @click="startAuto"
            >▶ 开始</el-button>
            <el-button v-else type="danger" @click="stopAuto">■ 停止</el-button>
          </div>

          <div v-if="autoStats" class="auto-stats">
            <span>捕获 <b>{{ autoStats.candidates }}</b></span>
            <span>已提取 <b>{{ autoStats.extracted }}</b></span>
            <span>商品 <b class="stat-product">{{ autoStats.products }}</b></span>
            <span>非商品 <b>{{ autoStats.nonProduct }}</b></span>
            <span>队列 <b :class="{ 'stat-queue': autoStats.queueDepth > 0 }">{{ autoStats.queueDepth }}</b></span>
            <span v-if="autoMode === 'auto'">入库 <b class="stat-product">{{ autoStats.saved }}</b></span>
          </div>

          <div v-if="autoEvents.length" class="auto-log">
            <div v-for="(e, i) in autoEvents" :key="i" class="auto-log-line">
              <span class="log-time">{{ e.time }}</span>
              <span :class="`log-${e.kind}`">{{ e.text }}</span>
            </div>
          </div>

          <div class="auto-hint" v-if="!autoRunning">
            提示：先用影子模式逛一轮，对比自动捕获数和你实际浏览数，捕获率达标再切自动入库。
            运行中请每个商品页停留 2~3 秒，听到"叮"声即已捕获。
          </div>
        </el-card>

        <el-alert
          class="mode-hint"
          type="info"
          :closable="false"
          show-icon
          title="采集模式对手机只读：只截图、不点击。自动模式下离开目标App会自动暂停拍摄。"
        />
      </el-card>
    </el-col>

    <!-- 中栏：手动提取结果草稿 -->
    <el-col :span="7">
      <el-card shadow="never" class="panel-card">
        <template #header>
          <div class="card-header"><span>📝 提取结果（手动）</span></div>
        </template>

        <el-alert
          v-if="notProductPage"
          type="warning"
          :closable="false"
          show-icon
          title="当前屏幕不是商品页"
          :description="notProductPageReason"
        />

        <template v-else-if="draft">
          <el-alert
            v-if="duplicateOf"
            type="warning"
            :closable="false"
            show-icon
            title="疑似重复商品"
            :description="`与已有记录 ${duplicateOf} 同渠道同名同规格，保存后将标记为重复（不丢弃）`"
            class="dup-alert"
          />
          <el-form label-width="90px" size="small" class="draft-form">
            <el-form-item label="来源渠道">
              <el-input v-model="draft.source_app" />
            </el-form-item>
            <el-form-item v-for="f in extractedFields" :key="f.key" :label="f.label">
              <el-input
                v-model="draft[f.key]"
                :type="['claims', 'ingredients'].includes(f.key) ? 'textarea' : 'text'"
                :autosize="{ minRows: 1, maxRows: 3 }"
                :class="{ unrecognized: draft[f.key] === '未识别' }"
              />
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="draft.notes" placeholder="可选" />
            </el-form-item>
          </el-form>
          <div class="draft-actions">
            <el-button @click="discardDraft">放弃</el-button>
            <el-button type="success" :loading="saving" @click="saveDraft">✅ 保存入库</el-button>
          </div>
        </template>

        <el-empty v-else description="手动模式：点击左侧提取按钮" :image-size="80" />
      </el-card>
    </el-col>

    <!-- 右栏：已采集记录 + 复核 + 导出 -->
    <el-col :span="8">
      <el-card shadow="never" class="panel-card">
        <template #header>
          <div class="card-header">
            <span>
              📦 已采集 {{ records.length }} 条
              <el-badge v-if="pendingCount > 0" :value="pendingCount" type="warning" class="pending-badge">
                <span class="pending-label">待复核</span>
              </el-badge>
            </span>
            <div class="header-tools">
              <el-button
                size="small"
                type="success"
                :loading="approvingAll"
                :disabled="pendingCount === 0"
                @click="approveAllPending"
              >✅ 一键全部复核{{ pendingCount > 0 ? ` (${pendingCount})` : '' }}</el-button>
              <el-checkbox v-model="filterPending" size="small">只看待复核</el-checkbox>
              <el-select
                v-model="filterBatch"
                placeholder="全部批次"
                clearable
                size="small"
                style="width: 120px"
                @change="loadRecords"
              >
                <el-option v-for="b in batches" :key="b" :label="b" :value="b" />
              </el-select>
              <el-button size="small" type="primary" plain @click="exportCSV" :disabled="records.length === 0">
                导出 CSV
              </el-button>
              <el-button size="small" type="success" plain @click="exportXlsx" :disabled="records.length === 0">
                导出 Excel(含截图)
              </el-button>
            </div>
          </div>
        </template>

        <el-button
          v-if="filterPending && displayRecords.length > 0"
          size="small"
          type="success"
          plain
          class="approve-all-btn"
          @click="approveAll"
        >✅ 当前列表全部通过 ({{ displayRecords.length }})</el-button>

        <el-table :data="displayRecords" size="small" max-height="620" empty-text="暂无记录">
          <el-table-column label="截图" width="56">
            <template #default="{ row }">
              <el-image
                class="thumb"
                :src="`${API_BASE}/api/collect/screenshots/${row.capture_id}`"
                :preview-src-list="[`${API_BASE}/api/collect/screenshots/${row.capture_id}`]"
                preview-teleported
                fit="cover"
              />
            </template>
          </el-table-column>
          <el-table-column prop="product_name" label="商品" min-width="110" show-overflow-tooltip>
            <template #default="{ row }">
              <span>{{ row.product_name }}</span>
              <el-tag v-if="row.duplicate_of" type="warning" size="small" style="margin-left: 4px">重复</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="price" label="价格" width="72" show-overflow-tooltip />
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.review_status === 'pending' ? 'warning' : 'success'" size="small">
                {{ row.review_status === 'pending' ? '待复核' : '已复核' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="64">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="openReview(row)">
                {{ row.review_status === 'pending' ? '复核' : '查看' }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </el-col>
  </el-row>

  <!-- 复核对话框：截图与字段并排 -->
  <el-dialog v-model="reviewVisible" title="复核采集记录" width="760px" top="4vh">
    <el-row :gutter="16" v-if="reviewRecord">
      <el-col :span="10">
        <img
          class="review-screenshot"
          :src="`${API_BASE}/api/collect/screenshots/${reviewRecord.capture_id}`"
          alt="截图证据"
        />
      </el-col>
      <el-col :span="14">
        <el-form label-width="90px" size="small" class="review-form">
          <el-form-item label="来源渠道">
            <el-input v-model="reviewRecord.source_app" />
          </el-form-item>
          <el-form-item v-for="f in extractedFields" :key="f.key" :label="f.label">
            <el-input
              v-model="reviewRecord[f.key]"
              :type="['claims', 'ingredients'].includes(f.key) ? 'textarea' : 'text'"
              :autosize="{ minRows: 1, maxRows: 3 }"
              :class="{ unrecognized: reviewRecord[f.key] === '未识别' }"
            />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="reviewRecord.notes" />
          </el-form-item>
        </el-form>
      </el-col>
    </el-row>
    <template #footer>
      <el-popconfirm title="确认删除这条记录？" @confirm="doReview('delete')">
        <template #reference>
          <el-button type="danger" plain>🗑 删除</el-button>
        </template>
      </el-popconfirm>
      <el-button type="success" @click="doReview('update')">✅ 保存并通过</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { io } from 'socket.io-client'
import { ElMessage } from 'element-plus'

const API_BASE = 'http://localhost:3000'

// 与后端 src/collector/schema.js 的 EXTRACTED_FIELDS 保持一致
const extractedFields = [
  { key: 'brand', label: '品牌' },
  { key: 'product_name', label: '商品名称' },
  { key: 'category', label: '品类' },
  { key: 'flavor', label: '口味' },
  { key: 'spec_volume', label: '规格/容量' },
  { key: 'package_type', label: '包装形式' },
  { key: 'price', label: '现价' },
  { key: 'original_price', label: '原价' },
  { key: 'promo_info', label: '促销信息' },
  { key: 'claims', label: '卖点' },
  { key: 'ingredients', label: '配料' },
  { key: 'rating', label: '评分' },
  { key: 'review_count', label: '评价数' },
  { key: 'shop_name', label: '店铺' }
]

const devices = ref([])
const deviceSerial = ref('')
const batchName = ref('')
const screenshotUrl = ref('')
const extracting = ref(false)
const saving = ref(false)

const draft = ref(null)
const duplicateOf = ref(null)
const notProductPage = ref(false)
const notProductPageReason = ref('')

const records = ref([])
const batches = ref([])
const filterBatch = ref('')
const filterPending = ref(false)
const pendingCount = ref(0)
const approvingAll = ref(false)

// 自动采集状态
const autoMode = ref('shadow')
const autoRunning = ref(false)
const autoPaused = ref(false)
const autoStats = ref(null)
const autoEvents = ref([])
let statusTimer = null
let socket = null
let audioCtx = null

const displayRecords = computed(() =>
  filterPending.value ? records.value.filter(r => r.review_status === 'pending') : records.value
)

const formatTime = (iso) => new Date(iso || Date.now()).toLocaleTimeString('zh-CN', { hour12: false })

// ==== 提示音（WebAudio 合成，无需音频文件） ====
const beep = (freq, duration = 0.12, delay = 0, volume = 0.25) => {
  if (!audioCtx) return
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.value = volume
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  const t = audioCtx.currentTime + delay
  osc.start(t)
  gain.gain.setValueAtTime(volume, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
  osc.stop(t + duration + 0.05)
}
const soundCaptured = () => beep(880, 0.1)                                // 叮：已捕获
const soundProduct = () => { beep(660, 0.1); beep(990, 0.12, 0.1) }       // 上扬双音：识别为商品
const soundNonProduct = () => beep(220, 0.15)                             // 低音：非商品页
const soundError = () => { beep(160, 0.2); beep(160, 0.2, 0.25) }         // 两声低鸣：出错

const pushAutoEvent = (kind, text) => {
  autoEvents.value.unshift({ kind, text, time: formatTime() })
  if (autoEvents.value.length > 8) autoEvents.value.pop()
}

// ==== 设备与手动提取 ====
const refreshDevices = async () => {
  try {
    const res = await axios.get(`${API_BASE}/api/devices`)
    if (res.data.success) {
      devices.value = res.data.devices
      if (devices.value.length > 0 && !deviceSerial.value) {
        deviceSerial.value = devices.value[0].serial
        refreshScreen()
      }
    }
  } catch {
    ElMessage.error('设备列表获取失败')
  }
}

const refreshScreen = () => {
  if (!deviceSerial.value) return
  screenshotUrl.value = `${API_BASE}/api/screenshot?serial=${deviceSerial.value}&t=${Date.now()}`
}

const extractCurrent = async () => {
  extracting.value = true
  notProductPage.value = false
  try {
    const res = await axios.post(`${API_BASE}/api/collect/extract`, {
      deviceSerial: deviceSerial.value,
      batchName: batchName.value || undefined
    })
    refreshScreen()
    if (res.data.notProductPage) {
      draft.value = null
      duplicateOf.value = null
      notProductPage.value = true
      notProductPageReason.value = res.data.reason
      ElMessage.warning('当前屏幕不是商品页')
      return
    }
    draft.value = res.data.record
    duplicateOf.value = res.data.duplicateOf
    ElMessage.success(`已提取: ${res.data.record.product_name}`)
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '提取失败')
  } finally {
    extracting.value = false
  }
}

const saveDraft = async () => {
  if (!draft.value) return
  saving.value = true
  try {
    await axios.post(`${API_BASE}/api/collect/records`, { record: draft.value })
    ElMessage.success('已保存入库')
    draft.value = null
    duplicateOf.value = null
    await loadRecords()
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}

const discardDraft = () => {
  draft.value = null
  duplicateOf.value = null
}

// ==== 自动采集 ====
const startAuto = async () => {
  // 用户手势时创建 AudioContext（浏览器策略要求）
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  try {
    await axios.post(`${API_BASE}/api/collect/auto/start`, {
      deviceSerial: deviceSerial.value,
      mode: autoMode.value,
      batchName: batchName.value || undefined
    })
    autoRunning.value = true
    autoEvents.value = []
    pushAutoEvent('info', autoMode.value === 'shadow' ? '影子模式已启动（只捕获不入库）' : '自动入库模式已启动')
    beep(523, 0.1); beep(659, 0.1, 0.12); beep(784, 0.15, 0.24) // 启动音
    startStatusPolling()
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '启动失败')
  }
}

const stopAuto = async () => {
  try {
    await axios.post(`${API_BASE}/api/collect/auto/stop`)
    autoRunning.value = false
    pushAutoEvent('info', '已停止（队列剩余任务继续提取）')
    stopStatusPolling()
    await fetchAutoStatus()
    await loadRecords()
  } catch {
    ElMessage.error('停止失败')
  }
}

const fetchAutoStatus = async () => {
  try {
    const res = await axios.get(`${API_BASE}/api/collect/auto/status`)
    const status = res.data.status
    if (status && status.stats) {
      autoStats.value = status.stats
      autoRunning.value = !!status.running
    }
  } catch { /* 静默 */ }
}

const startStatusPolling = () => {
  stopStatusPolling()
  statusTimer = setInterval(fetchAutoStatus, 2000)
}
const stopStatusPolling = () => {
  if (statusTimer) {
    clearInterval(statusTimer)
    statusTimer = null
  }
}

const handleCollectorEvent = (event) => {
  switch (event.type) {
    case 'captured':
      soundCaptured()
      autoPaused.value = false
      pushAutoEvent('captured', `📸 已捕获画面（队列 ${event.queueDepth}）`)
      break
    case 'shadow_product':
      soundProduct()
      pushAutoEvent('product', `🕶 [影子] ${event.productName} ${event.price !== '未识别' ? event.price : ''}`)
      break
    case 'record_saved':
      soundProduct()
      pushAutoEvent('product', `💾 已入库: ${event.record.product_name}${event.record.duplicate_of ? '（重复）' : ''}`)
      loadRecords()
      break
    case 'extracted_non_product':
      soundNonProduct()
      pushAutoEvent('skip', `⏭ 非商品页，已丢弃截图`)
      break
    case 'paused_foreground':
      autoPaused.value = true
      break
    case 'extract_error':
    case 'error':
      soundError()
      pushAutoEvent('error', `❌ ${event.message}`)
      break
    case 'queue_drained':
      pushAutoEvent('info', '✅ 队列已清空，本场采集完成')
      loadRecords()
      break
  }
}

// ==== 记录与复核 ====
const loadRecords = async () => {
  try {
    const params = filterBatch.value ? { batch: filterBatch.value } : {}
    const res = await axios.get(`${API_BASE}/api/collect/records`, { params })
    if (res.data.success) {
      records.value = res.data.records
      batches.value = res.data.batches
      pendingCount.value = res.data.pendingCount || 0
    }
  } catch {
    ElMessage.error('记录加载失败')
  }
}

const reviewVisible = ref(false)
const reviewRecord = ref(null)

const openReview = (row) => {
  reviewRecord.value = { ...row }
  reviewVisible.value = true
}

const doReview = async (action) => {
  try {
    const payload = { action }
    if (action === 'update') {
      const patch = { source_app: reviewRecord.value.source_app, notes: reviewRecord.value.notes }
      for (const f of extractedFields) patch[f.key] = reviewRecord.value[f.key]
      payload.patch = patch
    }
    await axios.post(`${API_BASE}/api/collect/records/${reviewRecord.value.capture_id}/review`, payload)
    ElMessage.success(action === 'delete' ? '已删除' : '已通过')
    reviewVisible.value = false
    await loadRecords()
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '操作失败')
  }
}

const approveAll = async () => {
  const pending = displayRecords.value.filter(r => r.review_status === 'pending')
  for (const r of pending) {
    try {
      await axios.post(`${API_BASE}/api/collect/records/${r.capture_id}/review`, { action: 'approve' })
    } catch { /* 单条失败不中断 */ }
  }
  ElMessage.success(`已通过 ${pending.length} 条`)
  await loadRecords()
}

// 一键全部复核: 通过【全库】所有待复核记录(不受当前批次/筛选限制),并发加速
const approveAllPending = async () => {
  if (approvingAll.value) return
  approvingAll.value = true
  try {
    // 拉全库待复核(不带 batch 过滤),确保"全部"是真全部
    const res = await axios.get(`${API_BASE}/api/collect/records`)
    const allPending = (res.data.records || []).filter(r => r.review_status === 'pending')
    if (allPending.length === 0) {
      ElMessage.info('没有待复核记录')
      return
    }
    let done = 0, failed = 0
    const POOL = 6
    let idx = 0
    const worker = async () => {
      while (idx < allPending.length) {
        const r = allPending[idx++]
        try {
          await axios.post(`${API_BASE}/api/collect/records/${r.capture_id}/review`, { action: 'approve' })
          done++
        } catch { failed++ }
      }
    }
    await Promise.all(Array.from({ length: POOL }, () => worker()))
    ElMessage.success(`已复核 ${done} 条${failed ? `,失败 ${failed} 条` : ''}`)
    await loadRecords()
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '批量复核失败')
  } finally {
    approvingAll.value = false
  }
}

const exportCSV = () => {
  const query = filterBatch.value ? `?batch=${encodeURIComponent(filterBatch.value)}` : ''
  window.open(`${API_BASE}/api/collect/export.csv${query}`, '_blank')
}

const exportXlsx = () => {
  const query = filterBatch.value ? `?batch=${encodeURIComponent(filterBatch.value)}` : ''
  window.open(`${API_BASE}/api/collect/export.xlsx${query}`, '_blank')
}

onMounted(() => {
  refreshDevices()
  loadRecords()
  fetchAutoStatus().then(() => {
    if (autoRunning.value) startStatusPolling()
  })
  socket = io(API_BASE)
  socket.on('collector_event', handleCollectorEvent)
})

onBeforeUnmount(() => {
  stopStatusPolling()
  if (socket) socket.disconnect()
})
</script>

<style scoped>
.panel-card {
  border-radius: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap; /* 控件多时换行,不被容器右缘切掉 */
  font-weight: 600;
}

/* 已采集面板控件多(复选/批次/导出/复核): 工具栏独占一行 + 换行,避免和标题挤在一行被右缘切掉 */
.header-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  flex: 1 1 100%;
  margin-top: 6px;
}

.screen-preview {
  background: #1a1a2e;
  border-radius: 8px;
  min-height: 280px;
  max-height: 420px;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  margin-bottom: 12px;
}

.screen-preview img {
  max-width: 100%;
  max-height: 420px;
  object-fit: contain;
}

.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.action-bar .el-button--large {
  flex: 1;
}

.auto-card {
  border-radius: 8px;
  margin-bottom: 12px;
  border: 1px solid #e4e7ed;
  transition: border-color 0.3s, box-shadow 0.3s;
}

.auto-card.auto-running {
  border-color: #67c23a;
  box-shadow: 0 0 8px rgba(103, 194, 58, 0.25);
}

.auto-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.auto-stats {
  display: flex;
  gap: 14px;
  margin-top: 10px;
  font-size: 13px;
  color: #606266;
  flex-wrap: wrap;
}

.auto-stats b {
  color: #303133;
}

.stat-product {
  color: #67c23a !important;
}

.stat-queue {
  color: #e6a23c !important;
}

.auto-log {
  margin-top: 10px;
  background: #f8f9fb;
  border-radius: 6px;
  padding: 8px 10px;
  max-height: 150px;
  overflow-y: auto;
  font-size: 12px;
}

.auto-log-line {
  display: flex;
  gap: 8px;
  line-height: 1.8;
}

.log-time {
  color: #c0c4cc;
  flex-shrink: 0;
}

.log-product { color: #67c23a; }
.log-captured { color: #409eff; }
.log-skip { color: #909399; }
.log-error { color: #f56c6c; }
.log-info { color: #606266; }

.auto-hint {
  margin-top: 10px;
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
}

.mode-hint {
  border-radius: 8px;
}

.dup-alert {
  margin-bottom: 12px;
}

.draft-form {
  max-height: 520px;
  overflow-y: auto;
}

.draft-form :deep(.unrecognized .el-input__inner),
.draft-form :deep(.unrecognized .el-textarea__inner),
.review-form :deep(.unrecognized .el-input__inner),
.review-form :deep(.unrecognized .el-textarea__inner) {
  color: #c0c4cc;
}

.draft-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.thumb {
  width: 36px;
  height: 52px;
  border-radius: 4px;
  cursor: pointer;
}

.pending-badge {
  margin-left: 10px;
}

.pending-label {
  font-size: 12px;
  color: #e6a23c;
}

.approve-all-btn {
  margin-bottom: 8px;
  width: 100%;
}

.review-screenshot {
  width: 100%;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
}

.review-form {
  max-height: 560px;
  overflow-y: auto;
  padding-right: 8px;
}
</style>
