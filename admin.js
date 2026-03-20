import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const CONFIG = {
    firebaseConfig: { apiKey: "REMOVED_FIREBASE_WEB_API_KEY", authDomain: "housechod.firebaseapp.com", projectId: "housechod", storageBucket: "housechod.firebasestorage.app", messagingSenderId: "818673632451", appId: "1:818673632451:web:dc4a1f33335fb98b59ce76" },
    appId: 'housechod-v1'
};

class AdminApp {
    constructor() {
        this.app = initializeApp(CONFIG.firebaseConfig);
        this.auth = getAuth(this.app);
        this.db = getFirestore(this.app);
        this.localRules = [];
        this.init();
    }
    init() {
        onAuthStateChanged(this.auth, u => u ? this.load() : null);
        document.getElementById('btnExport').onclick = () => this.export();
        document.getElementById('btnSaveRules').onclick = () => this.save();
    }
    async load() {
        const snap = await getDoc(doc(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'settings'));
        if(snap.exists()) { this.localRules = snap.data().rules || []; this.render(); }
    }
    render() {
        const cont = document.getElementById('rulesList'); cont.innerHTML = '';
        this.localRules.forEach((r, i) => {
            const div = document.createElement('div'); div.className = "bg-white p-6 rounded-2xl border border-slate-100 relative group";
            div.innerHTML = `<button onclick="window.admin.delRule(${i})" class="absolute top-4 right-4 text-slate-300 hover:text-red-500 font-bold text-[10px] uppercase">Remove</button><div class="grid grid-cols-2 gap-4 mb-4"><input type="text" placeholder="키워드" value="${r.match}" onchange="window.admin.updRule(${i},'match',this.value)" class="p-3 bg-slate-50 rounded-xl text-sm font-bold focus:outline-orange-500"><input type="number" placeholder="포인트" value="${r.pts}" onchange="window.admin.updRule(${i},'pts',this.value)" class="p-3 bg-slate-50 rounded-xl text-sm font-black text-orange-600 focus:outline-orange-500"></div><input type="text" placeholder="구역" value="${r.zone}" onchange="window.admin.updRule(${i},'zone',this.value)" class="w-full p-2.5 text-xs bg-slate-50/50 rounded-lg">`;
            cont.appendChild(div);
        });
    }
    addRule() { this.localRules.push({match:"", pts:10, zone:""}); this.render(); }
    updRule(i, k, v) { this.localRules[i][k] = k==='pts'?parseInt(v):v; }
    delRule(i) { this.localRules.splice(i, 1); this.render(); }
    async save() {
        await setDoc(doc(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'settings'), {rules:this.localRules}, {merge:true});
        this.toast("저장되었습니다.");
    }
    async export() {
        const snap = await getDocs(collection(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'chores'));
        const logs = snap.docs.map(d => d.data());
        let csv = "\uFEFF날짜,요정,활동,포인트,구역\n";
        logs.forEach(l => csv += `${l.date},${l.name},"${l.detail}",${l.points},${l.zone}\n`);
        const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `housechore_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    }
    toast(m) { const t = document.getElementById('toast'); t.innerText = m; t.classList.remove('opacity-0'); setTimeout(()=>t.classList.add('opacity-0'), 3000); }
}
window.admin = new AdminApp();
