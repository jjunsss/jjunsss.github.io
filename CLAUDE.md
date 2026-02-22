# CV Portfolio Site — CLAUDE.md

## Overview
Junsu Kim의 AI 연구자 포트폴리오. 단일 `index.html` 파일 (HTML + CSS + JS 인라인, ~1434줄).
배포: **GitHub Pages** → https://jjunsss.github.io/

## 배포 방법
```bash
git add index.html && git commit -m "update" && git push origin main && git push origin main:gh-pages
```

---

## 파일 구조 (`index.html` 단일 파일)

### CSS 섹션 (14–644줄)
| 섹션 | 줄 | 설명 |
|------|-----|------|
| DESIGN TOKENS | ~15 | `:root` / `[data-theme="dark"]` CSS 변수. 색상, 그림자, 반경, 전환 |
| NAVIGATION | ~106 | 상단 고정 nav, glassmorphism (`backdrop-filter`) |
| RAINBOW SHIMMER | ~147 | `shimmer-btn` 클래스. `::before` + hover 기반 무지개 sweep |
| HERO | ~186 | 프로필 사진, diffusion canvas, bio, 링크 버튼 |
| NEWS | ~309 | 뉴스 바 (badge + text) |
| SECTIONS | ~327 | 공통 섹션 헤더 (`section-header h2` + `section-line`) |
| INTERESTS | ~336 | 태그 pill 그리드 |
| PUBLICATIONS | ~348 | 횡스크롤 카드 캐러셀, 필터, highlight 카드 (gradient border) |
| SUMMARY TOOLTIP | ~458 | `pub-summary-popup` — body에 append되는 hover 팝업 |
| TIMELINE | ~512 | Education / Experience 타임라인 (왼쪽 세로선 + 원형 마커) |
| AWARDS | ~538 | 수상 목록 |
| ACTIVITIES | ~553 | 카드 그리드 |
| GALLERY | ~568 | 이미지 그리드, hover caption, diffusion canvas overlay |
| FOOTER | ~591 | 하단 링크 |
| ANIMATIONS | ~602 | `.reveal` 클래스 (IntersectionObserver 기반 fade-up) |
| RESPONSIVE | ~613 | `@media (max-width: 768px)` — 1열 레이아웃, 모바일 nav |
| SCROLLBAR | ~638 | 커스텀 스크롤바 |

### HTML 섹션 (649–1111줄)
| 섹션 | 줄 | ID/class |
|------|-----|----------|
| Navigation | ~649 | `#navbar`, `.nav-links` |
| Hero | ~674 | `#about`, `.hero-grid`, `#diffusionWrap`, `#diffusionCanvas` |
| News | ~715 | `.news-bar`, `.news-scroll` |
| Interests | ~737 | `.interests-grid`, `.interest-tag` |
| Publications | ~755 | `#publications`, `#pubCarousel`, `.pub-card` |
| Education & Experience | ~935 | `#experience`, `.timeline` |
| Awards & Service | ~986 | `#awards` |
| Teaching | ~1040 | `#activities` |
| Gallery | ~1062 | `#gallery`, `.gallery-grid`, `[data-diffuse]` |
| Footer | ~1102 | `<footer>` |

### JS 섹션 (1113–1430줄)
| 기능 | 줄 | 설명 |
|------|-----|------|
| Theme toggle | ~1115 | `toggleTheme()`, localStorage 저장, 시스템 prefers-color-scheme 감지 |
| Navbar scroll | ~1129 | scroll > 10px → `.scrolled` shadow |
| Reveal animations | ~1133 | IntersectionObserver → `.visible` 클래스 추가 |
| Summary Popup | ~1149 | `pub-summary-trigger` hover → body에 append된 popup 위치 조정 |
| Publication filters | ~1168 | `[data-filter]` 버튼 → `[data-venue]` 카드 show/hide |
| Carousel scroll | ~1184 | `scrollCarousel(dir)` — 좌우 카드 단위 스크롤 |
| Diffusion Effect (프로필) | ~1191 | Canvas에 Gaussian noise (Box-Muller) → 3초간 t=1000→t=0 denoising. 클릭 replay |
| Diffusion Effect (갤러리) | ~1337 | IntersectionObserver → 각 gallery-item 순차(200ms 간격) 2초 denoising |

