const REQUIRED_FIREBASE_KEYS = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId"
];

function showConfigError(message) {
    const render = () => {
        if (document.getElementById("configError")) return;

        const box = document.createElement("div");
        box.id = "configError";
        box.style.cssText = [
            "position:fixed",
            "inset:16px",
            "z-index:9999",
            "display:flex",
            "align-items:center",
            "justify-content:center",
            "padding:24px",
            "background:rgba(15,23,42,.72)",
            "color:#0f172a",
            "font-family:system-ui,sans-serif"
        ].join(";");
        box.innerHTML = `
            <div style="max-width:560px;background:white;border-radius:16px;padding:24px;box-shadow:0 20px 50px rgba(15,23,42,.25)">
                <h1 style="font-size:20px;font-weight:800;margin:0 0 8px">Firebase configuration required</h1>
                <p style="font-size:14px;line-height:1.6;margin:0;color:#475569">${message}</p>
            </div>
        `;
        document.body.appendChild(box);
    };

    if (document.body) render();
    else document.addEventListener("DOMContentLoaded", render, { once: true });
}

export function getRuntimeConfig() {
    const runtimeConfig = window.HOUSECHORE_CONFIG;
    const firebaseConfig = runtimeConfig?.firebaseConfig;
    const missingKeys = firebaseConfig
        ? REQUIRED_FIREBASE_KEYS.filter(key => !firebaseConfig[key])
        : REQUIRED_FIREBASE_KEYS;

    if (!runtimeConfig || !firebaseConfig || missingKeys.length > 0) {
        const message = `Copy firebase-config.example.js to firebase-config.js, fill the Firebase web config, and keep firebase-config.js out of git. Missing: ${missingKeys.join(", ")}.`;
        showConfigError(message);
        throw new Error(message);
    }

    return {
        firebaseConfig,
        appId: runtimeConfig.appId || "housechod-v1"
    };
}
