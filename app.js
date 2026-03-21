/**
 * Chore Tracker - HouseChod
 * Mobile-optimized version
 */

import { initializeApp }        from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
                                 from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc }
                                 from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const CONFIG = {
    firebaseConfig: {
        apiKey:            "REMOVED_FIREBASE_WEB_API_KEY",
        authDomain:        "housechod.firebaseapp.com",
        projectId:         "housechod",
        storageBucket:     "housechod.firebasestorage.app",
        messagingSenderId: "818673632451",
        appId:             "1:818673632451:web:dc4a1f33335fb98b59ce76"
    },
    appId: 'housechod-v1',
    defaultRules: [
        { match: "설거지|식세기",          zone: '주방',    pts: 10 },
        { match: "분리수거|음식물|쓰레기",  zone: '외부',    pts: 15 },
        { match: "청소기|바닥|걸레",        zone: '거실',    pts: 10 },
        { match: "빨래|건조기",             zone: '다용도실', pts: 5  }
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
        this.colors       = ['#f97316','#0f172a','#3b82f6','#10b981','#a855f7','#ec4899'];
        this.unsubscribers = [];
        this._lastData    = [];

        this.init();
    }

    // ──────────────────────────────────────
    init() {
        // Safety: remove overlay after 5s regardless
        setTimeout(() => this._hideLoader(), 5000);

        onAuthStateChanged(this.auth, user => {
            this._hideLoader();
            this.unsubscribers.forEach(u => u());
            this.unsubscribers = [];
            this.user = user;
            this._toggleUI();
            if (user) { 
                // 모바일 브릿지 트리거: 유저 정보 세팅
                if (window.setMobileUser) {
                    window.setMobileUser(user.displayName, user.photoURL, user.email);
                }
                this._loadRules(); 
                this._loadData(); 
            }
        });

        this._bindEvents();
    }

    _hideLoader() {
        const el = document.getElementById('loadingOverlay');
        if (el) el.classList.add('fade-out');
    }

    // ──────────────────────────────────────
    _bindEvents() {
        const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
            .toISOString().split('T')[0];

        // Desktop form
        document.getElementById('logoutBtn').onclick      = () => signOut(this.auth);
        document.getElementById('choreForm').onsubmit     = e  => this._handleSave(e, 'desktop');
        document.getElementById('detailInput').oninput    = e  => this._autoFill(e.target.value, 'desktop');
        document.getElementById('dateInput').value        = today;

        // Login
        document.getElementById('googleLoginBtn').onclick = async () => {
            try { await signInWithPopup(this.auth, this.provider); }
            catch (e) { alert(`로그인 오류: ${e.message}`); }
        };

        // Mobile form
        const mForm = document.getElementById('choreFormM');
        if (mForm) mForm.onsubmit = e => this._handleSave(e, 'mobile');

        const mDetail = document.getElementById('detailInputM');
        if (mDetail) mDetail.oninput = e => this._autoFill(e.target.value, 'mobile');

        const mDate = document.getElementById('dateInputM');
        if (mDate) mDate.value = today;

        // Mobile logout
        const logoutM = document.getElementById('logoutBtnM');
        if (logoutM) logoutM.onclick = () => signOut(this.auth);
    }

    // ──────────────────────────────────────
    _toggleUI() {
        const landing = document.getElementById('landingPage');
        const main    = document.getElementById('mainApp');

        if (this.user) {
            landing?.classList.remove('show');
            main?.classList.add('show');

            // Desktop
            const av = document.getElementById('userAvatar');
            if (av) av.src = this.user.photoURL;
            const nm = document.getElementById('userNameDisplay');
            if (nm) nm.textContent = this.user.displayName;
            const ni = document.getElementById('nameInput');
            if (ni) ni.value = this.user.displayName;

            // Mobile
            const avM = document.getElementById('userAvatarM');
            if (avM) { avM.src = this.user.photoURL; avM.alt = this.user.displayName; }
            const prAv = document.getElementById('profileAvatarM');
            if (prAv) prAv.src = this.user.photoURL;
            const niM = document.getElementById('nameInputM');
            if (niM) niM.value = this.user.displayName;
            const prNm = document.getElementById('profileNameM');
            if (prNm) prNm.textContent = this.user.displayName;
            const prEm = document.getElementById('profileEmailM');
            if (prEm) prEm.textContent = this.user.email;

        } else {
            landing?.classList.add('show');
            main?.classList.remove('show');
            // Hide charts section
            const cs = document.getElementById('chartsSection');
            if (cs) cs.style.display = 'none';
        }
    }

    // ──────────────────────────────────────
    _loadRules() {
        // [수정됨] 짝수 경로(6단계) 구성을 위해 settings 컬렉션 하위의 'global' 문서로 명확히 지정
        const ref = doc(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'settings', 'global');
        const u = onSnapshot(ref, s => {
            this.rules = s.exists() ? s.data().rules : CONFIG.defaultRules;
        }, err => console.error('Rules error:', err));
        this.unsubscribers.push(u);
    }

    _autoFill(text, target) {
        if (!text.trim()) return;
        const rule = this.rules.find(r => new RegExp(r.match, 'i').test(text));
        if (!rule) return;
        if (target === 'mobile') {
            const z = document.getElementById('zoneInputM');
            const p = document.getElementById('pointsInputM');
            if (z) z.value = rule.zone;
            if (p) p.value = rule.pts;
        } else {
            document.getElementById('zoneInput').value   = rule.zone;
            document.getElementById('pointsInput').value = rule.pts;
        }
    }

    // ──────────────────────────────────────
    async _handleSave(e, target) {
        e.preventDefault();
        if (!this.user) return;
        const m = target === 'mobile';
        const payload = {
            date:      document.getElementById(m ? 'dateInputM'   : 'dateInput').value,
            name:      this.user.displayName,
            detail:    document.getElementById(m ? 'detailInputM' : 'detailInput').value.trim(),
            zone:      document.getElementById(m ? 'zoneInputM'   : 'zoneInput').value  || '기타',
            points:    parseInt(document.getElementById(m ? 'pointsInputM' : 'pointsInput').value) || 0,
            uid:       this.user.uid,
            createdAt: Date.now()
        };
        try {
            await addDoc(
                collection(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'chores'),
                payload
            );
            if (m) {
                document.getElementById('detailInputM').value  = '';
                document.getElementById('zoneInputM').value    = '';
                document.getElementById('pointsInputM').value  = '';
                // Close sheet
                document.getElementById('choreSheet')?.classList.remove('open');
                document.getElementById('sheetOverlay')?.classList.remove('open');
                document.body.style.overflow = '';
            } else {
                document.getElementById('detailInput').value = '';
                document.getElementById('zoneInput').value   = '';
                document.getElementById('pointsInput').value = '';
            }
            this._toast('포인트 적립 완료! ✨');

            // [추가됨] 모바일 브릿지 트리거 (mobile-bridge.js 연동)
            if (window.onChoreAdded) window.onChoreAdded();

        } catch (err) {
            console.error('Save error:', err);
            this._toast('저장 오류 발생', 'err');
        }
    }

    async delete(id) {
        try {
            await deleteDoc(doc(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'chores', id));
            this._toast('삭제되었습니다.');
        } catch {
            this._toast('삭제 권한 없음', 'err');
        }
    }

    // ──────────────────────────────────────
    _loadData() {
        const ref = collection(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'chores');
        const u = onSnapshot(ref, s => {
            if (!this.user) return;
            const data = s.docs
                .map(v => ({ id: v.id, ...v.data() }))
                .sort((a, b) => b.createdAt - a.createdAt);
            this._lastData = data;
            this._renderTable(data);
            this._renderDesktopCharts(data);
            this._renderMobile(data);

            // [추가됨] 모바일 브릿지 업데이트 트리거 (mobile-bridge.js 연동)
            if (window.updateMobileLogs) {
                window.updateMobileLogs(data, this.user.displayName);
            }
        }, err => console.error('Data error:', err));
        this.unsubscribers.push(u);
    }

    // ──────────────────────────────────────
    // DESKTOP
    // ──────────────────────────────────────
    _renderTable(data) {
        const body = document.getElementById('tableBody');
        if (!body) return;
        body.innerHTML = '';
        const badge = document.getElementById('totalLogsBadge');
        if (badge) badge.textContent = `${data.length} Logs`;

        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.date.split('-').slice(1).join('.')}</td>
                <td><span style="background:#0f172a;color:#fff;padding:3px 10px;border-radius:8px;font-size:10px;font-weight:800">${item.name}</span></td>
                <td>
                  <span style="display:block;font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase;margin-bottom:2px">${item.zone}</span>
                  ${item.detail}
                </td>
                <td class="r"><span class="pts-bdg">+${item.points}</span></td>
                <td class="c">${item.uid === this.user?.uid
                    ? `<button class="del-btn" onclick="window.app.delete('${item.id}')">🗑️</button>`
                    : ''}</td>`;
            body.appendChild(tr);
        });
    }

    _renderDesktopCharts(data) {
        const section = document.getElementById('chartsSection');
        if (!section) return;
        if (data.length === 0) { section.style.display = 'none'; return; }
        section.style.display = '';   // CSS grid (d-charts) takes over

        const { pts, daily, names, dates } = this._aggregate(data);

        if (this.charts.share) this.charts.share.destroy();
        this.charts.share = new Chart(document.getElementById('shareChart'), {
            type: 'doughnut',
            data: { labels: names, datasets: [{ data: Object.values(pts), backgroundColor: this.colors, borderWidth: 0 }] },
            options: { responsive:true, maintainAspectRatio:false, cutout:'75%', plugins:{ legend:{ position:'right' } } }
        });

        if (this.charts.trend) this.charts.trend.destroy();
        this.charts.trend = new Chart(document.getElementById('trendChart'), {
            type: 'bar',
            data: {
                labels: dates.map(d => d.substring(5)),
                datasets: names.map((n,i) => ({
                    label: n,
                    data: dates.map(d => daily[d]?.[n] || 0),
                    backgroundColor: this.colors[i % this.colors.length],
                    borderRadius: 6
                }))
            },
            options: { responsive:true, maintainAspectRatio:false, scales:{ x:{stacked:true}, y:{stacked:true} } }
        });
    }

    // ──────────────────────────────────────
    // MOBILE
    // ──────────────────────────────────────
    _renderMobile(data) {
        this._renderScoreCard(data);
        this._renderRankRow(data);
        this._renderList('recentListM',  data.slice(0, 5));
        this._renderList('historyListM', data);
        this._renderMobileCharts(data);
    }

    _thisMonth() {
        const n = new Date();
        return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
    }

    _renderScoreCard(data) {
        const me = this.user?.displayName;
        const tm = this._thisMonth();
        const myPts = data
            .filter(l => l.name === me && l.date?.startsWith(tm))
            .reduce((s, l) => s + (l.points || 0), 0);

        const sc = document.getElementById('myScoreM');
        if (sc) sc.textContent = myPts.toLocaleString();

        const totals = {};
        data.filter(l => l.date?.startsWith(tm)).forEach(l => {
            totals[l.name] = (totals[l.name] || 0) + (l.points || 0);
        });
        const sorted = Object.entries(totals).sort((a,b) => b[1]-a[1]);
        const rank = sorted.findIndex(([n]) => n === me) + 1;
        const medals = ['🥇','🥈','🥉'];
        const sr = document.getElementById('myRankM');
        if (sr) sr.textContent = rank > 0
            ? `${medals[rank-1] || `#${rank}`} 전체 ${rank}위 · 이번 달`
            : '이번 달 활동을 기록해보세요!';
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
        const sorted = Object.entries(totals).sort((a,b) => b[1]-a[1]);
        if (!sorted.length) {
            row.innerHTML = `<div class="rank-pill" style="color:#94a3b8;font-size:12px">이번 달 기록 없음</div>`;
            return;
        }
        const medals = ['🥇','🥈','🥉'];
        row.innerHTML = sorted.map(([name, pts], i) =>
            `<div class="rank-pill ${name === me ? 'me' : ''}">
              <span>${medals[i] || `#${i+1}`}</span>
              <span>${name}</span>
              <span style="color:var(--or);font-weight:900">${pts}pt</span>
            </div>`
        ).join('');
    }

    _zoneEmoji(zone) {
        const map = {'주방':'🍳','거실':'🛋️','욕실':'🚿','침실':'🛏️','현관':'🚪','베란다':'🌿','외부':'🌳','다용도실':'🧺','기타':'✨'};
        for (const [k,v] of Object.entries(map)) if (zone?.includes(k)) return v;
        return '🧹';
    }

    _renderList(id, items) {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '';
        if (!items.length) {
            el.innerHTML = `<div class="empty"><div class="empty-em">🌱</div><div class="empty-ttl">아직 기록이 없어요</div><div class="empty-dsc">+ 버튼으로 첫 활동을 기록해보세요!</div></div>`;
            return;
        }
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'a-card';
            card.innerHTML = `
                <div class="a-icon">${this._zoneEmoji(item.zone)}</div>
                <div class="a-info">
                  <div class="a-title">${item.detail}</div>
                  <div class="a-meta">${item.name} · ${item.date?.slice(5).replace('-','/')} · ${item.zone||'기타'}</div>
                </div>
                <div class="a-pts">
                  <span class="a-pts-v">+${item.points}</span>
                  <span class="a-pts-l">pts</span>
                </div>`;
            el.appendChild(card);
        });
    }

    _applyFilter(filter) {
        const data = filter === 'me'
            ? this._lastData.filter(l => l.name === this.user?.displayName)
            : this._lastData;
        this._renderList('historyListM', data);
    }

    _renderMobileCharts(data) {
        if (!data.length) return;
        const { pts, daily, names, dates } = this._aggregate(data);

        const scM = document.getElementById('shareChartM');
        if (scM) {
            if (this.charts.shareM) this.charts.shareM.destroy();
            this.charts.shareM = new Chart(scM, {
                type: 'doughnut',
                data: { labels: names, datasets: [{ data: Object.values(pts), backgroundColor: this.colors, borderWidth: 0 }] },
                options: {
                    responsive:true, maintainAspectRatio:false, cutout:'70%',
                    plugins:{ legend:{ position:'bottom', labels:{ font:{size:11,weight:'700'}, boxWidth:10 } } }
                }
            });
        }

        const trM = document.getElementById('trendChartM');
        if (trM) {
            if (this.charts.trendM) this.charts.trendM.destroy();
            this.charts.trendM = new Chart(trM, {
                type: 'bar',
                data: {
                    labels: dates.map(d => d.substring(5)),
                    datasets: names.map((n,i) => ({
                        label: n,
                        data: dates.map(d => daily[d]?.[n] || 0),
                        backgroundColor: this.colors[i % this.colors.length],
                        borderRadius: 4
                    }))
                },
                options: {
                    responsive:true, maintainAspectRatio:false,
                    scales:{ x:{stacked:true,ticks:{font:{size:10}}}, y:{stacked:true,ticks:{font:{size:10}}} },
                    plugins:{ legend:{ display:false } }
                }
            });
        }
    }

    // ──────────────────────────────────────
    _aggregate(data) {
        const pts = {}, daily = {};
        data.forEach(c => {
            pts[c.name] = (pts[c.name]||0) + c.points;
            if (!daily[c.date]) daily[c.date] = {};
            daily[c.date][c.name] = (daily[c.date][c.name]||0) + c.points;
        });
        const names = Object.keys(pts);
        const dates = Object.keys(daily).sort().slice(-7);
        return { pts, daily, names, dates };
    }

    // ──────────────────────────────────────
    _toast(msg, type = 'ok') {
        const t = document.getElementById('toast');
        const m = document.getElementById('toastMsg');
        const i = document.getElementById('toastIcon');
        if (!t || !m) return;
        m.textContent = msg;
        if (i) i.textContent = type === 'err' ? '❌' : '✅';
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2500);
    }
}

window.app = new ChoreApp();