<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { usePopup } from '@/composables/usePopup'
import { useFormatters } from '@/composables/useFormatters'
import { ttagiFields, pathMap } from '@/constants'

// CenterScreen 의 따기보고 read-only 상세 팝업.
// legacy: viewTtagiReportForCenter / __copyTtagiContent 정합.

const props = defineProps({
    item: { type: Object, required: true },
})

const emit = defineEmits(['close'])

const { showToast } = usePopup()
const { autoResize } = useFormatters()

const data = props.item.ttagiReport || {}
const wrapRef = ref(null)

onMounted(() => {
    nextTick(() => {
        if (wrapRef.value) {
            wrapRef.value.querySelectorAll('.auto-textarea.auto-resize-box').forEach(el => autoResize(el))
        }
    })
})

function handleCopy() {
    const item = props.item
    const d = item.ttagiReport || {}
    const teacher = (item.teacher || '').replace('(타지역)', '')
    const pathDisplay = pathMap[item.path] || item.path || '-'
    const header = `${item.name}(${pathDisplay})/${item.manager}/${teacher} 상담따기 만남`
    const content = `\n■ 고정 요일, 시간 : ${d.fixDay || '-'}\n\n■ 따기 포인트\n${d.point || '-'}\n\n■ 따기 포인트의 원인(가정사, 인간관계)\n${d.pointCause || '-'}\n\n■ 결핍\n${d.lack || '-'}\n\n■ 따포의 원인으로 생겨난 사고회로\n${d.thought || '-'}\n\n■ 사용한 따기멘트\n${d.ment || '-'}\n\n■ 입막음에 대한 반응\n${d.reaction || '-'}\n\n■ 비합요소\n${d.bihap || '-'}\n\n■ 추가 파악해야할 내용(피드백받고 작성)\n${d.check || '-'}`
    navigator.clipboard.writeText(header + content).then(() => showToast('복사 완료!'))
}
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card" style="height:80vh; padding:0;" ref="wrapRef">
                <div class="modal-header-sticky">
                    <div class="copy-btn" style="position:static; margin:0;" @click="handleCopy">복사하기</div>
                    <span class="modal-close-sticky" @click="emit('close')">X</span>
                </div>
                <div class="modal-content-scroll" style="padding:15px;">
                    <div class="modal-title" style="margin-top:0;">따기보고 상세</div>
                    <div v-for="f in ttagiFields" :key="f.id" class="note-box">
                        <span class="note-label">{{ f.label }}</span>
                        <input
                            v-if="f.id === 'fixDay'"
                            type="text"
                            class="note-input"
                            :value="data[f.id] || ''"
                            disabled
                            style="background:#f9f9f9; color:#555;"
                        />
                        <textarea
                            v-else
                            class="auto-textarea auto-resize-box"
                            :value="data[f.id] || ''"
                            disabled
                            style="background:#f9f9f9; color:#555;"
                        />
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>
