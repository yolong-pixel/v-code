// Firebase 프로젝트 설정값을 여기에 붙여넣으세요.
// Firebase 콘솔(console.firebase.google.com) > 프로젝트 설정 > 일반 > "내 앱" 에서 확인할 수 있어요.
// 값을 채우기 전까지는 이 브라우저에서만 저장되는 로컬 모드로 동작합니다.
// 설정 방법은 README.md 를 참고하세요.

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

export const isFirebaseConfigured =
  firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");