---

## 디자인 시스템

### 색상 팔레트
- **Accent**: Indigo (`#4F46E5` light / `#818CF8` dark)
- **Gold**: Amber (`#D97706` light / `#FBBF24` dark) — highlight, 수상
- **Venue colors**: Green (top venue), Purple (workshop), Muted (arxiv)
- **Backgrounds**: `#F8F9FA` light / `#121212` dark

### 타이포그래피
- **Headings**: Playfair Display (serif)
- **Body**: Inter (sans-serif)
- **Code/Dates**: JetBrains Mono (monospace)

### 컴포넌트 패턴
- **카드**: `bg-card` + `border` + `radius-md` + hover시 `shadow-lg` + `translateY(-2~3px)`
- **Pill/태그**: `border-radius: 100px` + `border` + hover시 accent 색상
- **섹션 헤더**: `h2` (Playfair) + 오른쪽 gradient line
- **Rainbow shimmer**: `.shimmer-btn` 클래스 추가하면 hover시 무지개 sweep

---

## 주요 특수 기능

### Diffusion Denoising (AI 연구자 아이덴티티)
- **프로필 사진**: `#diffusionCanvas` — 페이지 로드시 자동 재생, 클릭으로 replay
- **갤러리**: `.gallery-diffusion` canvas — 스크롤시 순차 재생 (IntersectionObserver)
- **원리**: Canvas에 Gaussian noise를 그리고, opacity + noise variance를 시간에 따라 줄여서 아래 이미지가 드러남
- **테마 인식**: dark/light에 따라 noise tint 색상 변경
- **힌트**: `#diffusionHint` — 애니메이션 완료 후 "click to denoise" 표시

### Publication Carousel
- **필터**: All / Main Venue / Workshop / ArXiv → `data-venue` 속성으로 show/hide
- **Highlight 카드**: `.pub-card.highlight` → gradient border + 상단 shimmer bar + star label
- **Summary 팝업**: hover시 body-appended absolute popup (overflow 문제 방지)
- **모바일**: 팝업 숨김 (`display: none !important`), nav 버튼 숨김

---

## 수정 가이드

### 논문 추가
`#pubCarousel` 안에 `.pub-card` 추가. 필수 속성:
- `data-venue="main|workshop|arxiv"` (필터용)
- Highlight이면 `.pub-card.highlight` 클래스 + `.pub-highlight-label` 내용 추가

### 뉴스 추가
`.news-scroll` 안에 `.news-item` 추가. badge 클래스: `new` 또는 `highlight`.

### 갤러리 이미지 추가
`.gallery-grid` 안에 `<div class="gallery-item" data-diffuse>` 추가. `data-diffuse` 속성이 있으면 자동으로 diffusion 효과 적용.
내부에 `<canvas class="gallery-diffusion"></canvas>` 필수.

### 색상 변경
`:root` (light) / `[data-theme="dark"]` (dark) 의 CSS 변수만 수정.

### 이미지
현재 Google Sites CDN URL 사용. 로컬/자체 호스팅으로 교체 가능.
프로필 사진: `.hero-photo` 의 `src` 속성.

---

## 알려진 이슈 / TODO
- Google Scholar 링크의 `user=YOUR_ID` → 실제 ID로 교체 필요
- 이미지가 Google CDN URL — referrer policy로 일부 환경에서 로딩 안 될 수 있음 (GitHub Pages에서는 정상)
- Summary 팝업의 이미지가 placeholder ("Paper Figure") — 실제 논문 figure로 교체 가능
- `var (--accent)` 같은 공백 오타가 일부 CSS에 존재 (pub-venue.arxiv, pub-highlight-badge, pub-link:hover)
