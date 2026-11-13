# 우리반 공유 보드

학생들이 자료(파일)와 링크를 올려서 함께 볼 수 있는 패들렛 스타일 웹페이지입니다.
타이머와 잔잔한 배경음악(BGM) 기능이 함께 들어 있습니다.

## 주요 기능

- 📌 **공유 보드**: 학생들이 파일 또는 링크를 올리면 카드 형태로 실시간 표시
- ⏱ **타이머**: 프리셋(1/3/5/10/15/20/25분) + 직접 설정, 전체화면 모드, 종료 알림음
- 🎵 **잔잔한 BGM**: 외부 음원 없이 코드로 즉석 생성되는 앰비언트 사운드 3종(패드/빗소리/로파이 아르페지오)
- 🔊 **소리 테스트 버튼**: 소리가 안 들릴 때 원인(기기 음량·무음 모드·출력 장치)을 바로 확인
- 📥 **시험·면접 자료 다운로드**: ISEE Middle Level 기출 유형 문제집, 영어면접 필수 문장 암기북 (PDF)

### 소리가 안 들릴 때

1. 🔊 소리 테스트 버튼을 눌러 '딩동' 소리를 확인하세요.
2. iPhone/iPad는 옆면 **무음 스위치**를 확인하세요. (최신 iOS Safari는 무음 상태에서도 재생되도록 처리했어요.)
3. 컴퓨터는 출력 장치(스피커/블루투스)와 브라우저 탭 음소거 여부를 확인하세요.
4. 브라우저 정책상 소리는 반드시 **버튼을 직접 누른 뒤에만** 나올 수 있어요. 타이머 알림음은 '시작' 버튼을 누를 때 미리 준비됩니다.

## 파일 구성

```
index.html          메인 페이지
css/style.css        디자인
js/firebase-config.js  Firebase 설정값 (직접 채워 넣어야 함)
js/app.js            보드(자료/링크 업로드) 로직
js/audio.js          공용 오디오(자동재생 정책·iOS 무음 스위치 대응)
js/timer.js          타이머 로직
js/bgm.js            BGM 생성 로직
downloads/           다운로드용 PDF (ISEE 문제집, 면접 암기북)
```

## 실행 방법

별도 서버 설치 없이 정적 파일이라 바로 열어도 되지만, 브라우저 보안 정책상
`file://` 로 열면 일부 기능(모듈 import)이 막힐 수 있어 간단한 로컬 서버로 여는 것을 권장합니다.

```bash
python3 -m http.server 8000
# 이후 브라우저에서 http://localhost:8000 접속
```

또는 GitHub Pages로 배포하면 학생들이 링크 하나로 바로 접속할 수 있습니다
(저장소 Settings → Pages → Branch를 main으로 지정).

## 여러 기기에서 실시간 공유하기 (Firebase 설정)

`js/firebase-config.js` 에 값을 채우기 전까지는 **로컬 모드**로 동작합니다.
(같은 브라우저에서는 저장되지만, 다른 학생 기기와는 공유되지 않아요.)

여러 학생 기기에서 실시간으로 같은 보드를 보려면 Firebase(무료)를 연결하세요.

1. [Firebase 콘솔](https://console.firebase.google.com/) 접속 → 구글 계정으로 로그인 → "프로젝트 추가"
2. 프로젝트 생성 후, 왼쪽 메뉴 **Build → Firestore Database** → "데이터베이스 만들기"
   - 위치는 `asia-northeast3 (서울)` 추천
   - 처음엔 "테스트 모드"로 시작해도 되지만, 아래 3번의 보안 규칙으로 바꿔주세요
3. Firestore **규칙(Rules)** 탭에서 아래 규칙으로 교체 후 게시:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /rooms/{roomCode}/posts/{postId} {
         allow read: if true;
         allow create: if request.resource.data.author is string
                       && request.resource.data.type in ['file', 'link'];
         allow delete: if true;
         allow update: if false;
       }
     }
   }
   ```

   > 참고: 이 규칙은 로그인 없이 누구나 읽고/쓰고/삭제할 수 있는 **교실용 간이 규칙**입니다.
   > 반 코드를 추측하기 어렵게 정하면(예: `3-2-giga0716`) 외부인 접근 위험을 줄일 수 있어요.
   > 더 엄격한 보안이 필요하면 Firebase Anonymous Auth를 추가해 작성자 인증을 걸 수 있습니다.

4. 왼쪽 메뉴 **프로젝트 설정(톱니바퀴) → 일반** → "내 앱" → `</>` (웹 앱) 아이콘으로 앱 추가
   - 앱 닉네임 아무거나 입력 후 등록 (Firebase Hosting은 선택 안 해도 됨)
   - 화면에 나오는 `firebaseConfig` 객체를 복사
5. 복사한 값을 `js/firebase-config.js` 의 `firebaseConfig` 객체에 그대로 붙여넣기

   ```js
   export const firebaseConfig = {
     apiKey: "실제 값",
     authDomain: "실제 값",
     projectId: "실제 값",
     storageBucket: "실제 값",
     messagingSenderId: "실제 값",
     appId: "실제 값",
   };
   ```

6. 저장 후 페이지를 새로고침하면 상태 표시가 "실시간 공유 중"으로 바뀝니다.

### 반 코드(room code)란?

같은 Firebase 프로젝트를 여러 학급이 함께 써도 게시물이 섞이지 않도록,
접속 시 "반 코드"를 입력하고 입장합니다. 같은 반 코드를 입력한 사람들끼리만
같은 보드를 보게 됩니다. 선생님이 반 코드를 학생들에게 알려주면 됩니다.

### 파일 업로드 용량 제한

Firestore 문서 하나의 최대 크기는 1MB라서, 파일은 base64로 인코딩해 문서에
직접 저장하며 **700KB 이하**로 제한했습니다. 더 큰 파일(영상 등)은 구글
드라이브 등에 올린 뒤 링크로 공유하도록 안내해주세요.

## 커스터마이징 힌트

- `js/bgm.js` 의 `SCALE` 배열을 바꾸면 다른 분위기의 음계로 BGM을 만들 수 있어요.
- `index.html` 의 타이머 프리셋 버튼(`data-min`)을 추가/삭제해 원하는 시간 구성으로 바꿀 수 있어요.
- `css/style.css` 상단 `:root` 변수(`--accent` 등)로 전체 색상 테마를 바꿀 수 있어요.
