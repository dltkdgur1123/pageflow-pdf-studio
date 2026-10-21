<img src="./docs/assets/readme/01-workspace.png" width="100%" alt="PageFlow PDF 문서 작업 공간" />

# PageFlow — PDF Studio

🗓 공개 배포 : 2026년 10월<br />
📌 프로젝트 유형 : 브라우저 기반 PDF 페이지 정리·편집 웹 애플리케이션<br />
🧩 역할 : 작업 흐름 기획, 화면 구성, 실제 사용 피드백을 통한 기능 개선·검증

> 여러 PDF에서 필요한 페이지를 모으고, 글자·도형·필기를 추가한 뒤 새로운 PDF로 저장하는 문서 작업 도구입니다.<br />
> 파일을 서버에 업로드하지 않고 브라우저 안에서 처리하며, 설치나 회원가입 없이 사용할 수 있습니다.

**[🌐 PageFlow 사용하기](https://pageflow-pdf-studio.vercel.app/)** · **[📄 체험용 PDF](./docs/samples/portfolio-sample.pdf)**

<br />

# 목차

1. [프로젝트 소개](#-프로젝트-소개)
2. [문서 작업 흐름](#-문서-작업-흐름)
3. [핵심 기능](#-핵심-기능)
4. [기술 스택](#-기술-스택)
5. [프로젝트 구조](#-프로젝트-구조)
6. [사용자 피드백과 개선](#-사용자-피드백과-개선)
7. [운영·검증 기준](#-운영검증-기준)
8. [실행 방법](#-실행-방법)
9. [문서 처리와 공개 원칙](#-문서-처리와-공개-원칙)
10. [포트폴리오 요약](#-포트폴리오-요약)

<br />

# 📖 프로젝트 소개

여러 PDF에서 필요한 페이지만 골라 하나의 문서로 만들거나, 문서 위에 간단한 설명과 표시를 추가해야 하는 경우가 있습니다. 이때 파일 확인, 페이지 정리, 편집, 저장을 오가며 작업하면 현재 어떤 페이지를 다루고 있는지 놓치기 쉽습니다.

PageFlow는 이 과정을 하나의 작업 공간으로 구성했습니다.

```text
PDF 불러오기
→ 원본과 페이지 미리보기
→ 필요한 페이지 선택·정리
→ 글자·도형·필기 추가
→ 결과 확인
→ PDF 저장
```

핵심은 **원본 파일을 유지하면서, 선택한 페이지와 편집 결과를 눈으로 확인하며 새 문서를 만드는 것**입니다.

왼쪽은 파일 관리, 가운데는 현재 페이지 미리보기, 오른쪽은 페이지 선택과 정리에 사용합니다. 기획과 실제 사용 피드백을 바탕으로 개선했으며, 코드 구현과 테스트 정리에 AI 코딩 도구를 활용했습니다.

<br />

# 🔁 문서 작업 흐름

<img src="./docs/assets/readme/02-pages.png" width="100%" alt="PDF 페이지를 확인하고 선택하는 화면" />

## 기본 흐름

```text
1. 파일 불러오기
   - 여러 PDF를 선택하거나 작업 공간으로 드래그
   - 파일별 페이지 수와 미리보기 확인

2. 페이지 정리
   - 개별 페이지 또는 범위를 선택
   - 순서 변경, 복제, 삭제, 회전
   - 선택한 페이지로 별도 문서 구성

3. 페이지 편집
   - 미리보기에서 편집 화면 열기
   - 텍스트, 도형, 선, 펜 추가
   - 확대·축소하며 위치와 크기 조정

4. 확인 및 저장
   - 미리보기와 되돌리기로 결과 확인
   - 현재 문서를 새 PDF로 저장
   - 저장 취소·실패 시 작업 상태 유지
```

<br />

# 📝 핵심 기능

| 기능 | 설명 |
|---|---|
| 여러 PDF 관리 | 파일별 페이지를 불러와 원본 작업 공간에서 확인합니다. |
| 페이지 선택·정리 | 범위 선택, 순서 변경, 복제, 삭제, 회전을 지원합니다. |
| 선택 페이지 문서 구성 | 필요한 페이지만 모아 별도 문서를 만듭니다. |
| 텍스트·도형·필기 | 글자, 사각형, 타원, 선, 펜을 추가하고 위치와 크기를 조정합니다. |
| 문서 검색·OCR | PDF 텍스트와 OCR 기반 검색 결과를 강조 표시합니다. |
| 지우개·배경 보정 | 추가한 내용 지우기와 원본 이미지의 배경 보정을 구분합니다. |
| PDF 저장 | 지원 브라우저에서는 저장 위치를 선택하고, 그 외에는 다운로드 방식으로 저장합니다. |

<img src="./docs/assets/readme/03-editor.png" width="100%" alt="텍스트와 도형을 추가하는 페이지 편집 화면" />

배경 보정은 주변 종이색을 이용하는 실험적 기능입니다. 가려진 그림이나 글자를 의미에 맞게 재생성하는 AI 복원 기능은 아닙니다.

<br />

# ✨ 기술 스택

<b>Frontend / Interaction</b>
<p align="left">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5" />
  <img src="https://img.shields.io/badge/CSS-663399?style=for-the-badge&logo=css&logoColor=white" alt="CSS" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Canvas_API-334155?style=for-the-badge" alt="Canvas API" />
</p>

<b>Document / Search</b>
<p align="left">
  <img src="https://img.shields.io/badge/PDF.js-FF9500?style=for-the-badge" alt="PDF.js" />
  <img src="https://img.shields.io/badge/pdf--lib-2563EB?style=for-the-badge" alt="pdf-lib" />
  <img src="https://img.shields.io/badge/Tesseract.js-008080?style=for-the-badge" alt="Tesseract.js" />
</p>

<b>Test / Deployment</b>
<p align="left">
  <img src="https://img.shields.io/badge/Node.js-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white" alt="GitHub Actions" />
  <img src="https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" />
</p>

| 구성 | 역할 |
|---|---|
| HTML·CSS·JavaScript | 파일 목록, 미리보기, 페이지 선택과 편집 화면 |
| Canvas API | 페이지 위 편집 요소 표시와 이미지 보정 |
| PDF.js | PDF 렌더링과 텍스트 추출 |
| pdf-lib | 페이지 복사·조합·회전과 결과 PDF 생성 |
| Tesseract.js | 스캔 문서의 OCR 검색 보조 |
| Node.js·GitHub Actions | 기능 검사와 배포 자산 생성 |
| Vercel | 정적 사이트 공개 배포와 GitHub 연동 |

<br />

# 🗂 프로젝트 구조

```text
pageflow-pdf-studio/
├─ dist/                       # 실행 가능한 정적 사이트와 원본 소스
│  ├─ index.html               # PDF 작업 공간
│  ├─ app.js                   # 화면·편집·저장 흐름
│  ├─ core.mjs                 # 페이지 처리·검색 좌표·배경 보정
│  ├─ songbook.mjs             # 곡 단위 페이지 선택 보조
│  ├─ style.css                # 화면 스타일
│  └─ vendor/                  # PDF·OCR 라이브러리와 라이선스 고지
│
├─ docs/
│  ├─ assets/readme/           # 개인정보 없는 시험용 문서 화면
│  └─ samples/                 # 체험용 PDF
│
├─ scripts/
│  ├─ prepare-assets.mjs      # 해시가 붙은 배포 자산 생성
│  └─ serve.mjs               # 로컬 정적 서버
│
├─ .github/workflows/check.yml # 자동 검사
├─ test.mjs                   # 페이지 처리 검사
├─ test-save.mjs              # 저장 흐름 검사
├─ test-highlights.mjs        # 검색 강조 좌표 검사
├─ test-songs.mjs             # 곡 선택 검사
├─ test-restore.mjs           # 배경 보정 검사
├─ package.json
└─ vercel.json                # 검사·빌드·배포 설정
```

<br />

# 🛠 사용자 피드백과 개선

실제 PDF를 다루면서 발견한 불편을 화면 구성과 동작 개선으로 연결했습니다.

| 발견한 문제 | 개선 내용 | 개선 목적 |
|---|---|---|
| 파일 추가 버튼이 여러 곳에 반복됨 | 상단 중복 버튼 제거 | 파일 관리 위치를 명확하게 정리 |
| 선택 페이지 작업 버튼이 크고 떨어져 있음 | 복제·삭제와 같은 선택 작업 영역에 배치 | 선택 후 할 수 있는 작업을 함께 제공 |
| 편집 메뉴를 찾기 어려움 | 미리보기 아래 편집 버튼 추가 | 현재 보고 있는 페이지에서 바로 편집 |
| 펜·지우개 크기가 잘 보이지 않음 | 크기에 대응하는 커서와 확대·축소 추가 | 적용 범위를 확인하며 작업 |
| 글자 크기를 바꾸면 입력 흐름이 끊김 | 투명한 인라인 입력과 편집 상태 유지 | 문서 위에서 위치와 글자 크기를 함께 확인 |
| 지우개가 흰색 덧칠처럼 보임 | 추가 내용 삭제와 원본 배경 보정 분리 | 작업 목적에 맞는 처리 방식 제공 |
| 컬러 영역 보정에서 색이 번짐 | 대상 색을 배경 샘플에서 제외 | 주변 색이 보정 영역으로 번지는 현상 완화 |

<br />

# ✅ 운영·검증 기준

## 처리 구조

```text
사용자 PDF
→ 브라우저 메모리에서 읽기
→ PDF.js 미리보기·텍스트 추출
→ 페이지 구성 및 Canvas 편집
→ pdf-lib 결과 문서 생성
→ 사용자 컴퓨터에 저장
```

원본 파일을 덮어쓰지 않고 결과를 별도 PDF로 저장합니다. 자동 검사는 페이지 처리와 저장 예외 상황을 중심으로 구성했습니다.

| 검증 영역 | 확인 내용 |
|---|---|
| 페이지 처리 | 범위 입력, 순서 변경, 병합·추출·회전, 원본 데이터 유지 |
| 저장 예외 | 저장 성공·취소·권한 거절·다운로드 대체·쓰기 실패 |
| 검색 표시 | 한글·반복·부분 검색 결과와 강조 좌표 |
| 문서 선택 | 곡 단위 선택, 페이지 참조와 순서 |
| 배경 보정 | 종이색 보정, 인쇄선 보호, 색 번짐 방지, 이미지 대체 출력 |
| 공개 배포 | 로그인 없는 접속, 시험용 PDF 불러오기와 미리보기 |

GitHub Actions에서 검사와 빌드를 실행하며, Vercel도 배포 전에 같은 검사·빌드를 수행합니다. `main` 브랜치 변경은 Vercel에 자동 반영됩니다.

## 현재 범위와 개선 과제

- 자동 저장과 새로고침 후 작업 복구는 아직 지원하지 않습니다.
- 파일당 최대 300MB를 허용하지만 실제 처리 가능한 양은 기기 메모리와 문서 구조에 따라 달라집니다.
- OCR 정확도는 문서의 언어, 글꼴, 스캔 품질에 영향을 받습니다.
- 원본 배경 보정은 사진·그라데이션·복잡한 무늬에서 결과가 제한적입니다. 보정한 페이지는 이미지로 저장되어 기존 텍스트 선택·벡터 특성이 유지되지 않습니다.
- 향후 개선 과제는 작업 자동 복구, 대용량 문서 안정성, 브라우저별 검증입니다.

<br />

# 💻 실행 방법

## 웹에서 체험

[PageFlow](https://pageflow-pdf-studio.vercel.app/)에 접속한 뒤 [체험용 PDF](./docs/samples/portfolio-sample.pdf)를 내려받아 불러옵니다. 페이지 선택, 편집, PDF 저장을 확인할 수 있습니다.

## 로컬 실행

Node.js 20 이상이 필요하며, 별도 API 키나 환경변수는 사용하지 않습니다.

```bash
git clone https://github.com/dltkdgur1123/pageflow-pdf-studio.git
cd pageflow-pdf-studio
npm ci
npm test
npm run build
npm start
```

브라우저에서 `http://127.0.0.1:4173`을 엽니다.

## 수정과 배포

`dist/app.js`, `dist/core.mjs`, `dist/style.css`처럼 해시 없는 소스를 수정한 뒤 `npm run build`로 배포 자산을 갱신합니다.

Vercel에서는 저장소 최상위를 연결합니다. `vercel.json`에 설치 명령 `npm ci --ignore-scripts`, 검사·빌드 명령 `npm test && npm run build`, 출력 폴더 `dist`가 지정되어 있습니다.

<br />

# 🔐 문서 처리와 공개 원칙

- 가져온 PDF의 내용은 브라우저에서 처리하며 앱 서버로 업로드하지 않습니다.
- 원본 파일을 직접 수정하거나 덮어쓰지 않습니다.
- 공개 화면과 예제 PDF는 개인정보 없는 시험용 자료입니다.
- 실제 사용자 문서, 예약 정보, 인증 정보와 비공개 배포 설정은 공개 자료에서 제외했습니다.
- 타사 라이브러리는 `dist/vendor/`의 라이선스와 고지를 따릅니다. 자체 코드의 오픈소스 라이선스는 아직 지정하지 않았습니다.

<br />

# 📌 포트폴리오 요약

## Problem

여러 PDF에서 필요한 페이지를 모으고 간단히 편집할 때 파일 확인, 페이지 선택, 편집, 저장 흐름이 흩어지기 쉽습니다. 버튼 위치와 이름이 모호하면 사용자가 작업 결과를 예측하기도 어렵습니다.

## Action

파일 관리·미리보기·페이지 선택을 하나의 화면에 배치하고, PDF 처리와 편집 기능을 연결했습니다. 실제 사용 피드백을 바탕으로 중복 버튼, 선택 작업 위치, 편집 진입, 브러시 표시와 텍스트 입력 방식을 반복 개선했습니다. 저장 예외와 문서 처리 로직을 자동 검사로 확인하고 GitHub·Vercel 배포를 연결했습니다.

## Result

**설치 없이 PDF를 불러와 페이지를 정리하고 편집한 결과를 저장할 수 있는 웹 작업 공간**을 공개 배포했습니다. 화면 기획부터 사용 피드백 반영, 기능 검증, 배포까지 이어지는 과정을 이 저장소에서 확인할 수 있습니다.

```text
브라우저 안에서 PDF 처리
+ 페이지 선택·정리·문서 구성
+ 텍스트·도형·필기 편집
+ 실제 사용 피드백 기반 UI 개선
+ 저장 예외 검사와 공개 배포
```
