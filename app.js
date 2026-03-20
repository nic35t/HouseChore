/**
 * Chore Tracker Application - Refactored Version
 * Architecture: Service (Firebase) | View (UI) | Controller (App)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Configuration & Constants ---
const CONFIG = {
    appId: typeof __app_id !== 'undefined' ? __app_id : 'chore-tracker-v2',
    rules: [
        { match: /음식물 쓰레기|음쓰|분리수거|쓰레기/i, zone: '외부', type: '청소', diff: '상', pts: 15 },
        { match: /설거지|식기세척기|식세기/i, zone: '주방', type: '청소', diff: '중', pts: 10 },
        { match: /요리|밥|찌개|식사 준비/i, zone: '주방', type: '요리', diff: '상', pts: 20 },
        { match: /빨래|건조기|세탁/i, zone: '다용도실', type: '세탁', diff: '하', pts: 5 },
        { match: /화장실|욕실|변기/i, zone: '화장실', type: '청소', diff: '상', pts: 20 },
        { match: /청소기|밀대|바닥|물걸레/i, zone: '거실/방', type: '청소', diff: '중', pts: 10 }
    ]
};

// --- Utilities ---
const Utils = {
    toast: (msg) => {
        const t = document.getElementById('toast');
        const m = document.getElementById('toastMsg');
        if(!t || !m) return;
        m.innerText = msg;
        t.classList.remove('hidden', 'opacity-0'); 
        t.classList.add('toast-animate');
        setTimeout(() => { 
            t.classList.add('opacity-0'); 
            setTimeout(() => t.classList.add('hidden'), 300); 
        }, 3000);
    },
    getToday: () => new Date(Date.now() - new Date().getTimezoneOffset()*60000).toISOString().split('T')[0],
    escape: (s) => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]))
};

// --- Core Application Class ---
class ChoreApp {
    constructor() {
        this.initFirebase();
        this.user = null;
        this.charts = { share: null, trend: null };
        this.bindEvents();
    }

    initFirebase() {
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{"projectId":"dummy"}');
        this.app = initializeApp(firebaseConfig);
        this.auth = getAuth(this.app);
        this.db = getFirestore(this.app);
        this.provider = new GoogleAuthProvider();

        onAuthStateChanged(this.auth, u => {
            this.user = u;
            this.toggleAuthUI();
            if(u) this.startListening();
        });
    }

    bindEvents() {
        document.getElementById('googleLoginBtn').onclick = () => signInWithPopup(this.auth, this.provider).catch(console.error);
        document.getElementById('logoutBtn').onclick = () => signOut(this.auth);
        document.getElementById('choreForm').onsubmit = e => this.handleSave(e);
        document.getElementById('detailInput').oninput = e => this.handleAutoFill(e.target.value);
        document.getElementById('dateInput').value = Utils.getToday();
    }

    toggleAuthUI() {
        const login = document.getElementById('loginSection');
        const form = document.getElementById('mainFormSection');
        const prof = document.getElementById('userProfile');
        
        if(this.user) {
            login.classList.add('hidden'); 
            form.classList.remove('hidden'); 
            prof.classList.remove('hidden');
            document.getElementById('userAvatar').src = this.user.photoURL;
            document.getElementById('nameInput').value = this.user.displayName;
        } else {
            login.classList.remove('hidden'); 
            form.classList.add('hidden'); 
            prof.classList.add('hidden');
        }
    }

    handleAutoFill(text) {
        const rule = CONFIG.rules.find(r => r.match.test(text));
        if(rule) {
            document.getElementById('zoneInput').value = rule.zone;
            document.getElementById('typeInput').value = rule.type;
            document.getElementById('difficultyInput').value = rule.diff;
            document.getElementById('pointsInput').value = rule.pts;
        }
    }

    async handleSave(e) {
        e.preventDefault();
        if(!this.user) return;

        const payload = {
            date: document.getElementById('dateInput').value,
            name: this.user.displayName,
            detail: document.getElementById('detailInput').value.trim(),
            zone: document.getElementById('zoneInput').value || '기타',
            type: document.getElementById('typeInput').value || '기타',
            difficulty: document.getElementById('difficultyInput').value || '-',
            points: parseInt(document.getElementById('pointsInput').value) || 0,
            uid: this.user.uid,
            createdAt: Date.now()
        };

        try {
            await addDoc(collection(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'chores'), payload);
            this.resetForm();
            Utils.toast("성공적으로 기록되었습니다! ✨");
        } catch(err) {
            Utils.toast("저장에 실패했습니다.");
        }
    }

    async handleDelete(id) {
        try {
            await deleteDoc(doc(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'chores', id));
            Utils.toast("삭제되었습니다.");
        } catch(err) {
            Utils.toast("삭제 권한이 없습니다.");
        }
    }

    resetForm() {
        document.getElementById('detailInput').value = '';
        ['zoneInput', 'typeInput', 'difficultyInput', 'pointsInput'].forEach(id => document.getElementById(id).value = '');
    }

    startListening() {
        const ref = collection(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'chores');
        onSnapshot(ref, snapshot => {
            const data = snapshot.docs.map(v => ({id: v.id, ...v.data()}))
                                    .sort((a,b) => b.createdAt - a.createdAt);
            this.render(data);
        });
    }

    render(data) {
        const body = document.getElementById('tableBody');
        body.innerHTML = '';
        document.getElementById('totalLogsBadge').innerText = `${data.length} LOGS`;
        
        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = "group hover:bg-slate-50 transition-all border-b border-slate-50 last:border-0";
            tr.innerHTML = `
                <td class="px-8 py-5 font-num text-slate-400 font-bold">${item.date.substring(5)}</td>
                <td class="px-8 py-5"><span class="bg-slate-900 text-white px-2.5 py-1 rounded-lg text-[10px] font-black uppercase">${Utils.escape(item.name)}</span></td>
                <td class="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">${Utils.escape(item.zone)} / ${Utils.escape(item.type)}</td>
                <td class="px-8 py-5 whitespace-normal font-semibold text-slate-600 leading-relaxed">${Utils.escape(item.detail)}</td>
                <td class="px-8 py-5 text-right font-black text-orange-600 font-num text-base">+${item.points}</td>
                <td class="px-8 py-5 text-center">
                    ${this.user && item.uid === this.user.uid ? 
                        `<button class="delete-btn opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all text-slate-300" data-id="${item.id}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>` : ''}
                </td>
            `;
            // Attach event listener directly to the button
            const btn = tr.querySelector('.delete-btn');
            if(btn) btn.onclick = () => this.handleDelete(btn.dataset.id);
            body.appendChild(tr);
        });
        this.updateCharts(data);
    }

    updateCharts(data) {
        if(data.length === 0) {
            document.getElementById('chartEmpty').classList.remove('hidden');
            return;
        }
        document.getElementById('chartEmpty').classList.add('hidden');

        const pts = {}; 
        const daily = {};
        data.forEach(c => {
            pts[c.name] = (pts[c.name] || 0) + c.points;
            if(!daily[c.date]) daily[c.date] = {};
            daily[c.date][c.name] = (daily[c.date][c.name] || 0) + c.points;
        });
        const names = Object.keys(pts);
        
        // Share Chart
        if(this.charts.share) this.charts.share.destroy();
        this.charts.share = new Chart(document.getElementById('shareChart'), {
            type: 'doughnut',
            data: { 
                labels: names, 
                datasets: [{ 
                    data: Object.values(pts), 
                    backgroundColor: ['#f97316', '#0f172a', '#3b82f6', '#10b981', '#a855f7'], 
                    borderWidth: 0, 
                    hoverOffset: 15 
                }] 
            },
            options: { 
                responsive: true, maintainAspectRatio: false, cutout: '75%', 
                plugins: { legend: { position: 'right', labels: { boxWidth: 8, font: { size: 10 } } } } 
            }
        });

        // Trend Chart
        const sortedDates = Object.keys(daily).sort().slice(-7);
        if(this.charts.trend) this.charts.trend.destroy();
        this.charts.trend = new Chart(document.getElementById('trendChart'), {
            type: 'bar',
            data: { 
                labels: sortedDates.map(d => d.substring(5)), 
                datasets: names.map((n, i) => ({ 
                    label: n, 
                    data: sortedDates.map(d => daily[d][n] || 0), 
                    backgroundColor: ['#f97316', '#0f172a', '#3b82f6', '#10b981', '#a855f7'][i % 5],
                    borderRadius: 6
                })) 
            },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: { color: '#f1f5f9' } } },
                plugins: { legend: { display: false } }
            }
        });
    }
}

// Global exposure for event handlers if needed, but OOP preferred
window.app = new ChoreApp();