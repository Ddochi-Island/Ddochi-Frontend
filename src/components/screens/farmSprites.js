// 밭 게임 모드용 2D 도트 스프라이트·타일 — 문자 격자 원본 + SVG data URI 변환 (+ 도트 글꼴 등록)
import galmuri11 from 'galmuri/dist/Galmuri11-Bold.woff2?url'   // 굵은체가 보통체(505KB)보다 훨씬 작음(167KB)

// 도트 글꼴(Galmuri11 Bold, OFL) — 게임 HUD·밭 이름표·씨앗 뽑기 전용. 등록만 해두고 쓸 때 내려받음
if (![...document.fonts].some(f => f.family === 'Galmuri11')) document.fonts.add(new FontFace('Galmuri11', `url(${galmuri11}) format('woff2')`))
export const PALETTE = {
    k: '#3b2a1a', s: '#8b5e3c', d: '#6b4428', l: '#a8774a',
    g: '#3f8a3a', G: '#5fb24e', L: '#9ad86a',
    b: '#7a4a22', B: '#c08a4a', w: '#c98c4e', W: '#e2b073',
    o: '#fffdf5', r: '#f57f17', h: '#e8c15a', H: '#b5652b', f: '#f4c9a0',
    c: '#4a7fc1', C: '#335f99', x: '#a5a29a', X: '#77736b', m: '#d9534f', M: '#9e2f2b',
    y: '#f6d55c', p: '#f2a7c3', P: '#e0679a',
    u: '#7fa8e8', U: '#4e6fc4', v: '#b48ce0', V: '#7d5bb8',
}

