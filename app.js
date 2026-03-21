/**
 * Chore Tracker Application - HouseChod Ver.
 * Refactored for Stability & Detailed Error Logging
 * + Mobile UI Bridge (모바일 최적화 연동)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const CONFIG = {
    firebaseConfig: {
        apiKey: "REMOVED_FIREBASE_WEB_API_KEY",
        authDomain: "housechod.firebaseapp.com",
        projectId: "housechod",
        storageBucket: "housechod.firebasestorage.app",
        messagingSenderId: "818673632451",
        appId: "1:818673632451:web:dc4a1f33335fb98b59ce76"
    },
    appId: 'housechod-v1',
    defaultRules: [
        { match: "설거지|식세기",        zone: '주방',   pts: 10 },
        { match: "분리수거|음식물|쓰레기", zone: '외부',   pts: 15 },
        { match: "청소기|바닥|걸레",      zone: '거실',   pts: 10 },
        { match: "빨래|건조기",           zone: '다용도실', pts: 5 }
    ]
};

class ChoreApp {
    constructor() {
        this.app      = initializeApp(CONFIG.firebaseConfig);
        this.auth     = getAuth(this.app);
        this.db       = getFirestore(this.app);
        this.provider = new GoogleAuthProvider();
        this.provider.setCustomParameters({ prompt: 'select_account' });

        this.user         = null;
        this.rules        = CONFIG.defaultRules;
        this.charts       = { share: null, trend: null, shareM: null, trendM: null };
        this.colors       = ['#f97316', '#0f172a', '#3b82f6', '#10b981', '#a855f7', '#ec4899'];
        this.unsubscribers = [];

        this.init();
    }

    // ─────────────────────────────────────────────
    //  INIT
    // ─────────────────────────────────────────────
    init() {
        // 최대 5초 안전장치
        setTimeout(() => {
            document.getElementById('loadingOverlay')?.classList.add('hidden');
        }, 5000);

        onAuthStateChanged(this.auth, (user) => {
            const loader = document.getElementById('loadingOverlay');
            if (loader) {
                loader.classList.add('opacity-0', 'pointer-events-none');
                setTimeout(() => loader.classList.add('hidden'), 500);
            }

            this.unsubscribers.forEach(u => u());
            this.unsubscribers = [];
            this.user = user;

            this.toggleUI();

            if (user) {
                this.loadRules();
                this.loadData();
            }
        });

        this.bindEvents();
    }

    // ─────────────────────────────────────────────
    //  BIND EVENTS
    // ─────────────────────────────────────────────
    bindEvents() {
        const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
            .toISOString().split('T')[0];

        // ── Desktop form ──
        document.getElementById('logoutBtn').onclick       = () => signOut(this.auth);
        document.getElementById('choreForm').onsubmit      = (e) => this.handleSave(e, 'desktop');
        document.getElementById('detailInput').oninput     = (e) => this.handleAutoFill(e.target.value, 'desktop');
        document.getElementById('dateInput').value         = today;

        // ── Login button ──
        const loginBtn = document.getElementById('googleLoginBtn');
        if (loginBtn) {
            loginBtn.onclick = async () => {
                try {
                    await signInWithPopup(this.auth, this.provider);
                } catch (e) {
                    console.error("Login error:", e.code, e.message);
                    alert(`로그인 오류: ${e.message}`);
                }
            };
        }

        // ── Mobile form (Bottom Sheet) ──
        const mForm = document.getElementById('choreFormM');
        if (mForm) {
            mForm.onsubmit = (e) => this.handleSave(e, 'mobile');
        }

        const mDetail = document.getElementById('detailInputM');
        if (mDetail) {
            mDetail.oninput = (e) => this.handleAutoFill(e.target.value, 'mobile');
        }

        const dateInputM = document.getElementById('dateInputM');
        if (dateInputM) dateInputM.value = today;

        // ── Mobile logout (profile tab) ──
        const logoutBtnM = document.getElementById('logoutBtnM');
        if (logoutBtnM) logoutBtnM.onclick = () => signOut(this.auth);
    }

    // ─────────────────────────────────────────────
    //  TOGGLE UI  (login / logout)
    // ─────────────────────────────────────────────
    toggleUI() {
        const landing = document.getElementById('landingPage');
        const main    = document.getElementById('mainApp');

        if (this.user) {
            landing?.classList.add('hidden');
            main?.classList.remove('hidden');
            main?.classList.add('visible');

            // Desktop
            document.getElementById('userAvatar').src          = this.user.photoURL;
            document.getElementById('userNameDisplay').innerText = this.user.displayName;
            document.getElementById('nameInput').value          = this.user.displayName;

            // ── Mobile UI 사용자 정보 ──
            const avatarM    = document.getElementById('userAvatarM');
            const profileAvM = document.getElementById('profileAvatarM');
            const nameInputM = document.getElementById('nameInputM');
            const profileNm  = document.getElementById('profileNameM');
            const profileEm  = document.getElementById('profileEmailM');

            if (avatarM)    { avatarM.src = this.user.photoURL; avatarM.alt = this.user.displayName; }
            if (profileAvM) { profileAvM.src = this.user.photoURL; }
            if (nameInputM) nameInputM.value     = this.user.displayName;
            if (profileNm)  profileNm.textContent = this.user.displayName;
            if (profileEm)  profileEm.textContent = this.user.email;

        } else {
            landing?.classList.remove('hidden');
            main?.classList.add('hidden');
            main?.classList.remove('visible');
            document.getElementById('chartsSection')?.classList.add('hidden');
        }
    }

    // ─────────────────────────────────────────────
    //  RULES
    // ─────────────────────────────────────────────
    loadRules() {
        const ref  = doc(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'settings');
        const unsub = onSnapshot(ref, s => {
            this.rules = s.exists() ? s.data().rules : CONFIG.defaultRules;
        }, err => console.error("Rules sync failed:", err));
        this.unsubscribers.push(unsub);
    }

    // ─────────────────────────────────────────────
    //  AUTO FILL  (desktop ↔ mobile 공통)
    // ─────────────────────────────────────────────
    handleAutoFill(text, target = 'desktop') {
        if (!text.trim()) return;
        const rule = this.rules.find(r => new RegExp(r.match, 'i').test(text));
        if (!rule) return;

        if (target === 'desktop') {
            document.getElementById('zoneInput').value   = rule.zone;
            document.getElementById('pointsInput').value = rule.pts;
        } else {
            const zM = document.getElementById('zoneInputM');
            const pM = document.getElementById('pointsInputM');
            if (zM) zM.value = rule.zone;
            if (pM) pM.value = rule.pts;
        }
    }

    // ─────────────────────────────────────────────
    //  SAVE
    // ─────────────────────────────────────────────
    async handleSave(e, target = 'desktop') {
        e.preventDefault();
        if (!this.user) return;

        const isM = target === 'mobile';
        const payload = {
            date:      (document.getElementById(isM ? 'dateInputM'   : 'dateInput')).value,
            name:      this.user.displayName,
            detail:    (document.getElementById(isM ? 'detailInputM' : 'detailInput')).value.trim(),
            zone:      (document.getElementById(isM ? 'zoneInputM'   : 'zoneInput')).value || '기타',
            points:    parseInt((document.getElementById(isM ? 'pointsInputM' : 'pointsInput')).value) || 0,
            uid:       this.user.uid,
            createdAt: Date.now()
        };

        try {
            await addDoc(
                collection(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'chores'),
                payload
            );

            // 필드 초기화
            if (isM) {
                document.getElementById('detailInputM').value = '';
                document.getElementById('zoneInputM').value   = '';
                document.getElementById('pointsInputM').value = '';
                // Bottom Sheet 닫기
                document.getElementById('choreSheet')?.classList.remove('open');
                document.getElementById('sheetOverlay')?.classList.remove('open');
                document.body.style.overflow = '';
            } else {
                document.getElementById('detailInput').value = '';
                ['zoneInput', 'pointsInput'].forEach(id => document.getElementById(id).value = '');
            }

            this.toast("포인트 적립 완료! ✨");

        } catch (err) {
            console.error("Save error:", err);
            this.toast("저장 중 오류 발생", "err");
        }
    }

    // ─────────────────────────────────────────────
    //  DELETE
    // ─────────────────────────────────────────────
    async delete(id) {
        try {
            await deleteDoc(
                doc(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'chores', id)
            );
            this.toast("삭제되었습니다.");
        } catch (e) {
            this.toast("삭제 권한 없음", "err");
        }
    }

    // ─────────────────────────────────────────────
    //  LOAD DATA
    // ─────────────────────────────────────────────
    loadData() {
        const ref = collection(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'chores');
        const unsub = onSnapshot(ref, s => {
            if (!this.user) return;
            const data = s.docs
                .map(v => ({ id: v.id, ...v.data() }))
                .sort((a, b) => b.createdAt - a.createdAt);

            this.renderTable(data);
            this.renderCharts(data);
            this.renderMobile(data);       // ← 모바일 렌더링
        }, err => console.error("Data sync failed:", err));
        this.unsubscribers.push(unsub);
    }

    // ─────────────────────────────────────────────
    //  RENDER TABLE  (desktop)
    // ─────────────────────────────────────────────
    renderTable(data) {
        const body = document.getElementById('tableBody');
        if (!body) return;
        body.innerHTML = '';
        document.getElementById('totalLogsBadge').innerText = `${data.length} Logs`;

        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.date.split('-').slice(1).join('.')}</td>
                <td><span style="background:#0f172a;color:white;padding:3px 10px;border-radius:8px;font-size:10px;font-weight:800">${item.name}</span></td>
                <td>
                    <span style="display:block;font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;margin-bottom:2px">${item.zone}</span>
                    ${item.detail}
                </td>
                <td style="text-align:right"><span class="pts-badge">+${item.points}</span></td>
                <td>
                    ${item.uid === this.user?.uid
                        ? `<button class="delete-btn" onclick="window.app.delete('${item.id}')">🗑️</button>`
                        : ''}
                </td>
            `;
            body.appendChild(tr);
        });
    }

    // ─────────────────────────────────────────────
    //  RENDER CHARTS  (desktop)
    // ─────────────────────────────────────────────
    renderCharts(data) {
        const section = document.getElementById('chartsSection');
        if (section) section.classList.toggle('hidden', data.length === 0);
        if (data.length === 0) return;

        const { pts, daily, names, sortedDates } = this._aggregateData(data);

        if (this.charts.share) this.charts.share.destroy();
        this.charts.share = new Chart(document.getElementById('shareChart'), {
            type: 'doughnut',
            data: {
                labels: names,
                datasets: [{ data: Object.values(pts), backgroundColor: this.colors, borderWidth: 0 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '75%',
                plugins: { legend: { position: 'right' } }
            }
        });

        if (this.charts.trend) this.charts.trend.destroy();
        this.charts.trend = new Chart(document.getElementById('trendChart'), {
            type: 'bar',
            data: {
                labels: sortedDates.map(d => d.substring(5)),
                datasets: names.map((n, i) => ({
                    label: n,
                    data: sortedDates.map(d => daily[d]?.[n] || 0),
                    backgroundColor: this.colors[i % this.colors.length],
                    borderRadius: 6
                }))
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { x: { stacked: true }, y: { stacked: true } }
            }
        });
    }

    // ─────────────────────────────────────────────
    //  RENDER MOBILE
    // ─────────────────────────────────────────────
    renderMobile(data) {
        this._renderScoreCard(data);
        this._renderRankRow(data);
        this._renderActivityList('recentListM',  data.slice(0, 5));
        this._renderActivityList('historyListM', data);
        this._renderMobileCharts(data);
    }

    _aggregateData(data) {
        const pts = {}, daily = {};
        data.forEach(c => {
            pts[c.name] = (pts[c.name] || 0) + c.points;
            if (!daily[c.date]) daily[c.date] = {};
            daily[c.date][c.name] = (daily[c.date][c.name] || 0) + c.points;
        });
        const names       = Object.keys(pts);
        const sortedDates = Object.keys(daily).sort().slice(-7);
        return { pts, daily, names, sortedDates };
    }

    _thisMonth() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    _renderScoreCard(data) {
        const me = this.user?.displayName;
        const tm = this._thisMonth();

        const myPts = data
            .filter(l => l.name === me && l.date?.startsWith(tm))
            .reduce((s, l) => s + (l.points || 0), 0);

        const scoreEl = document.getElementById('myScoreM');
        if (scoreEl) scoreEl.textContent = myPts.toLocaleString();

        // 랭킹 계산
        const totals = {};
        data.filter(l => l.date?.startsWith(tm)).forEach(l => {
            totals[l.name] = (totals[l.name] || 0) + (l.points || 0);
        });
        const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
        const myRank = sorted.findIndex(([n]) => n === me) + 1;
        const medals = ['🥇', '🥈', '🥉'];
        const rankEl = document.getElementById('myRankM');
        if (rankEl) {
            rankEl.textContent = myRank > 0
                ? `${medals[myRank - 1] || `#${myRank}`} 전체 ${myRank}위 · 이번 달`
                : '이번 달 활동을 기록해보세요!';
        }
    }

    _renderRankRow(data) {
        const row = document.getElementById('rankRowM');
        if (!row) return;
        const me = this.user?.displayName;
        const tm = this._thisMonth();

        const totals = {};
        data.filter(l => l.date?.startsWith(tm)).forEach(l => {
            totals[l.name] = (totals[l.name] || 0) + (l.points || 0);
        });
        const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

        if (sorted.length === 0) {
            row.innerHTML = `<div class="rank-pill" style="color:#94a3b8;font-size:12px">이번 달 기록 없음</div>`;
            return;
        }
        const medals = ['🥇', '🥈', '🥉'];
        row.innerHTML = sorted.map(([name, pts], i) => `
            <div class="rank-pill ${name === me ? 'me' : ''}">
                <span>${medals[i] || `#${i + 1}`}</span>
                <span>${name}</span>
                <span style="color:var(--orange);font-weight:900">${pts}pt</span>
            </div>
        `).join('');
    }

    _getZoneEmoji(zone) {
        const map = { '주방': '🍳', '거실': '🛋️', '욕실': '🚿', '침실': '🛏️', '현관': '🚪', '베란다': '🌿', '외부': '🌳', '다용도실': '🧺', '기타': '✨' };
        for (const [k, v] of Object.entries(map)) if (zone?.includes(k)) return v;
        return '🧹';
    }

    _renderActivityList(containerId, items) {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.innerHTML = '';

        if (items.length === 0) {
            el.innerHTML = `
                <div class="empty-state">
                    <div class="empty-emoji">🌱</div>
                    <div class="empty-title">아직 기록이 없어요</div>
                    <div class="empty-desc">+ 버튼으로 첫 활동을 기록해보세요!</div>
                </div>`;
            return;
        }

        const me = this.user?.displayName;
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'activity-card';
            card.innerHTML = `
                <div class="activity-icon-wrap">${this._getZoneEmoji(item.zone)}</div>
                <div class="activity-info">
                    <div class="activity-title">${item.detail}</div>
                    <div class="activity-meta">${item.name} · ${item.date?.slice(5).replace('-', '/')} · ${item.zone || '기타'}</div>
                </div>
                <div>
                    <div class="activity-pts">+${item.points}</div>
                    <div class="activity-pts-label">pts</div>
                </div>
            `;
            el.appendChild(card);
        });
    }

    _renderMobileCharts(data) {
        if (data.length === 0) return;
        const { pts, daily, names, sortedDates } = this._aggregateData(data);

        // Share chart (mobile)
        const shareCanvasM = document.getElementById('shareChartM');
        if (shareCanvasM) {
            if (this.charts.shareM) this.charts.shareM.destroy();
            this.charts.shareM = new Chart(shareCanvasM, {
                type: 'doughnut',
                data: {
                    labels: names,
                    datasets: [{ data: Object.values(pts), backgroundColor: this.colors, borderWidth: 0 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: '70%',
                    plugins: {
                        legend: { position: 'bottom', labels: { font: { size: 11, weight: '700' }, boxWidth: 10 } }
                    }
                }
            });
        }

        // Trend chart (mobile)
        const trendCanvasM = document.getElementById('trendChartM');
        if (trendCanvasM) {
            if (this.charts.trendM) this.charts.trendM.destroy();
            this.charts.trendM = new Chart(trendCanvasM, {
                type: 'bar',
                data: {
                    labels: sortedDates.map(d => d.substring(5)),
                    datasets: names.map((n, i) => ({
                        label: n,
                        data: sortedDates.map(d => daily[d]?.[n] || 0),
                        backgroundColor: this.colors[i % this.colors.length],
                        borderRadius: 4
                    }))
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    scales: {
                        x: { stacked: true, ticks: { font: { size: 10 } } },
                        y: { stacked: true, ticks: { font: { size: 10 } } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }
    }

    // ─────────────────────────────────────────────
    //  TOAST
    // ─────────────────────────────────────────────
    toast(msg, type = "success") {
        const t = document.getElementById('toast');
        const m = document.getElementById('toastMsg');
        const icon = document.getElementById('toastIcon');
        if (!t || !m) return;
        m.innerText = msg;
        if (icon) icon.textContent = type === 'err' ? '❌' : '✅';
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2500);
    }
}

window.app = new ChoreApp();
