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
        { match: "설거지|식기세척기", zone: '주방', pts: 10 },
        { match: "분리수거|음식물|쓰레기", zone: '외부', pts: 15 },
        { match: "청소기|바닥|물걸레", zone: '거실', pts: 10 },
        { match: "빨래|건조기", zone: '다용도실', pts: 5 }
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
        onAuthStateChanged(this.auth, u => {
            this.user = u;
            this.toggleUI();
            if(u) { this.loadRules(); this.loadData(); }
            document.getElementById('loadingOverlay').classList.add('opacity-0', 'pointer-events-none');
        });
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('googleLoginBtn').onclick = () => {
            signInWithPopup(this.auth, this.provider).catch(e => {
                console.error(e);
                alert("Login failed. Check Authorized Domains in Firebase.");
            });
        };
        document.getElementById('logoutBtn').onclick = () => signOut(this.auth);
        document.getElementById('choreForm').onsubmit = e => this.handleSave(e);
        document.getElementById('detailInput').oninput = e => this.handleAutoFill(e.target.value);
        document.getElementById('dateInput').value = new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().split('T')[0];
    }

    toggleUI() {
        const landing = document.getElementById('landingPage');
        const main = document.getElementById('mainApp');
        if(this.user) {
            landing.classList.add('hidden'); main.classList.remove('hidden');
            document.getElementById('userAvatar').src = this.user.photoURL;
            document.getElementById('userNameDisplay').innerText = this.user.displayName;
            document.getElementById('nameInput').value = this.user.displayName;
        } else {
            landing.classList.remove('hidden'); main.classList.add('hidden');
        }
    }

    loadRules() {
        const ref = doc(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'settings');
        onSnapshot(ref, s => this.rules = s.exists() ? s.data().rules : CONFIG.defaultRules);
    }

    handleAutoFill(t) {
        if(!t.trim()) return;
        const rule = this.rules.find(r => new RegExp(r.match, 'i').test(t));
        if(rule) {
            document.getElementById('zoneInput').value = rule.zone;
            document.getElementById('pointsInput').value = rule.pts;
        }
    }

    async handleSave(e) {
        e.preventDefault();
        const d = {
            date: document.getElementById('dateInput').value,
            name: this.user.displayName,
            detail: document.getElementById('detailInput').value.trim(),
            zone: document.getElementById('zoneInput').value || '기타',
            points: parseInt(document.getElementById('pointsInput').value) || 0,
            uid: this.user.uid,
            createdAt: Date.now()
        };
        try {
            await addDoc(collection(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'chores'), d);
            document.getElementById('detailInput').value = '';
            ['zoneInput', 'pointsInput'].forEach(id => document.getElementById(id).value = '');
            this.toast("Saved! ✨");
        } catch(e) { this.toast("Error saving", "err"); }
    }

    async handleDelete(id) {
        try {
            await deleteDoc(doc(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'chores', id));
            this.toast("Deleted.");
        } catch(e) { this.toast("No permission", "err"); }
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
            tr.className = "group hover:bg-slate-50/50 transition-all border-b border-slate-50 last:border-0";
            tr.innerHTML = `
                <td class="px-8 py-5 font-num text-slate-400 font-bold text-xs">${item.date.split('-').slice(1).join('.')}</td>
                <td class="px-8 py-5"><span class="bg-slate-900 text-white px-2.5 py-1 rounded-lg text-[10px] font-black uppercase">${item.name}</span></td>
                <td class="px-8 py-5 text-sm font-semibold text-slate-600"><span class="block text-[9px] text-slate-400 uppercase tracking-tighter mb-0.5">${item.zone}</span>${item.detail}</td>
                <td class="px-8 py-5 text-right font-black text-orange-600 font-num text-base">+${item.points}</td>
                <td class="px-8 py-5 text-center">${item.uid === this.user.uid ? `<button onclick="window.app.handleDelete('${item.id}')" class="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all">🗑️</button>` : ''}</td>
            `;
            body.appendChild(tr);
        });
    }

    renderCharts(data) {
        if(data.length === 0) { document.getElementById('chartEmpty').classList.remove('hidden'); return; }
        document.getElementById('chartEmpty').classList.add('hidden');
        const pts = {}, daily = {};
        data.forEach(c => {
            pts[c.name] = (pts[c.name]||0)+c.points;
            if(!daily[c.date]) daily[c.date] = {};
            daily[c.date][c.name] = (daily[c.date][c.name]||0)+c.points;
        });
        const names = Object.keys(pts);
        if(this.charts.share) this.charts.share.destroy();
        this.charts.share = new Chart(document.getElementById('shareChart'), {
            type: 'doughnut',
            data: { labels: names, datasets: [{ data: Object.values(pts), backgroundColor: this.colors, borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'right', labels: { boxWidth: 6, font: { weight: 'bold', size: 10 } } } } }
        });
        const sortedDates = Object.keys(daily).sort().slice(-7);
        if(this.charts.trend) this.charts.trend.destroy();
        this.charts.trend = new Chart(document.getElementById('trendChart'), {
            type: 'bar',
            data: { labels: sortedDates.map(d => d.substring(5)), datasets: names.map((n, i) => ({ label: n, data: sortedDates.map(d => daily[d][n]||0), backgroundColor: this.colors[i % this.colors.length], borderRadius: 6 })) },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: { color: '#f1f5f9' } } }, plugins: { legend: { display: false } } }
        });
    }

    toast(msg, type="success") {
        const t = document.getElementById('toast');
        document.getElementById('toastMsg').innerText = msg;
        document.getElementById('toastIcon').innerText = type==="success"?"✅":"⚠️";
        t.classList.remove('hidden', 'opacity-0'); t.classList.add('toast-animate');
        setTimeout(() => { t.classList.add('opacity-0'); setTimeout(() => t.classList.add('hidden'), 300); }, 3000);
    }
}
window.app = new ChoreApp();
