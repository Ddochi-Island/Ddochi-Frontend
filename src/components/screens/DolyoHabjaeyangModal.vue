<script setup>
// DolyoHabjaeyangModal — dolyo 합재양 작성 modal.
// HabjaeyangScreen 을 건드리지 않고 dolyo 전용 modal 로 같은 hjFields 사용.
// 같은 form schema → visual 동일.
//
// legacy openDolyoHabjaeyang (line 15946-15972) 는 dolyo item 을 normalize
// 해서 HabjaeyangScreen 으로 진입했음. 우리는 modal 안에서 동등 form.

import { reactive, ref, computed, onMounted } from 'vue'
import { useDolyo } from '@/composables/useDolyo'
import { usePopup } from '@/composables/usePopup'
import { useFormatters } from '@/composables/useFormatters'
import { hjFields, mbtiOptions } from '@/constants'

const props = defineProps({
    item: { type: Object, required: true },
})
const emit = defineEmits(['close', 'saved'])

const { submitHabjaeyang } = useDolyo()
const { showAppAlert, showToast } = usePopup()
const { autoResize, moveFocus } = useFormatters()

const formData = reactive({})
const phone1 = ref('010')
const phone2 = ref('')
const phone3 = ref('')
const submitting = ref(false)

const isReHj = computed(() => !!(props.item.habjaeyang && props.item.habjaeyang.subName))
const title = computed(() => isReHj.value ? '🔄 2차 매칭 합재양' : '🌱 합재양 작성')

onMounted(() => {
    // 기존 합재양 + dolyo item normalize — legacy openDolyoHabjaeyang 의 normalizedItem
    const fd = props.item.farmerDiary || {}
    const s1 = fd.stage1 || {}
    const existingHj = props.item.habjaeyang || {}

    const safeData = {
        subName: existingHj.subName || s1.name || props.item.name,
        age: existingHj.age || s1.age || props.item.age,
        gender: existingHj.gender || s1.gender || props.item.gender,
        nearSt: existingHj.nearSt || props.item.residence,
        guide: existingHj.guide || props.item.manager,
        contact: existingHj.contact || props.item.phone,
        ...existingHj,
    }

    hjFields.forEach((f) => {
        if (f.id === 'contact') {
            const val = safeData.contact || ''
            const parts = val.split('-')
            if (parts.length === 3) {
                phone1.value = parts[0]
                phone2.value = parts[1]
                phone3.value = parts[2]
            }
        } else {
            formData[f.id] = safeData[f.id] || ''
        }
    })
})

function getFieldType(f) {
    if (f.id === 'mbti') return 'mbti'
    if (f.id === 'contact') return 'contact'
    return f.type
}

function onPhone3Input(e) {
    if (phone3.value.length >= 4) e.target.blur()
}

async function onSubmit() {
    if (submitting.value) return
    if (!formData.subName) return showAppAlert('섭외자 이름은 필수야!')
    if (!formData.mtDate) return showAppAlert('매칭일자를 입력해줘!')
    if (!formData.mtTime) return showAppAlert('매칭시간을 입력해줘!')

    const data = {}
    hjFields.forEach((f) => {
        if (f.id === 'contact') {
            data.contact = `${phone1.value}-${phone2.value}-${phone3.value}`
        } else {
            data[f.id] = (formData[f.id] || '').toString().trim()
        }
    })

    submitting.value = true
    try {
        const r = await submitHabjaeyang(props.item.docId, data)
        if (r && (r.success || r.ok)) {
            showAppAlert(r.message || '제출 완료!', () => {
                emit('saved')
                emit('close')
            })
        } else {
            showToast(r?.message || '오류 발생')
        }
    } catch (e) {
        showToast(e.message || '오류 발생')
    } finally {
        submitting.value = false
    }
}

function handleAutoResize(e) { autoResize(e.target) }
function handlePhoneFocus(e, max, nextId) { moveFocus(e, max, nextId) }
</script>

<template>
    <Teleport to="body">
        <div class="dly-hj-overlay" @click.self="emit('close')">
            <div class="dly-hj-modal">
                <div class="modal-header-sticky">
                    <div class="modal-title">{{ title }}</div>
                    <span class="modal-close-sticky" @click="emit('close')">×</span>
                </div>

                <div class="modal-content-scroll">
                    <div v-if="isReHj"
                        style="background:#FFF3E0; color:#E65100; padding:8px 12px; border-radius:8px; font-size:12px; margin-bottom:10px;">
                        🔄 이미 합재양이 있어 — 새 매칭 round 의 합재양으로 저장돼.
                    </div>

                    <template v-for="f in hjFields" :key="f.id">
                        <label>{{ f.label }}</label>

                        <div v-if="getFieldType(f) === 'contact'" class="input-card phone-group">
                            <input type="tel" class="phone-input" v-model="phone1" maxlength="3"
                                placeholder="010" @input="(e) => handlePhoneFocus(e, 3, 'dly-hj-phone2')">
                            <span class="dash">-</span>
                            <input type="tel" class="phone-input" id="dly-hj-phone2" v-model="phone2" maxlength="4"
                                placeholder="0000" @input="(e) => handlePhoneFocus(e, 4, 'dly-hj-phone3')">
                            <span class="dash">-</span>
                            <input type="tel" class="phone-input" id="dly-hj-phone3" v-model="phone3" maxlength="4"
                                placeholder="0000" @input="onPhone3Input">
                        </div>

                        <div v-else-if="getFieldType(f) === 'mbti'" class="input-card">
                            <select v-model="formData[f.id]" style="padding:0;">
                                <option v-for="m in mbtiOptions" :key="m" :value="m === '-' ? '' : m">{{ m }}</option>
                            </select>
                        </div>

                        <div v-else-if="f.type === 'select'" class="input-card">
                            <select v-model="formData[f.id]" style="padding:0;">
                                <option v-for="o in f.opts" :key="o" :value="o">{{ o }}</option>
                            </select>
                        </div>

                        <div v-else-if="f.type === 'textarea'" class="input-card">
                            <textarea v-model="formData[f.id]" rows="1" @input="handleAutoResize"
                                style="width:100%; box-sizing:border-box; border:none; outline:none; resize:none;"
                                :placeholder="f.label"></textarea>
                        </div>

                        <div v-else class="input-card">
                            <input :type="f.type" v-model="formData[f.id]" :placeholder="f.label">
                        </div>
                    </template>

                    <div class="btn-group" style="margin-top:15px; padding-bottom:40px;">
                        <button class="btn-pos" :disabled="submitting" @click="onSubmit">
                            {{ submitting ? '저장 중...' : '제출하기 🗂' }}
                        </button>
                        <button class="btn-neg" @click="emit('close')">취소</button>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.dly-hj-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
}
.dly-hj-modal {
    background: #fff;
    border-radius: 16px;
    width: 92%;
    max-width: 480px;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
}
.modal-header-sticky {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    border-bottom: 1px solid #eee;
}
.modal-title { font-weight: bold; font-size: 16px; }
.modal-close-sticky { cursor: pointer; font-size: 24px; color: #bbb; line-height: 1; }
.modal-content-scroll { overflow-y: auto; padding: 15px; flex: 1; }
.phone-group { display: flex; align-items: center; gap: 4px; }
.phone-input { flex: 1; border: none; outline: none; text-align: center; background: transparent; }
.dash { color: #aaa; }
</style>
