/**
 * mobile-bridge.js
 * app.js의 Firebase 데이터를 모바일 UI에 연결하는 어댑터
 * 
 * 사용법: index.html에서 app.js 다음에 import
 *   <script type="module" src="mobile-bridge.js"></script>
 * 
 * app.js가 window._allLogs, window._currentUserName, window._currentUserPhoto
 * 를 expose하도록 아래 2군데만 수정 필요 (주석 참고).
 */

// ─── 모바일 폼 → desktop 폼 동기화 ───
// 모바일 시트의 입력을 desktop form 필드에 미러링하여
// 기존 app.js submit 로직을 그대로 재활용합니다.

function mirrorMobileToDesktop() {
  const mDate   = document.getElementById('dateInputM');
  const mName   = document.getElementById('nameInputM');
  const mDetail = document.getElementById('detailInputM');
  const mZone   = document.getElementById('zoneInputM');
  const mPts    = document.getElementById('pointsInputM');

  const dDate   = document.getElementById('dateInput');
  const dName   = document.getElementById('nameInput');
  const dDetail = document.getElementById('detailInput');
  const dZone   = document.getElementById('zoneInput');
  const dPts    = document.getElementById('pointsInput');

  if (!mDate || !dDate) return;

  // 값 변경 시 desktop 필드에 미러
  [mDate, mDetail, mZone, mPts].forEach(el => {
    el?.addEventListener('input', syncFields);
    el?.addEventListener('change', syncFields);
  });

  function syncFields() {
    if (dDate)   dDate.value   = mDate?.value   || '';
    if (dDetail) dDetail.value = mDetail?.value || '';
    if (dZone)   dZone.value   = mZone?.value   || '';
    if (dPts)    dPts.value    = mPts?.value     || '';
  }

  // 모바일 폼 submit → desktop form submit 이벤트 트리거
  const mForm = document.getElementById('choreFormM');
  mForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    syncFields();
    // desktop form submit 이벤트 발생 (app.js가 처리)
    const dForm = document.getElementById('choreForm');
    dForm?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

// ─── desktop form submit 완료 후 시트 닫기 & 모바일 폼 리셋 ───
// app.js에서 성공 toast를 띄운 뒤 아래 훅이 실행됩니다.
// app.js 내 성공 처리 부분에 window.onChoreAdded?.() 호출 한 줄만 추가하세요.
window.onChoreAdded = function() {
  // 시트 닫기
  document.getElementById('choreSheet')?.classList.remove('open');
  document.getElementById('sheetOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
  // 모바일 폼 초기화
  document.getElementById('choreFormM')?.reset();
  // nameInput 복원 (readonly라 reset으로 지워짐)
  const mName = document.getElementById('nameInputM');
  const dName = document.getElementById('nameInput');
  if (mName && dName) mName.value = dName.value;
};

// ─── 사용자 정보 모바일 UI 반영 ───
// app.js에서 로그인 완료 후 아래를 호출하세요:
//   window.setMobileUser(user.displayName, user.photoURL, user.email)
window.setMobileUser = function(name, photo, email) {
  window._currentUserName = name;

  const ids = ['userAvatarM', 'profileAvatarM'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && photo) { el.src = photo; el.alt = name; }
  });

  const nameInputM = document.getElementById('nameInputM');
  if (nameInputM) nameInputM.value = name || '';

  const profileName = document.getElementById('profileNameM');
  if (profileName) profileName.textContent = name || '';

  const profileEmail = document.getElementById('profileEmailM');
  if (profileEmail) profileEmail.textContent = email || '';
};

// ─── 로그 목록 → 모바일 UI 렌더링 ───
// app.js에서 Firestore 리스너로 logs 배열을 받을 때:
//   window.updateMobileLogs(logs, currentUserName)
window.updateMobileLogs = function(logs, currentUserName) {
  window._allLogs = logs;
  window._currentUserName = currentUserName || window._currentUserName || '';

  renderMobileLists(logs);
  updateScoreCard(logs, window._currentUserName);
  updateRankRow(logs);
};

// ─── 점수 카드 업데이트 ───
function updateScoreCard(logs, me) {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  const myMonthly = logs
    .filter(l => l.name === me && l.date?.startsWith(thisMonth))
    .reduce((s, l) => s + (Number(l.points) || 0), 0);

  const scoreEl = document.getElementById('myScoreM');
  if (scoreEl) scoreEl.textContent = myMonthly.toLocaleString();

  // 전체 랭킹 계산
  const totals = {};
  logs.filter(l => l.date?.startsWith(thisMonth)).forEach(l => {
    totals[l.name] = (totals[l.name] || 0) + (Number(l.points) || 0);
  });
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const myRank = sorted.findIndex(([n]) => n === me) + 1;
  const rankEl = document.getElementById('myRankM');
  if (rankEl) {
    const medals = ['🥇', '🥈', '🥉'];
    rankEl.textContent = myRank > 0
      ? `${medals[myRank-1] || `#${myRank}`} 전체 ${myRank}위 · 이번 달`
      : '이번 달 활동을 기록해보세요!';
  }
}

// ─── 랭킹 행 업데이트 ───
function updateRankRow(logs) {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const totals = {};
  logs.filter(l => l.date?.startsWith(thisMonth)).forEach(l => {
    totals[l.name] = (totals[l.name] || 0) + (Number(l.points) || 0);
  });
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const row = document.getElementById('rankRowM');
  if (!row) return;
  if (sorted.length === 0) {
    row.innerHTML = `<div class="rank-pill" style="color:#94a3b8;font-size:12px">이번 달 기록 없음</div>`;
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  row.innerHTML = sorted.map(([name, pts], i) => {
    const isMe = name === window._currentUserName;
    return `<div class="rank-pill ${isMe ? 'me' : ''}">
      <span>${medals[i] || `#${i+1}`}</span>
      <span>${name}</span>
      <span style="color:var(--orange);font-weight:900">${pts}pt</span>
    </div>`;
  }).join('');
}

// ─── 초기화 ───
document.addEventListener('DOMContentLoaded', () => {
  mirrorMobileToDesktop();

  // 날짜 기본값
  const today = new Date().toISOString().split('T')[0];
  const mDate = document.getElementById('dateInputM');
  if (mDate) mDate.value = today;

  // 모바일 로그아웃 버튼
  document.getElementById('logoutBtnM')?.addEventListener('click', () => {
    document.getElementById('logoutBtn')?.click();
  });
});

// ─── app.js 연동 가이드 (주석) ───
/*
app.js에서 아래 3군데만 추가/수정하면 됩니다:

1. 로그인 성공 콜백에서:
   window.setMobileUser(user.displayName, user.photoURL, user.email);

2. Firestore onSnapshot 리스너에서 logs 배열 구성 후:
   window.updateMobileLogs(logs, currentUser.displayName);

3. 활동 등록 성공 후 (showToast 호출 근처):
   window.onChoreAdded?.();
*/