// 식물·캐릭터·오브젝트 (16x16), 타일·소품 (8x8)
export const SPRITES = {
    씨앗: [
        '................', '................', '................', '................',
        '................', '................', '................', '................',
        '................', '................', '................', '......kkkk......',
        '.....kBBbbk.....', '....dkBbbbkd....', '...ddskkkksdd...', '................',
    ],
    새싹: [
        '................', '................', '................', '................',
        '................', '................', '..kkk......kkk..', '.kLLGk....kGLLk.',
        '.kLGGGk..kGGGLk.', '..kGGggkkggGGk..', '...kkkgGGgkkk...', '......kgGk......',
        '......kgGk......', '......kgGk......', '....dddkkddd....', '................',
    ],
    떡잎: [
        '................', '......kkkk......', '.....kLLGGk.....', '..kkkkLGGgkkkk..',
        '.kLLGGkGgkGGLLk.', 'kLLGGGGkkGGGGLLk', 'kLGGGggkkggGGGLk', '.kGGgggkkgggGGk.',
        '..kkkkkGgkkkkk..', '.......kGk......', '.......kgk......', '...kk..kgk..kk..',
        '..kLGk.kgk.kGLk.', '...kGgkkgkkgGk..', '....kkkdkdkkk...', '................',
    ],
    playerDown: [
        '.....kkkkkk.....', '....khhhhhhk....', '..kkhhhhhhhhkk..', '.khhHHHHHHHHhhk.',
        '..kkkffffffkkk..', '....kfkffkfk....', '....kffffffk....', '.....kffffk.....',
        '....kcccccck....', '...kfccCCccfk...', '...kfccccccfk...', '....kccccccck...',
        '....kddddddk....', '....kddkkddk....', '....kkk..kkk....', '................',
    ],
    playerUp: [
        '.....kkkkkk.....', '....khhhhhhk....', '..kkhhhhhhhhkk..', '.khhHHHHHHHHhhk.',
        '..kkkbbbbbbkkk..', '....kbbbbbbk....', '....kbbbbbbk....', '.....kbbbbk.....',
        '....kcccccck....', '...kfccccccfk...', '...kfcCCCCcfk...', '....kccccccck...',
        '....kddddddk....', '....kddkkddk....', '....kkk..kkk....', '................',
    ],
    playerSide: [
        '.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhkk..', '..khHHHHHHHHhhk.',
        '...kkbbffffkk...', '....kbbffkfk....', '....kbffffffk...', '.....kffffk.....',
        '.....kcccck.....', '....kcCccfk.....', '....kcCccfk.....', '.....kcccck.....',
        '.....kddddk.....', '.....kdkkdk.....', '.....kkk.kkk....', '................',
    ],
    mailbox: [
        '................', '................', '....kkkkkkk.....', '...kmmmmmmmk.k..',
        '..kmmmmmmmmMkmk.', '..kmooooommMkmk.', '..kmmmmmmmmMk.k.', '..kmmmmmmmmMk...',
        '..kkkkkkkkkkk...', '......kwk.......', '......kwk.......', '......kwk.......',
        '......kWk.......', '......kwk.......', '....kkkkkkk.....', '................',
    ],
    sign: [
        '................', '................', '.kkkkkkkkkkkkkk.', 'kWWWWWWWWWWWWWWk',
        'kWwkkkwwwkkkwwWk', 'kWwwwwwwwwwwwwWk', 'kWwkkkkwwkkkwwWk', 'kwwwwwwwwwwwwwwk',
        '.kkkkkkkkkkkkkk.', '......kwk.......', '......kWk.......', '......kwk.......',
        '......kwk.......', '......kwk.......', '....kkkkkkk.....', '................',
    ],
    bush: [
        '................', '................', '.....kkkkk......', '...kkLLGGGkk....',
        '..kLLGGGGGGGk...', '.kLGGGpGGGGGGk..', '.kGGGGGGGGPGGk..', 'kLGGGGGGGGGGGgk.',
        'kGGGPGGGGGGGggk.', 'kGGGGGGGgGGgggk.', '.kGGgGGGggggggk.', '.kgggggggggggk..',
        '..kkkkkkkkkkkk..', '................', '................', '................',
    ],
    tree: [
        '......kkkk......', '....kkLLGGkk....', '...kLLLGGGGGk...', '..kLLGGGGGgGGk..', '.kLLGGGGGGGGGgk.',
        '.kLGGGpGGGGgGgk.', 'kLGGGGGGGGGGGggk', 'kLGGGGGgGGGGGggk', 'kGGGgGGGGGGpGggk', 'kGGGGGGGGGgGgggk',
        '.kGgGGGGgGGggggk', '.kggGGgggGgggggk', '..kgggggggggggk.', '...kkkkbbkkkkk..', '......kbBk......',
        '......kbBk......', '......kbBk......', '.....kbbBBk.....', '....kkkkkkkk....', '................',
    ],
    flower: ['........', '..p.y...', '.pyp.yy.', '..p.yky.', '...g.y..', '..Gg.g..', '...gGg..', '........'],
    rock: ['........', '........', '..kkkk..', '.kxxxXk.', 'kxxxxXXk', 'kXxxXXXk', '.kkkkkk.', '........'],
    grass: ['GGGGGGGG', 'GGGGGLGG', 'GGgGGGGG', 'GGGGGGGG', 'GGGGGGgG', 'GLGGGGGG', 'GGGGGGGG', 'GGGgGGGG'],
    soil: ['ssssssss', 'slssssls', 'dddddddd', 'ssssssss', 'sssslsss', 'ssssssss', 'dddddddd', 'ssssssss'],
    fence: ['..kkkk..', '.kWWwk..', 'kkkkkkkk', 'WWWWWWWW', 'wwwwwwww', 'kkkkkkkk', '.kWwwk..', '.kkkkk..'],
    fenceV: ['..kkkk..', '.kWWwk..', '.kWwwk..', '.kWwwk..', '.kWwwk..', '.kWwwk..', '.kWwwk..', '.kWwwk..'],
    list: ['.kkkkkk.', 'kooooook', 'kokkkook', 'kooooook', 'kokkkkok', 'kooooook', 'kokkkook', '.kkkkkk.'],
    close: ['kk....kk', 'kkk..kkk', '.kkkkkk.', '..kkkk..', '..kkkk..', '.kkkkkk.', 'kkk..kkk', 'kk....kk'],
    expand: ['kkk..kkk', 'k......k', 'k......k', '........', '........', 'k......k', 'k......k', 'kkk..kkk'],
    seedBag: [
        '................', '.....kk..kk.....', '......kkkk......', '......kHHk......', '.....kkkkkk.....', '....kBBBBBBk....',
        '...kBBBBBBBBk...', '..kBBooooooBBk..', '..kBoooGGoooBk..', '..kBooGLLGooBk..', '..kBoooGgoooBk..', '..kBBooooooBBk..',
        '..kbBBBBBBBBbk..', '...kbbbbbbbbk...', '....kkkkkkkk....', '................',
    ],
    sun: ['...yy...', '.y.hh.y.', '..hyyh..', 'yhyyyyhy', 'yhyyyyhy', '..hyyh..', '.y.hh.y.', '...yy...'],
    star: ['...y....', '...y....', '..yoy...', 'yyoooyy.', '..yoy...', '...y....', '...y....', '........'],
    bubble: ['.kkkkkk.', 'koorrook', 'koorrook', 'koorrook', 'kooooook', 'koorrook', '.kkkkkk.', '...kk...'],
    bubbleSad: ['.kkkkkk.', 'kooooook', 'kooooook', 'kXoXoXok', 'kooooook', 'kooooook', '.kkkkkk.', '...kk...'],
}

