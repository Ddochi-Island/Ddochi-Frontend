// 밭 게임 모드의 Phaser 씬 — 도트 타일 월드, 탭 이동 캐릭터, 식물·빈 땅·우편함·팻말 상호작용
import * as Phaser from 'phaser'
import { SPRITES, PALETTE } from './farmSprites'

const T = 48            // 화면상 타일 크기 (16px 도트 × 3)
const COLS = 9          // 0·8열은 울타리, 1~7열이 마당
const PLOT_COLS = [2, 4, 6]
const PLOT_TOP = 5      // 첫 밭 줄 (1~3줄은 마당: 팻말·우편함)
const SPEED = 160       // px/s
// 기기 해상도 배율로 그림 — 1x로 그리면 폰(3x)에서 이동이 CSS 1px(=기기 3px) 단위로 끊겨 버벅여 보임
// ponytail: Canvas 렌더러 부담 때문에 최대 2배. 3x 폰에서도 도트 1칸(월드 3px)=기기 9px로 고르게 떨어짐
const Z = Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)))

// 문자 격자 → 캔버스 텍스처 (scale배로 키워서 그림 → 카메라 줌 없이 선명)
function addPixelTexture(scene, key, rows, scale) {
    const w = rows[0].length, h = rows.length
    const tex = scene.textures.createCanvas(key, w * scale, h * scale)
    const ctx = tex.getContext()
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (!PALETTE[ch]) return
        ctx.fillStyle = PALETTE[ch]
        ctx.fillRect(x * scale, y * scale, scale, scale)
    }))
    tex.refresh()
}

const center = (t) => t * T + T / 2
const STAGE_ORDER = ['씨앗', '새싹', '떡잎', '꽃']
const RARITY_TAG = { common: '#f3d9a4', rare: '#cfe3fb', legend: '#ffe27a' }   // 이름표 바탕 = 품종 희귀도
// 지난번에 본 단계 — 단계가 오른 식물만 성장 연출(기기별 기록이라 localStorage면 충분)
const SEEN_KEY = 'farmSeenStages'
function loadSeen() { try { return JSON.parse(localStorage.getItem(SEEN_KEY)) } catch { return null } }
function saveSeen(m) { try { localStorage.setItem(SEEN_KEY, JSON.stringify(m)) } catch { /* 기록 못 해도 게임은 동작 */ } }
// 칸 좌표마다 고정된 0~1 값 — 화면 크기가 바뀌어도 바깥 장식이 같은 자리에 같은 모양
const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n) }

class FarmScene extends Phaser.Scene {
    constructor(opts) {
        super('farm')
        this.opts = opts
        this.cards = opts.cards
        this.worldObjs = []
        this.targets = []
        this.near = null
        this.seen = loadSeen()   // null이면 첫 방문 — 전부 연출하지 않고 기록만
    }

    create() {
        // 8px 타일은 6배(한 칸), 8px 소품은 4배, 말풍선 3배, 16px 스프라이트는 3배
        const scaleOf = (k, rows) => ['grass', 'soil', 'fence', 'fenceV'].includes(k) ? 6
            : k.startsWith('bubble') ? 3 : rows[0].length === 8 ? 4 : 3
        for (const [k, rows] of Object.entries(SPRITES)) addPixelTexture(this, k, rows, scaleOf(k, rows))

        this.player = this.add.image(center(4), center(3), 'playerDown').setOrigin(0.5, 0.85)
        this.pos = new Phaser.Math.Vector2(this.player.x, this.player.y)
        this.dest = null
        this.destTarget = null
        this.walkClock = 0

        this.buildWorld()
        // lerp(지연 추적)이면 캐릭터가 화면에서 앞뒤로 떨림 → 딱 붙어서 추적. 반올림은 렌더러(pixelArt)가 기기 픽셀 단위로 함
        this.cameras.main.setZoom(Z).startFollow(this.player, false, 1, 1)
        this.input.on('pointerdown', (p) => this.onTap(p.worldX, p.worldY))
        this.scale.on('resize', () => this.fitCamera())
    }

