// front/js/admin-sessions.js
import { CONFIG } from "./config.js";

const API_BASE = CONFIG.API_BASE || "https://rkbeauty-api.onrender.com";
const qs = (id) => document.getElementById(id);

function show(msg, ok = true) {
  const el = qs("fsStatusMsg");
  if (!el) return;
  el.textContent = msg;
  el.className = "badge " + (ok ? "ok" : "err");
}

function getToken() {
  const t = (qs("adminToken")?.value || "").trim();
  if (!t) throw new Error("Token admin manquant.");
  return t;
}

function headers() {
  return {
    "Content-Type": "application/json",
    "x-admin-token": getToken(),
  };
}

// Mapping auto depuis ton code (pratique)
function inferFromCode(code) {
  // Ex: F2J-150 -> label "Formation 2 jours", days=2, price=150
  // Ex: P7J-250 -> label "Promo spéciale 7 jours", days=7, price=250
  if (!code) return null;

  const [prefix, priceStr] = code.split("-");
  const price = Number(priceStr || 0);

  const isPromo = prefix.startsWith("P");
  const unit = prefix.includes("S") ? "semaines" : "jours";

  // F2J / F4S / P2S etc
  const num = Number(prefix.replace(/[^\d]/g, "")) || 0;
  const isWeeks = prefix.includes("S");
  const days = isWeeks ? num * 7 : num; // 2S=14, 4S=28 ; 2J=2 etc

  let label = "";
  if (isPromo) {
    label = `Promo spéciale ${days} jours`;
  } else if (isWeeks) {
    label = `Formation ${num} semaines`;
  } else {
    label = `Formation ${num} jours`;
  }

  return { label, days, price };
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  if (!res.ok) {
    const msg = data?.message || `Erreur HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function rowHtml(s) {
  const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return `
    <tr data-id="${esc(s.id)}">
      <td>${esc(s.id)}</td>
      <td>${esc(s.formation_code)}</td>
      <td><input class="fsStart form-control" type="date" value="${esc(String(s.start_date).slice(0,10))}"></td>
      <td><input class="fsDays form-control" type="number" min="1" max="60" value="${esc(s.days_count)}"></td>
      <td><input class="fsCap form-control" type="number" min="1" value="${esc(s.capacity)}"></td>
      <td>${esc(s.reserved ?? 0)}</td>
      <td>${esc(s.holds ?? 0)}</td>
      <td>${esc(s.remaining ?? 0)}</td>
      <td>
        <select class="fsStatus form-control">
          <option value="draft" ${s.status==="draft"?"selected":""}>draft</option>
          <option value="published" ${s.status==="published"?"selected":""}>published</option>
          <option value="closed" ${s.status==="closed"?"selected":""}>closed</option>
        </select>
      </td>
      <td><input class="fsNote form-control" type="text" value="${esc(s.note ?? "")}"></td>
      <td style="white-space:nowrap;">
        <button class="btn btn-primary fsSave">💾</button>
        <button class="btn fsDel">🗑️</button>
      </td>
    </tr>
  `;
}

async function loadList() {
  show("Chargement...");
  const rows = await api("/admin/formation-sessions", { headers: headers() });
  const body = qs("fsTableBody");
  body.innerHTML = rows.map(rowHtml).join("");
  show(`OK (${rows.length} session(s))`, true);
}

async function createSession() {
  const code = (qs("fsFormationCode").value || "").trim();
  if (!code) throw new Error("Choisis une formation_code.");

  const inf = inferFromCode(code);

  const formation_label = (qs("fsLabel").value || inf?.label || "").trim();
  const price_eur = Number(qs("fsPrice").value || inf?.price || 0);
  const days_count = Number(qs("fsDays").value || inf?.days || 1);
  const start_date = (qs("fsStartDate").value || "").trim();
  const capacity = Number(qs("fsCapacity").value || 1);
  const slot_policy = (qs("fsSlotPolicy").value || "both").trim();
  const status = (qs("fsStatus").value || "draft").trim();
  const note = (qs("fsNote").value || "").trim() || null;

  if (!formation_label) throw new Error("Libellé requis.");
  if (!start_date) throw new Error("Date début requise.");
  if (!Number.isFinite(price_eur) || price_eur < 0) throw new Error("Prix invalide.");
  if (!Number.isFinite(days_count) || days_count < 1 || days_count > 60) throw new Error("Durée invalide.");
  if (!Number.isFinite(capacity) || capacity < 1) throw new Error("Capacity invalide.");

  await api("/admin/formation-sessions", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      formation_code: code,
      formation_label,
      price_eur,
      days_count,
      start_date,
      capacity,
      slot_policy,
      status,
      note,
    }),
  });

  show("Session créée ✅");
  await loadList();
}

async function saveRow(tr) {
  const id = tr.dataset.id;
  const start_date = tr.querySelector(".fsStart").value;
  const days_count = Number(tr.querySelector(".fsDays").value);
  const capacity = Number(tr.querySelector(".fsCap").value);
  const status = tr.querySelector(".fsStatus").value;
  const note = tr.querySelector(".fsNote").value.trim() || null;

  await api(`/admin/formation-sessions/${id}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ start_date, days_count, capacity, status, note }),
  });

  show(`Session ${id} mise à jour ✅`);
  await loadList();
}

async function deleteRow(tr) {
  const id = tr.dataset.id;
  if (!confirm(`Supprimer la session ${id} ?`)) return;

  await api(`/admin/formation-sessions/${id}`, {
    method: "DELETE",
    headers: headers(),
  });

  show(`Session ${id} supprimée ✅`);
  await loadList();
}

function hookAutoFill() {
  const sel = qs("fsFormationCode");
  const label = qs("fsLabel");
  const price = qs("fsPrice");
  const days = qs("fsDays");

  sel?.addEventListener("change", () => {
    const inf = inferFromCode(sel.value);
    if (!inf) return;
    if (!label.value) label.value = inf.label;
    if (!price.value) price.value = String(inf.price || "");
    if (!days.value) days.value = String(inf.days || "");
  });
}

function hookTableActions() {
  qs("fsTableBody")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const tr = e.target.closest("tr");
    if (!tr) return;

    try {
      if (btn.classList.contains("fsSave")) await saveRow(tr);
      if (btn.classList.contains("fsDel")) await deleteRow(tr);
    } catch (err) {
      show(err.message || "Erreur", false);
    }
  });
}

async function main() {
  hookAutoFill();
  hookTableActions();

  qs("fsCreateBtn")?.addEventListener("click", async () => {
    try { await createSession(); }
    catch (err) { show(err.message || "Erreur", false); }
  });

  qs("fsReloadBtn")?.addEventListener("click", async () => {
    try { await loadList(); }
    catch (err) { show(err.message || "Erreur", false); }
  });

  // chargement initial (si token déjà renseigné)
  try { await loadList(); } catch { /* ignore */ }
}

main();