// 꽃 단계 — 품종별(백엔드 api/views/farm.py SPECIES 키와 맞춤). 틀의 a/A=꽃잎, c/C=꽃술을 품종 색으로 바꿔 그림
const FLOWER_ROUND = [
    '......kkkk......', '.....kaaaak.....', '..kkkkaAAakkkk..', '.kaaaakkkkaaaak.', '.kaAAkccccCkAak.', '.kaAAkcccCCkAak.',
    '.kaaaakkkkaaaak.', '..kkkkaAAakkkk..', '.....kaaaak.....', '......kkkk......', '......kgGk......', '..kk..kgGk..kk..',
    '.kLGk.kgGk.kGLk.', '..kGgkkgGkkgGk..', '....kkkdkdkkk...', '................',
]
const FLOWER_TULIP = [
    '................', '....k..kk..k....', '...kak.kak.kak..', '...kaakaaakaak..', '...kaaaaaaaAak..', '...kaaaaaaAAak..',
    '...kAaaaaaAAAk..', '....kAAaaAAAk...', '.....kkkkkkk....', '.......kGk......', '..kk...kgk......', '.kLGk..kgk..kk..',
    '..kGgk.kgk.kGLk.', '...kGgkkgkkgGk..', '....kkkdkdkkk...', '................',
]
const SPECIES_LOOK = {
    daisy: [FLOWER_ROUND, 'oxyh'], sunflower: [FLOWER_ROUND, 'yhbd'], tulip: [FLOWER_TULIP, 'mM'],
    hydrangea: [FLOWER_ROUND, 'uUvV'], rose: [FLOWER_TULIP, 'pP'], goldtulip: [FLOWER_TULIP, 'yh'],
}
for (const [key, [tpl, colors]] of Object.entries(SPECIES_LOOK)) {
    const map = Object.fromEntries([...'aAcC'].map((ch, i) => [ch, colors[i] || ch]))
    SPRITES[`flower_${key}`] = tpl.map(row => [...row].map(ch => map[ch] || ch).join(''))
}

// 스타일 칩 등 DOM용 이미지
function px(rows) {
    let rects = ''
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (PALETTE[ch]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${PALETTE[ch]}"/>`
    }))
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges">${rects}</svg>`
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
export const PLANT_SPRITES = { 씨앗: px(SPRITES.씨앗), 새싹: px(SPRITES.새싹), 떡잎: px(SPRITES.떡잎), 꽃: px(SPRITES.flower_tulip) }
export const FLOWER_SPRITES = Object.fromEntries(Object.keys(SPECIES_LOOK).map(k => [k, px(SPRITES[`flower_${k}`])]))
// 게임 HUD용 도트 아이콘
export const ICONS = Object.fromEntries(['sign', 'mailbox', 'list', 'close', 'expand', 'seedBag', 'sun'].map(k => [k, px(SPRITES[k])]))
