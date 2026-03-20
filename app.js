import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Configuration ---
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
        { match: "설거지|식세기", zone: '주방', pts: 10 },
        { match: "쓰레기|분리수거", zone: '외부', pts: 15 },
        { match: "청소기|걸레", zone: '거실', pts: 10 },
        { match: "빨래|세탁", zone: '다용도실', pts: 5 }
    ]
};

class ChoreApp {
    constructor() {
        this.app = initializeApp(CONFIG.firebaseConfig);
        this.auth = getAuth(this.app);
        this.db = getFirestore(this.app);
        this.provider = new GoogleAuthProvider();
        
        this.user = null;
        this.rules = [];
        this.charts = { share: null, trend: null };
        this.colors = ['#f97316', '#0f172a', '#3b82f6', '#10b981', '#a855f7', '#ec4899'];
        
        this.init();
    }

    init() {
        // 인증 상태 실시간 모니터링
        onAuthStateChanged(this.auth, (user) => {
            this.user = user;
            this.toggleUI();
            if (user) {
                this.loadRules();
                this.loadData();
            }
            // 글로벌 로더 제거
            const loader = document.getElementById('loadingOverlay');
            if (loader) loader.classList.add('opacity-0', 'pointer-events-none');
        });

        this.bindEvents();
    }

    bindEvents() {
        const loginBtn = document.getElementById('googleLoginBtn');
        if (loginBtn) {
            loginBtn.onclick = async () => {
                try {
                    await signInWithPopup(this.auth, this.provider);
                } catch (e) {
                    console.error("Login Error:", e);
                    alert("로그인에 실패했습니다. Firebase 콘솔에서 도메인이 승인되었는지 확인하세요.");
                }
            };
        }

        document.getElementById('logoutBtn').onclick = () => signOut(this.auth);
        document.getElementById('choreForm').onsubmit = (e) => this.handleSave(e);
        document.getElementById('detailInput').oninput = (e) => this.handleAutoFill(e.target.value);
        document.getElementById('dateInput').value = new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().split('T')[0];
    }

    toggleUI() {
        const landing = document.getElementById('landingPage');
        const main = document.getElementById('mainApp');
        if(this.user) {
            landing?.classList.add('hidden');
            main?.classList.remove('hidden');
            document.getElementById('userAvatar').src = this.user.photoURL;
            document.getElementById('userNameDisplay').innerText = this.user.displayName;
            document.getElementById('nameInput').value = this.user.displayName;
        } else {
            landing?.classList.remove('hidden');
            main?.classList.add('hidden');
        }
    }

    loadRules() {
        const ref = doc(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'settings');
        onSnapshot(ref, s => {
            this.rules = s.exists() ? s.data().rules : CONFIG.defaultRules;
        });
    }

    handleAutoFill(text) {
        if(!text.trim()) return;
        const rule = this.rules.find(r => new RegExp(r.match, 'i').test(text));
        if(rule) {
            document.getElementById('zoneInput').value = rule.zone;
            document.getElementById('pointsInput').value = rule.pts;
        }
    }

    async handleSave(e) {
        e.preventDefault();
        const payload = {
            date: document.getElementById('dateInput').value,
            name: this.user.displayName,
            detail: document.getElementById('detailInput').value.trim(),
            zone: document.getElementById('zoneInput').value || '기타',
            points: parseInt(document.getElementById('pointsInput').value) || 0,
            uid: this.user.uid,
            createdAt: Date.now()
        };
        try {
            await addDoc(collection(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'chores'), payload);
            document.getElementById('detailInput').value = '';
            this.toast("기록 완료! ✨");
        } catch(e) { this.toast("저장 실패", "err"); }
    }

    async delete(id) {
        try {
            await deleteDoc(doc(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'chores', id));
            this.toast("삭제되었습니다.");
        } catch(e) { this.toast("권한 없음", "err"); }
    }

    loadData() {
        const ref = collection(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'chores');
        onSnapshot(ref, s => {
            const data = s.docs.map(v => ({id: v.id, ...v.data()})).sort((a,b) => b.createdAt - a.createdAt);
            this.renderTable(data);
            this.renderCharts(data);
        });
    }

    renderTable(data) {
        const body = document.getElementById('tableBody');
        body.innerHTML = '';
        document.getElementById('totalLogsBadge').innerText = `${data.length} Logs`;
        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = "group hover:bg-slate-50 transition-all border-b border-slate-50 last:border-0";
            tr.innerHTML = `
                <td class="px-8 py-5 font-num text-slate-400 font-bold text-xs">${item.date.split('-').slice(1).join('.')}</td>
                <td class="px-8 py-5"><span class="bg-slate-900 text-white px-2.5 py-1 rounded-lg text-[10px] font-black uppercase">${item.name}</span></td>
                <td class="px-8 py-5 whitespace-normal font-semibold text-slate-600 text-sm">
                    <span class="block text-[10px] text-slate-400 uppercase mb-0.5">${item.zone}</span>
                    ${item.detail}
                </td>
                <td class="px-8 py-5 text-right font-black text-orange-600 font-num text-base">+${item.points}</td>
                <td class="px-8 py-5 text-center">
                    ${item.uid === this.user.uid ? `<button onclick="window.app.delete('${item.id}')" class="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all">🗑️</button>` : ''}
                </td>
            `;
            body.appendChild(tr);
        });
    }

    renderCharts(data) {
        document.getElementById('chartEmpty').classList.toggle('hidden', data.length > 0);
        if(data.length === 0) return;
        const pts = {}, daily = {};
        data.forEach(c => {
            pts[c.name] = (pts[c.name]||0)+c.points;
            if(!daily[c.date]) daily[c.date] = {};
            daily[c.date][c.name] = (daily[c.date][c.name]||0)+c.points;
        });
        const names = Object.keys(pts);
        if(this.charts.share) this.charts.share.destroy();
        this.charts.share = new Chart(document.getElementById('shareChart'), {
            type: 'doughnut', data: { labels: names, datasets: [{ data: Object.values(pts), backgroundColor: this.colors, borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'right', labels: { boxWidth: 6, font: { weight: 'bold', size: 10 } } } } }
        });
        const sortedDates = Object.keys(daily).sort().slice(-7);
        if(this.charts.trend) this.charts.trend.destroy();
        this.charts.trend = new Chart(document.getElementById('trendChart'), {
            type: 'bar', data: { labels: sortedDates.map(d => d.substring(5)), datasets: names.map((n, i) => ({ label: n, data: sortedDates.map(d => daily[d][n]||0), backgroundColor: this.colors[i % this.colors.length], borderRadius: 6 })) },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } }, plugins: { legend: { display: false } } }
        });
    }

    toast(msg, type="success") {
        const t = document.getElementById('toast');
        document.getElementById('toastMsg').innerText = msg;
        t.classList.remove('hidden', 'opacity-0'); t.classList.add('toast-animate');
        setTimeout(() => { t.classList.add('opacity-0'); setTimeout(() => t.classList.add('hidden'), 300); }, 3000);
    }
}
window.app = new ChoreApp();
