// 사용 가이드 주제 목록 + 직책별로 보이는 주제 — GuideScreen/상단 바/⚙️ 메뉴가 같은 기준을 쓰게 한곳에.
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRoles } from '@/composables/useRoles'

// 단계: title / body(문장 배열) / mock(실제 화면 모양을 흉내 낸 작은 그림, 선택) / tip(선택)
export const GUIDES = {
    telegram: {
        // 방 연결은 관리자 화면에서 하는 일이라 전도팀장 이상만(2026-10-09)
        canSee: ({ isAdmin, hasRegionRole, role }) => isAdmin || hasRegionRole || /지역장|전도팀장/.test(role || ''),
        icon: '💬',
        title: '텔레그램 방 연결하기',
        summary: '일일보고·현황판이 우리 지역 텔레그램 방에 자동으로 올라오게 연결해요.',
        steps: [
            {
                title: '시작 전에 준비할 것',
                body: [
                    '연결하면 일일보고, 찾기·매칭 현황판, 예약 타임테이블 같은 판이 그 방에 정각마다 자동으로 올라와요.',
                    '두 가지가 필요해요.',
                ],
                list: ['또치 관리자 비밀번호', '연결할 텔레그램 단톡방 (멤버를 초대할 수 있어야 해요)'],
            },
            {
                title: '봇을 방에 초대해요',
                body: ['연결할 텔레그램 단톡방에서 방 이름을 눌러 멤버 추가로 들어가요.', '아래 봇을 검색해서 초대해요.'],
                mock: 'bot',
                tip: '봇이 방에 없으면 연결 명령어를 보내도 아무 일도 안 일어나요.',
            },
            {
                title: '관리자 화면을 열어요',
                body: ['또치 앱 오른쪽 위 ⚙️를 눌러요.', '"👑 사명의 길 (관리자)"를 누르고 관리자 비밀번호를 넣어요.'],
                mock: 'admin',
            },
            {
                title: '텔레그램 연결을 열고 지역을 골라요',
                body: ['관리자 화면에서 "💬 텔레그램 연결"을 눌러요.', '위쪽 탭에서 연결할 지역을 골라요.'],
                mock: 'tabs',
                tip: '135 연합·246 연합·수지역 탭은 연합/전체 방용이에요.',
            },
            {
                title: '판을 고르고 "연결"을 눌러요',
                body: ['그 방에 올릴 판(예: 매칭현황판) 오른쪽의 "연결"을 눌러요.', '명령어가 나오면 📋 복사를 눌러요.'],
                mock: 'pair',
            },
            {
                title: '방에 명령어를 붙여넣어요',
                body: ['복사한 명령어를 그 텔레그램 방에 그대로 보내요.', '10분 안에, 한 번만 쓸 수 있어요.'],
                mock: 'chat',
                tip: '10분이 지나면 "⏰ 코드 만료됨"이 떠요. 다시 "연결"을 누르면 새 명령어가 나와요.',
            },
            {
                title: '연결됐는지 확인해요',
                body: ['앱에 "✅ 연결됨!"이 뜨고, 그 판 옆에 방 이름이 나와요.', '현황판·일일보고는 첫 판이, 다른 방(기도문·일정 등)은 환영 메시지가 바로 올라와요.'],
                mock: 'done',
            },
            {
                title: '옮기거나 끄고 싶을 때',
                body: [],
                list: [
                    '다른 방으로 옮기기: 🔄 재연결 → 새 방에 명령어 붙여넣기',
                    '연결 끊기: 해제',
                    '정각 발송만 잠깐 멈추기: 같은 탭 위쪽 "⏰ 발송 잡 ON/OFF"에서 끄기',
                ],
                tip: '안 될 때는 ① 봇이 방에 있는지 ② 명령어를 고치지 않았는지 ③ 10분이 지나지 않았는지 확인해 주세요.',
            },
        ],
    },
}


// canSee가 없는 주제는 모두에게 보임
export function useVisibleGuides() {
    const auth = useAuthStore()
    const { hasRegionRole } = useRoles()
    return computed(() => {
        const who = { isAdmin: auth.isAdmin, hasRegionRole: hasRegionRole.value, role: auth.currentUserRole }
        return Object.fromEntries(Object.entries(GUIDES).filter(([, g]) => !g.canSee || g.canSee(who)))
    })
}
