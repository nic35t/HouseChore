import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getRuntimeConfig } from "./config.js";

const CONFIG = getRuntimeConfig();

class AdminApp {
    constructor() {
        this.app = initializeApp(CONFIG.firebaseConfig);
        this.auth = getAuth(this.app);
        this.db = getFirestore(this.app);
        this.localRules = [];
        this.init();
    }
    init() {
        onAuthStateChanged(this.auth, u => {
            if (u) this.load();
            else { alert("인증이 필요합니다."); window.location.href = "index.html"; }
        });
        document.getElementById('btnExport').onclick = () => this.export();
        document.getElementById('btnSaveRules').onclick = () => this.save();
    }
    async load() {
        // [수정됨] 짝수 경로(6단계) 구성을 위해 settings 컬렉션 하위의 'global' 문서로 변경
        const snap = await getDoc(doc(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'settings', 'global'));
        if(snap.exists()) { this.localRules = snap.data().rules || []; this.render(); }
    }
    render() {
        const cont = document.getElementById('rulesList'); cont.innerHTML = '';
        this.localRules.forEach((r, i) => {
            const div = document.createElement('div'); div.className = "bg-white p-6 rounded-2xl border border-slate-100 relative group shadow-sm";
            // 단위 변경 반영 (포인트 -> 시간(분))
            div.innerHTML = `<button onclick="window.admin.delRule(${i})" class="absolute top-4 right-4 text-slate-300 hover:text-red-500 font-bold text-[10px] uppercase">Remove</button><div class="grid grid-cols-2 gap-4 mb-4"><input type="text" placeholder="키워드" value="${r.match}" onchange="window.admin.updRule(${i},'match',this.value)" class="p-3 bg-slate-50 rounded-xl text-sm font-bold"><input type="number" placeholder="시간(분)" value="${r.pts}" onchange="window.admin.updRule(${i},'pts',this.value)" class="p-3 bg-slate-50 rounded-xl text-sm font-black text-orange-600"></div><input type="text" placeholder="구역" value="${r.zone}" onchange="window.admin.updRule(${i},'zone',this.value)" class="w-full p-2.5 text-xs bg-slate-50/50 rounded-lg">`;
            cont.appendChild(div);
        });
    }
    addRule() { this.localRules.push({match:"", pts:10, zone:""}); this.render(); }
    updRule(i, k, v) { this.localRules[i][k] = k==='pts'?parseInt(v)||0:v; }
    delRule(i) { this.localRules.splice(i, 1); this.render(); }
    async save() {
        // [수정됨] 짝수 경로(6단계) 구성을 위해 settings 컬렉션 하위의 'global' 문서로 변경
        await setDoc(doc(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'settings', 'global'), {rules:this.localRules}, {merge:true});
        this.toast("규칙이 성공적으로 저장되었습니다.");
    }
    async export() {
        const snap = await getDocs(collection(this.db, 'artifacts', CONFIG.appId, 'public', 'data', 'chores'));
        const logs = snap.docs.map(d => d.data());
        // 단위 변경 반영 (포인트 -> 시간(분))
        let csv = "\uFEFF날짜,요정,활동,시간(분),구역\n";
        logs.forEach(l => csv += `${l.date},${l.name},"${String(l.detail).replace(/"/g,'""')}",${l.points},${l.zone}\n`);
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
        a.download = `housechore_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    }
    toast(m) { const t = document.getElementById('toast'); t.innerText = m; t.classList.remove('opacity-0'); setTimeout(()=>t.classList.add('opacity-0'), 3000); }
}
window.admin = new AdminApp();