    setCards(cards) {
        this.cards = cards
        this.buildWorld()
    }

    buildWorld() {
        this.worldObjs.forEach(o => o.destroy())
        this.worldObjs = []
        this.targets = []
        const add = (o) => { this.worldObjs.push(o); return o }

        const plotCount = Math.max(this.cards.length + 1, 6)
        const plotRows = Math.ceil(plotCount / PLOT_COLS.length)
        this.rows = PLOT_TOP + plotRows * 2 + 1
        const W = COLS * T, H = this.rows * T
        this.fitCamera()
        this.opts.onWorldSize?.(W, H)

        for (let x = 0; x < COLS; x++) {
            add(this.add.image(center(x), center(0), 'fence').setDepth(-5))
            add(this.add.image(center(x), center(this.rows - 1), 'fence').setDepth(H))
        }
        for (let y = 1; y < this.rows - 1; y++) {
            add(this.add.image(center(0), center(y), 'fenceV').setDepth(-5))
            add(this.add.image(center(COLS - 1), center(y), 'fenceV').setDepth(-5))
        }
        // 고정 위치 장식 (매번 같은 모습)
        ;[[1, 1, 'bush'], [7, 3, 'bush'], [3, 1, 'flower'], [5, 3, 'flower'], [7, 1, 'rock'], [1, 4, 'flower']]
            .forEach(([x, y, k]) => add(this.add.image(center(x), center(y), k).setDepth(center(y))))
        for (let y = PLOT_TOP; y < this.rows - 1; y += 2) {
            add(this.add.image(center(1), center(y), y % 4 === 1 ? 'flower' : 'rock').setDepth(center(y)))
        }

        this.addTarget(add, 2, 2, 'sign', 'sign')
        this.addTarget(add, 6, 2, 'mailbox', 'mailbox')

        const grown = []
        for (let i = 0; i < plotCount; i++) {
            const tx = PLOT_COLS[i % PLOT_COLS.length], ty = PLOT_TOP + Math.floor(i / PLOT_COLS.length) * 2
            add(this.add.image(center(tx), center(ty), 'soil').setDepth(-4))
            const card = this.cards[i]
            if (!card) {
                this.targets.push({ kind: 'empty', tx, ty })
                continue
            }
            const tex = card.stage === '꽃' ? `flower_${card.species}` : card.stage
            const plant = add(this.add.image(center(tx), center(ty) + T / 2 - 3, this.textures.exists(tex) ? tex : '씨앗')
                .setOrigin(0.5, 1).setDepth(center(ty) + T / 2))
            const prev = this.seen?.[card.short_card_id]
            const grew = this.seen && STAGE_ORDER.indexOf(card.stage) > STAGE_ORDER.indexOf(prev)   // 새로 심은 것도 포함
            if (grew) {
                grown.push(card)
                this.playGrow(plant)
            }
            if (card.sprout_status === 'rejected') plant.setTint(0xb8a77a)
            else if (card.stage !== '씨앗') {
                this.tweens.add({ targets: plant, scaleY: 0.94, duration: 700, yoyo: true, repeat: -1, ease: 'Stepped', delay: grew ? 900 : i * 170 })
            }
            if (card.sprout_status === 'pending' || card.sprout_status === 'rejected') {
                const b = add(this.add.image(center(tx) - 16, center(ty) - 22, card.sprout_status === 'pending' ? 'bubble' : 'bubbleSad')
                    .setDepth(H - 1))
                if (card.sprout_status === 'pending') this.tweens.add({ targets: b, y: b.y - 4, duration: 450, yoyo: true, repeat: -1, ease: 'Stepped' })
            }
            add(this.add.text(center(tx), center(ty) + T / 2 + 4, card.name, {
                fontFamily: 'Galmuri11, Jua, sans-serif', fontSize: '12px', color: '#4e342e',
                backgroundColor: RARITY_TAG[card.rarity] || RARITY_TAG.common, padding: { x: 6, y: 2 },
            }).setOrigin(0.5, 0).setResolution(Z).setDepth(H - 2))
            this.targets.push({ kind: 'plant', tx, ty, card })
        }

        // 바뀐 밭 크기 안으로 캐릭터 위치 보정
        this.pos.y = Math.min(this.pos.y, center(this.rows - 2))
        this.updateNear(true)

        this.seen = Object.fromEntries(this.cards.map(c => [c.short_card_id, c.stage]))
        saveSeen(this.seen)
        if (grown.length) this.opts.onGrow?.(grown)
    }

