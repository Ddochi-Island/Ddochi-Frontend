<script setup>
import { usePopup } from '@/composables/usePopup'

const { toasts } = usePopup()
</script>

<template>
    <div v-for="toast in toasts" :key="toast.id" class="toast-msg">
        {{ toast.msg }}
    </div>
</template>
