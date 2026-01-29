// js/admin-planning.js
import { CONFIG } from "./config.js"; // votre config exporte CONFIG :contentReference[oaicite:3]{index=3}

const API_BASE = CONFIG.API_BASE || "https://rkbeauty-api.onrender.com";

const el = (id) => document.getElementById(id);

const adminToken = el("adminToken");
const typeSel = el("type");
const dateInp = el("date");

const morningOpen = el("morningOpen");
const morningQuota = el("morningQuota");
const afternoonOpen = el("afternoonOpen");
const afternoonQuota = el("afternoonQuota");

const status = el("status");
const loadBtn = el("loadBtn");
const saveBtn = el("saveBtn");
const blockDayBtn = el("blockDayBtn");
const resetBtn = el("resetBtn");

function badge(text, ok = true) {
  status.textContent = text;
  status.className = "badge " + (ok ? "ok" : "err");
}

function getHeaders() {
  const t = (adminToken.value || "").trim();
  return {
    "Content-Type": "application/json",
    "x-admin-token": t,
  };
}

function getQuery() {
  const date = dateInp.value;
  const type = typeSel.value;
  if (!date) throw new Error("Choisis une date");
  if (!type) throw new Error("Choisis un type");
  return { date, type };
}

function toInt(v) {
  const n = Number(String(v).trim());
  if (!Number.isFinite(n) || n < 0) throw new Error("Quota invalide");
  return Math.floor(n);
}

async function apiGetSchedule() {
  const { date, type } = getQuery();
  const res = await fetch(`${API_BASE}/admin/schedule?date=${encodeURIComponent(date)}&type=${encodeURIComponent(type)}`, {
    method: "GET",
    headers: getHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Erreur GET (${res.status})`);
  return data;
}

async function apiPutSchedule(payload) {
  const { date, type } = getQuery();
  const res = await fetch(`${API_BASE}/admin/schedule?date=${encodeURIComponent(date)}&type=${encodeURIComponent(type)}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Erreur PUT (${res.status})`);
  return data;
}

async function apiDeleteSchedule() {
  const { date, type } = getQuery();
  const res = await fetch(`${API_BASE}/admin/schedule?date=${encodeURIComponent(date)}&type=${encodeURIComponent(type)}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Erreur DELETE (${res.status})`);
  return data;
}

loadBtn.addEventListener("click", async () => {
  try {
    badge("Chargement...");
    const s = await apiGetSchedule();

    // backend renvoie: { morning:{open,quota}, afternoon:{open,quota} }
    morningOpen.checked = !!s.morning.open;
    morningQuota.value = String(s.morning.quota);

    afternoonOpen.checked = !!s.afternoon.open;
    afternoonQuota.value = String(s.afternoon.quota);

    badge("Chargé ✅", true);
  } catch (e) {
    console.error(e);
    badge(e.message || "Erreur chargement", false);
  }
});

saveBtn.addEventListener("click", async () => {
  try {
    badge("Enregistrement...");
    const payload = {
      morning: { open: morningOpen.checked, quota: toInt(morningQuota.value) },
      afternoon: { open: afternoonOpen.checked, quota: toInt(afternoonQuota.value) },
    };
    await apiPutSchedule(payload);
    badge("Enregistré ✅", true);
  } catch (e) {
    console.error(e);
    badge(e.message || "Erreur enregistrement", false);
  }
});

blockDayBtn.addEventListener("click", async () => {
  try {
    badge("Blocage journée...");
    const payload = {
      morning: { open: false, quota: 0 },
      afternoon: { open: false, quota: 0 },
    };
    await apiPutSchedule(payload);
    // sync UI
    morningOpen.checked = false; morningQuota.value = "0";
    afternoonOpen.checked = false; afternoonQuota.value = "0";
    badge("Journée bloquée ✅", true);
  } catch (e) {
    console.error(e);
    badge(e.message || "Erreur blocage", false);
  }
});

resetBtn.addEventListener("click", async () => {
  try {
    badge("Réinitialisation...");
    await apiDeleteSchedule();
    badge("Réinitialisé ✅ (overrides supprimés)", true);
  } catch (e) {
    console.error(e);
    badge(e.message || "Erreur reset", false);
  }
});