    // 성장 연출 — 쑥 올라오며 통통 + 반짝이 네 개가 퍼짐
    playGrow(plant) {
        plant.setScale(0.2)
        this.tweens.add({ targets: plant, scaleX: 1, scaleY: 1, duration: 650, ease: 'Back.Out', delay: 250 })
        for (let k = 0; k < 4; k++) {
            const a = Math.PI / 4 + k * Math.PI / 2
            const s = this.add.image(plant.x, plant.y - 24, 'star').setDepth(this.rows * T).setAlpha(0)
            this.tweens.add({
                targets: s, x: s.x + Math.cos(a) * 30, y: s.y + Math.sin(a) * 30, alpha: { from: 1, to: 0 },
                duration: 700, delay: 500, ease: 'Quad.Out', onComplete: () => s.destroy(),
            })
        }
    }

    // 화면이 밭보다 크면(전체 화면·PC) 밭을 가운데에 두고, 작으면 밭 안에서만 스크롤
    fitCamera() {
        const W = COLS * T, H = this.rows * T, vw = this.scale.width / Z, vh = this.scale.height / Z
        const bx = Math.min(0, (W - vw) / 2), by = Math.min(0, (H - vh) / 2), bw = Math.max(W, vw), bh = Math.max(H, vh)
        this.cameras.main.setBounds(bx, by, bw, bh)

        // 보이는 영역 전체를 잔디로(타일 격자에 맞춰 시작) + 울타리 밖 장식
        this.outsideObjs?.forEach(o => o.destroy())
        const tx0 = Math.floor(bx / T), ty0 = Math.floor(by / T)
        this.outsideObjs = [this.add.tileSprite(tx0 * T, ty0 * T, bw + 2 * T, bh + 2 * T, 'grass').setOrigin(0).setDepth(-10)]
        for (let y = ty0; y * T < by + bh; y++) {
            for (let x = tx0; x * T < bx + bw; x++) {
                if (x >= -1 && x <= COLS && y >= -1 && y <= this.rows) continue   // 밭과 울타리 바로 옆 한 칸은 비움
                const r = hash(x, y)
                const k = r < 0.07 ? 'tree' : r < 0.12 ? 'bush' : r < 0.2 ? 'flower' : r < 0.23 ? 'rock' : null
                if (k) this.outsideObjs.push(this.add.image(center(x), center(y), k).setOrigin(0.5, k === 'tree' ? 0.8 : 0.5).setDepth(center(y)))
            }
        }
    }

    addTarget(add, tx, ty, kind, key) {
        add(this.add.image(center(tx), center(ty), key).setDepth(center(ty)))
        this.targets.push({ kind, tx, ty })
    }

    onTap(wx, wy) {
        const tx = Math.floor(wx / T), ty = Math.floor(wy / T)
        const target = this.targets.find(t => t.tx === tx && t.ty === ty)
        if (target) {
            // 이미 그 앞에 서 있으면 바로 상호작용
            if (this.near === target && !this.dest) { this.opts.onAct(target); return }
            this.walkTo(center(tx + 1), center(ty) + 10, target)   // 대상 오른쪽 칸에 서서 왼쪽을 봄
        } else {
            this.walkTo(
                Phaser.Math.Clamp(wx, T + 8, (COLS - 1) * T - 8),
                Phaser.Math.Clamp(wy, T + 8, (this.rows - 1) * T - 8),
                null,
            )
        }
        this.showTapMark(wx, wy)
    }

