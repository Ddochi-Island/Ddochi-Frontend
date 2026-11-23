// 밭 게임 모드용 2D 도트 스프라이트·타일 — 문자 격자 원본 + SVG data URI 변환
export const PALETTE = {
    k: '#3b2a1a', s: '#8b5e3c', d: '#6b4428', l: '#a8774a',
    g: '#3f8a3a', G: '#5fb24e', L: '#9ad86a',
    b: '#7a4a22', B: '#c08a4a', w: '#c98c4e', W: '#e2b073',
    o: '#fffdf5', r: '#f57f17', h: '#e8c15a', H: '#b5652b', f: '#f4c9a0',
    c: '#4a7fc1', C: '#335f99', x: '#a5a29a', X: '#77736b', m: '#d9534f', M: '#9e2f2b',
    y: '#f6d55c', p: '#f2a7c3', P: '#e0679a',
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
    flower: ['........', '..p.y...', '.pyp.yy.', '..p.yky.', '...g.y..', '..Gg.g..', '...gGg..', '........'],
    rock: ['........', '........', '..kkkk..', '.kxxxXk.', 'kxxxxXXk', 'kXxxXXXk', '.kkkkkk.', '........'],
    grass: ['GGGGGGGG', 'GGGGGLGG', 'GGgGGGGG', 'GGGGGGGG', 'GGGGGGgG', 'GLGGGGGG', 'GGGGGGGG', 'GGGgGGGG'],
    soil: ['ssssssss', 'slssssls', 'dddddddd', 'ssssssss', 'sssslsss', 'ssssssss', 'dddddddd', 'ssssssss'],
    fence: ['..kkkk..', '.kWWwk..', 'kkkkkkkk', 'WWWWWWWW', 'wwwwwwww', 'kkkkkkkk', '.kWwwk..', '.kkkkk..'],
    fenceV: ['..kkkk..', '.kWWwk..', '.kWwwk..', '.kWwwk..', '.kWwwk..', '.kWwwk..', '.kWwwk..', '.kWwwk..'],
    bubble: ['.kkkkkk.', 'koorrook', 'koorrook', 'koorrook', 'kooooook', 'koorrook', '.kkkkkk.', '...kk...'],
    bubbleSad: ['.kkkkkk.', 'kooooook', 'kooooook', 'kXoXoXok', 'kooooook', 'kooooook', '.kkkkkk.', '...kk...'],
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
export const PLANT_SPRITES = { 씨앗: px(SPRITES.씨앗), 새싹: px(SPRITES.새싹), 떡잎: px(SPRITES.떡잎) }
