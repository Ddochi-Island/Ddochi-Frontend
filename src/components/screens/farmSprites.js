// 밭 게임 모드용 2D 도트 스프라이트·타일 — 문자 격자를 SVG data URI로 변환
const PALETTE = {
    k: '#3b2a1a', s: '#8b5e3c', d: '#6b4428', l: '#a8774a',
    g: '#3f8a3a', G: '#5fb24e', L: '#9ad86a',
    b: '#7a4a22', B: '#c08a4a', w: '#c98c4e', W: '#e2b073',
}

function px(rows) {
    let rects = ''
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (PALETTE[ch]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${PALETTE[ch]}"/>`
    }))
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges">${rects}</svg>`
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// 단계별 식물 (16x16)
export const PLANT_SPRITES = {
    씨앗: px([
        '................', '................', '................', '................',
        '................', '................', '................', '................',
        '................', '................', '................', '......kkkk......',
        '.....kBBbbk.....', '....dkBbbbkd....', '...ddskkkksdd...', '................',
    ]),
    새싹: px([
        '................', '................', '................', '................',
        '................', '................', '..kkk......kkk..', '.kLLGk....kGLLk.',
        '.kLGGGk..kGGGLk.', '..kGGggkkggGGk..', '...kkkgGGgkkk...', '......kgGk......',
        '......kgGk......', '......kgGk......', '....dddkkddd....', '................',
    ]),
    떡잎: px([
        '................', '......kkkk......', '.....kLLGGk.....', '..kkkkLGGgkkkk..',
        '.kLLGGkGgkGGLLk.', 'kLLGGGGkkGGGGLLk', 'kLGGGggkkggGGGLk', '.kGGgggkkgggGGk.',
        '..kkkkkGgkkkkk..', '.......kGk......', '.......kgk......', '...kk..kgk..kk..',
        '..kLGk.kgk.kGLk.', '...kGgkkgkkgGk..', '....kkkdkdkkk...', '................',
    ]),
}

// 반복 타일 (8x8)
export const TILES = {
    grass: px(['GGGGGGGG', 'GGGGGLGG', 'GGgGGGGG', 'GGGGGGGG', 'GGGGGGgG', 'GLGGGGGG', 'GGGGGGGG', 'GGGgGGGG']),
    soil: px(['ssssssss', 'slssssls', 'dddddddd', 'ssssssss', 'sssslsss', 'ssssssss', 'dddddddd', 'ssssssss']),
    fence: px(['..kkkk..', '.kWWwk..', 'kkkkkkkk', 'WWWWWWWW', 'wwwwwwww', 'kkkkkkkk', '.kWwwk..', '.kkkkk..']),
}
