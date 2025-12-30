// js/admin-planning.js
import { CONFIG } from "./config.js"; // votre config exporte CONFIG :contentReference[oaicite:3]{index=3}

const API_BASE = CONFIG.API_BASE || "https://rkbeauty-api.onrender.com";


function qs(id){ return document.getElementById(id); }

function showStatus(msg, kind="ok"){
  const el = qs("status");
  el.textContent = msg;
  el.classList.remove("ok","err");
  el.classList.add(kind === "err" ? "err" : "ok");
}

function getToken(){
  const t = qs("adminToken").value.trim();
  if(!t) throw new Error("Token admin manquant.");
  return t;
}

function getDate(){
  const d = qs("date").value;
  if(!d) throw new Error("Date manquante.");
  return d;
}

function getType(){
  const t = qs("type").value;
  if(t !== "service" && t !== "formation") throw new Error("Type invalide.");
  return t;
}

function applyToUI(data){
  qs("morningOpen").checked = !!data?.morning?.open;
  qs("afternoonOpen").checked = !!data?.afternoon?.open;
  qs("morningQuota").value = String(data?.morning?.quota ?? 8);
  qs("afternoonQuota").value = String(data?.afternoon?.quota ?? 8);
}

function payloadFromUI(){
  const mQuota = Number(qs("morningQuota").value);
  const aQuota = Number(qs("afternoonQuota").value);
  if(!Number.isFinite(mQuota) || mQuota < 0) throw new Error("Quota matin invalide.");
  if(!Number.isFinite(aQuota) || aQuota < 0) throw new Error("Quota après-midi invalide.");

  return {
    morning: { open: !!qs("morningOpen").checked, quota: mQuota },
    afternoon: { open: !!qs("afternoonOpen").checked, quota: aQuota }
  };
}

async function apiGet(date, type, token){
  const url = `${API_BASE}/admin/schedule?date=${encodeURIComponent(date)}&type=${encodeURIComponent(type)}`;
  const res = await fetch(url, { headers: { "x-admin-token": token } });
  const data = await res.json().catch(()=> ({}));
  if(!res.ok) throw new Error(data.message || "Erreur chargement admin");
  return data;
}

async function apiPut(date, type, token, payload){
  const url = `${API_BASE}/admin/schedule?date=${encodeURIComponent(date)}&type=${encodeURIComponent(type)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type":"application/json", "x-admin-token": token },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(()=> ({}));
  if(!res.ok) throw new Error(data.message || "Erreur enregistrement admin");
  return data;
}

async function apiDelete(date, type, token){
  const url = `${API_BASE}/admin/schedule?date=${encodeURIComponent(date)}&type=${encodeURIComponent(type)}`;
  const res = await fetch(url, { method: "DELETE", headers: { "x-admin-token": token } });
  const data = await res.json().catch(()=> ({}));
  if(!res.ok) throw new Error(data.message || "Erreur reset admin");
  return data;
}

document.addEventListener("DOMContentLoaded", ()=>{
  // date par défaut = aujourd’hui
  const now = new Date();
  qs("date").value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;

  // defaults UI
  qs("morningOpen").checked = true;
  qs("afternoonOpen").checked = true;

  qs("loadBtn").addEventListener("click", async ()=>{
    try{
      showStatus("Chargement...", "ok");
      const token = getToken();
      const date = getDate();
      const type = getType();
      const data = await apiGet(date, type, token);
      applyToUI(data);
      showStatus("Planning chargé.", "ok");
    }catch(e){
      showStatus(e.message || String(e), "err");
    }
  });

  qs("saveBtn").addEventListener("click", async ()=>{
    try{
      showStatus("Enregistrement...", "ok");
      const token = getToken();
      const date = getDate();
      const type = getType();
      const payload = payloadFromUI();
      await apiPut(date, type, token, payload);
      showStatus("Enregistré.", "ok");
    }catch(e){
      showStatus(e.message || String(e), "err");
    }
  });

  qs("blockDayBtn").addEventListener("click", ()=>{
    qs("morningOpen").checked = false;
    qs("afternoonOpen").checked = false;
    qs("morningQuota").value = "0";
    qs("afternoonQuota").value = "0";
    showStatus("Journée bloquée (0 quota + fermé).", "ok");
  });

  qs("resetBtn").addEventListener("click", async ()=>{
    try{
      showStatus("Réinitialisation...", "ok");
      const token = getToken();
      const date = getDate();
      const type = getType();
      await apiDelete(date, type, token);

      // Remet valeurs par défaut UI (sans overrides)
      qs("morningOpen").checked = true;
      qs("afternoonOpen").checked = true;
      qs("morningQuota").value = "8";
      qs("afternoonQuota").value = "8";

      showStatus("Overrides supprimés (valeurs par défaut).", "ok");
    }catch(e){
      showStatus(e.message || String(e), "err");
    }
  });
});
