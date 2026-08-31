import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

import './styles/variables.css'
import './styles/global.css'
import './styles/nav.css'
import './styles/modal.css'
import './styles/toast.css'
import './styles/weekly.css'
import './styles/calendar.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
