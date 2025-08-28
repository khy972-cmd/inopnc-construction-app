# 건설현장관리 시스템

건설 현장의 작업 관리 및 경비 관리를 위한 Progressive Web App (PWA) 시스템입니다.

## 📱 **앱 구성**

### 1. **메인 앱 (작업자용)**
- **URL**: `/index.html`
- **용도**: 일일 작업 기록, 경비 입력, 수익 분석
- **PWA 매니페스트**: `manifest.webmanifest`
- **테마 색상**: 초록색 (#28a745)

### 2. **관리자 콘솔 (관리자용)**
- **URL**: `/admin-console.html`
- **용도**: 작업자 관리, 데이터 업로드, 시스템 설정
- **PWA 매니페스트**: `admin-manifest.webmanifest`
- **테마 색상**: 파란색 (#0068FE)

## 🚀 **PWA 설치 방법**

### **메인 앱 설치**
1. 브라우저에서 `index.html` 접속
2. 주소창 옆 "설치" 버튼 클릭 또는
3. 메뉴 → "앱으로 설치" 선택
4. 홈 화면에 앱 아이콘 생성

### **관리자 콘솔 설치**
1. 브라우저에서 `admin-console.html` 접속
2. 우측 상단 "앱으로 설치" 버튼 클릭
3. 설치 확인 후 홈 화면에 별도 앱 아이콘 생성

## ✨ **주요 기능**

### **메인 앱**
- 📅 일일 작업 기록 관리
- 💰 경비 내역 입력
- 📊 수익 분석 및 차트
- 🌙 다크/라이트 테마 지원
- 📱 PWA로 앱처럼 사용

### **관리자 콘솔**
- 👥 작업자 정보 관리
- 📤 엑셀 데이터 업로드
- 🔍 데이터 검증 및 분석
- ⚙️ 시스템 설정 관리
- 📊 통계 및 현황 모니터링

## 🛠️ **기술 스택**

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Database**: PostgreSQL (Supabase)
- **PWA**: Service Worker, Web App Manifest
- **UI Framework**: Font Awesome, Google Fonts
- **Data Processing**: SheetJS (XLSX)

## 📋 **설치 요구사항**

- **브라우저**: Chrome 67+, Firefox 67+, Safari 11.1+, Edge 79+
- **모바일**: Android 5.0+, iOS 11.3+
- **네트워크**: HTTPS 환경 (PWA 설치 필수)

## 🔧 **개발 환경 설정**

```bash
# 저장소 클론
git clone https://github.com/khy972-cmd/inopnc-construction-app.git

# 프로젝트 폴더로 이동
cd inopnc-construction-app

# 로컬 서버 실행 (HTTPS 필요)
python -m http.server 8000
# 또는
npx serve -s . -l 8000
```

## 📁 **파일 구조**

```
├── index.html              # 메인 앱 (작업자용)
├── admin-console.html      # 관리자 콘솔
├── manifest.webmanifest    # 메인 앱 PWA 설정
├── admin-manifest.webmanifest # 관리자 콘솔 PWA 설정
├── service-worker.js       # PWA 서비스 워커
├── SQL.txt                 # 데이터베이스 스키마
└── README.md               # 프로젝트 설명서
```

## 🌐 **배포**

- **Vercel**: `https://inopnc-construction-app.vercel.app`
- **GitHub Pages**: 자동 배포 지원
- **로컬**: HTTPS 환경에서 PWA 테스트 가능

## 📞 **지원**

- **이슈 리포트**: GitHub Issues
- **기능 요청**: GitHub Discussions
- **문의**: 저장소 관리자에게 연락

## 📄 **라이선스**

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

---

**건설현장관리 시스템** - 효율적인 현장 관리의 시작 🏗️ 