    walkTo(x, y, target) {
        this.dest = new Phaser.Math.Vector2(x, y)
        this.destTarget = target
    }

    showTapMark(x, y) {
        const g = this.add.circle(x, y, 10, 0xfffdf5, 0.7).setDepth(-3)
        this.tweens.add({ targets: g, scale: 1.8, alpha: 0, duration: 350, onComplete: () => g.destroy() })
    }

    update(_, dtMs) {
        if (this.dest) {
            const dt = dtMs / 1000
            const d = this.dest.clone().subtract(this.pos)
            const step = SPEED * dt
            if (d.length() <= step) {
                this.pos.copy(this.dest)
                this.dest = null
                if (this.destTarget) this.face(-1, 0)
            } else {
                d.normalize()
                this.pos.add(d.clone().scale(step))
                this.face(d.x, d.y)
            }
            this.walkClock += dtMs
            this.updateNear()
        }
        // 걸음 표현은 발 기준 살짝 눌리기 — y를 들썩이면 이동과 겹쳐 한 프레임 멈췄다 튀는 것처럼 보임
        const step = this.dest && Math.floor(this.walkClock / 140) % 2
        this.player.setScale(1, step ? 0.94 : 1)
        this.player.setPosition(this.pos.x, this.pos.y).setDepth(this.pos.y)
    }

    face(dx, dy) {
        if (Math.abs(dx) > Math.abs(dy)) this.player.setTexture('playerSide').setFlipX(dx < 0)
        else this.player.setTexture(dy < 0 ? 'playerUp' : 'playerDown').setFlipX(false)
    }

    // 캐릭터가 서 있는 칸 바로 왼쪽에 있는 대상 = 상호작용 가능
    updateNear(force) {
        const tx = Math.floor(this.pos.x / T), ty = Math.floor(this.pos.y / T)
        const near = this.dest ? null : (this.targets.find(t => t.tx === tx - 1 && t.ty === ty) || null)
        if (force || near !== this.near) {
            this.near = near
            this.opts.onNear(near)
        }
    }
}

export async function createFarmGame(parent, opts) {
    try { await document.fonts.load('12px Galmuri11') } catch { /* 폰트 없으면 기본 글꼴 */ }
    const scene = new FarmScene(opts)
    const game = new Phaser.Game({
        type: Phaser.CANVAS,   // Phaser 4 WebGL은 리사이즈 후 캔버스 일부가 하얗게 비는 문제 → Canvas
        parent,
        backgroundColor: '#5fb24e',   // 울타리 밖도 잔디처럼
        pixelArt: true,
        // RESIZE 모드는 부모 크기 캐시 때문에 밭 높이 변화를 못 따라감 → 크기는 ResizeObserver로 직접 맞춤
        // 내부 크기는 CSS×Z, 화면 표시는 zoom 1/Z로 CSS 크기에 맞춤
        scale: { mode: Phaser.Scale.NONE, width: parent.clientWidth * Z, height: parent.clientHeight * Z, zoom: 1 / Z },
        scene,
        banner: false,
        audio: { noAudio: true },
    })
    const ro = new ResizeObserver(() => {
        if (parent.clientWidth && parent.clientHeight) game.scale.resize(parent.clientWidth * Z, parent.clientHeight * Z)
    })
    ro.observe(parent)
    return {
        setCards: (cards) => scene.sys?.isActive() ? scene.setCards(cards) : (scene.cards = cards),
        destroy: () => { ro.disconnect(); game.destroy(true) },
    }
}
