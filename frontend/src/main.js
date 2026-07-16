import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from './App.vue'
import './cockpit.css'

// 暗色作战舱主题：启用 Element Plus 暗色 + Signal Orange 主色
document.documentElement.classList.add('dark')

const app = createApp(App)
app.use(ElementPlus)
app.mount('#app')
