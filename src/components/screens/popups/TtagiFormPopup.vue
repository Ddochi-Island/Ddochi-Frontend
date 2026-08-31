<script setup>
import { reactive } from 'vue'
import { usePopup } from '@/composables/usePopup'
import { useFormatters } from '@/composables/useFormatters'
import { ttagiFields } from '@/constants'

// CenterScreen 의 따기보고서 작성 팝업.
// legacy: showTtagiFormForCenter / __submitTtagiForCenter 정합.

const props = defineProps({
    item: { type: Object, required: true },
})

const emit = defineEmits(['close', 'submit'])

const { showAppConfirm } = usePopup()
const { autoResize } = useFormatters()

// 모든 ttagiFields 의 id 를 키로 빈 문자열 초기화 (querySelectorAll 회피, reactive form state 단일 소스)
const form = reactive(Object.fromEntries(ttagiFields.map(f => [f.id, ''])))

function handleSubmit() {
    showAppConfirm('따기보고를 제출할까?', (yes) => {
        if (!yes) return
        const data = {
            ...form,
            logType: '따기보고작성',
            logContent: '따기 보고서 내용 저장됨 (센터화면)',
        }
        emit('submit', { docId: props.item.docId, data })
    })
}

function onTextareaInput(event) {
    autoResize(event.target)
}
</script>

<template>
    <Teleport to="body">
        <div class="modal-overlay" @click.self="emit('close')">
            <div class="modal-card" style="height:80vh; padding:0;">
                <div class="modal-header-sticky">
                    <div class="modal-title" style="margin:0;">따기보고서 작성 (센터)</div>
                    <span class="modal-close-sticky" @click="emit('close')">X</span>
                </div>
                <div class="modal-content-scroll" style="padding:15px;">
                    <div v-for="f in ttagiFields" :key="f.id" class="note-box">
                        <span class="note-label">{{ f.label }}</span>
                        <input
                            v-if="f.id === 'fixDay'"
                            v-model="form[f.id]"
                            type="text"
                            class="note-input"
                        />
                        <textarea
                            v-else
                            v-model="form[f.id]"
                            class="auto-textarea auto-resize-box"
                            @input="onTextareaInput"
                        />
                    </div>
                    <button
                        class="btn"
                        style="margin-top:20px; background:#4CAF50;"
                        @click="handleSubmit"
                    >제출하기</button>
                </div>
            </div>
        </div>
    </Teleport>
</template>
