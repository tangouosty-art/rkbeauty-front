// js/service.js
import { CONFIG } from "./config.js";

// ---------------- CONFIG ----------------
const API_BASE = CONFIG.API_BASE || "https://rkbeauty-api.onrender.com";

// Slots techniques (DB/API) : morning / afternoon
// UI : Matin / Soir
const SLOT_LABELS = {
  morning: "Matin",
  afternoon: "Soir",
};

// ---------------- STATE ----------------
const state = {
  slotDate: null,      // YYYY-MM-DD
  slotTime: null,      // "morning" | "afternoon"
  service: { name: "", totalEUR: 0, depositEUR: 0 },
  customer: { nom: "", prenom: "", email: "" },
};

// ---------------- ELEMENTS ----------------
const elCalendar = document.getElementById("calendar");
const elPickedInfo = document.getElementById("pickedInfo");
const elNextBtn = document.getElementById("nextBtn");

const elStep1 = document.getElementById("step1");
const elStep2 = document.getElementById("step2");

const elBackToCalendar = document.getElementById("backToCalendar");
const elForm = document.getElementById("serviceForm");

const elNom = document.getElementById("nom");
const elPrenom = document.getElementById("prenom");
const elEmail = document.getElementById("email");

const elMaquillage = document.getElementById("maquillage");
const elPrixTotal = document.getElementById("prixTotal");
const elAcompte = document.getElementById("acompte");
const elSummary = document.getElementById("summary");

// ---------------- HELPERS ----------------
function eur(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0.00€";
  return `${v.toFixed(2)}€`;
}

function computeDeposit(totalEUR) {
  const t = Number(totalEUR);
  if (!Number.isFinite(t)) return 0;
  return Math.round(t * 0.5 * 100) / 100;
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayFR(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function setPickedInfo() {
  if (!state.slotDate || !state.slotTime) {
    elPickedInfo.textContent = "Aucun créneau sélectionné.";
    elNextBtn.disabled = true;
    return;
  }
  elPickedInfo.innerHTML = `
    <strong>Créneau choisi :</strong> ${formatDayFR(state.slotDate)} — ${SLOT_LABELS[state.slotTime]}
  `;
  elNextBtn.disabled = false;
}

function goToStep(step) {
  if (step === 1) {
    elStep1.classList.remove("hidden");
    elStep2.classList.add("hidden");
  } else {
    elStep1.classList.add("hidden");
    elStep2.classList.remove("hidden");
  }
}

// ---------------- AVAILABILITY ----------------
// Normalise plusieurs formats possibles vers:
// { morning: {remaining}, afternoon: {remaining} }
function normalizeAvailability(data) {
  // Format recommandé:
  // { slots: { morning: {remaining}, afternoon: {remaining} } }
  if (data?.slots?.morning && data?.slots?.afternoon) return data.slots;

  // Formats alternatifs possibles:
  // { morningRemaining: 1, afternoonRemaining: 2 }
  if (
    Number.isFinite(data?.morningRemaining) ||
    Number.isFinite(data?.afternoonRemaining)
  ) {
    return {
      morning: { remaining: Number(data?.morningRemaining ?? 0) },
      afternoon: { remaining: Number(data?.afternoonRemaining ?? 0) },
    };
  }

  // fallback : on affiche tout complet si on ne sait pas
  return {
    morning: { remaining: 0 },
    afternoon: { remaining: 0 },
  };
}

async function fetchAvailability(isoDate) {
  // ✅ IMPORTANT: URL ABSOLUE + type=service
  const url = `${API_BASE}/availability?date=${encodeURIComponent(
    isoDate
  )}&type=service`;

  const r = await fetch(url);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || `HTTP ${r.status}`);

  return normalizeAvailability(data);
}

// ---------------- CALENDAR RENDER ----------------
function clearSelectionUI() {
  document
    .querySelectorAll(".slot-btn[aria-pressed='true']")
    .forEach((b) => b.setAttribute("aria-pressed", "false"));
}

function selectSlot(isoDate, slotKey, btn) {
  state.slotDate = isoDate;
  state.slotTime = slotKey;

  clearSelectionUI();
  btn.setAttribute("aria-pressed", "true");
  setPickedInfo();
  updateSummaryBox();
}

function makeSlotButton({ isoDate, slotKey, remaining }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "slot-btn";
  btn.setAttribute("aria-pressed", "false");

  const label = SLOT_LABELS[slotKey] || slotKey;

  if (!Number.isFinite(remaining) || remaining <= 0) {
    btn.disabled = true;
    btn.textContent = `${label} — Complet`;
  } else {
    btn.disabled = false;
    btn.textContent = `${label} — ${remaining} place(s)`;
  }

  btn.addEventListener("click", () => selectSlot(isoDate, slotKey, btn));
  return btn;
}

async function renderDay(detailsEl, isoDate) {
  const slotsWrap = detailsEl.querySelector(".slots");
  slotsWrap.innerHTML = `<div class="muted" style="grid-column:1/-1;">Chargement...</div>`;

  try {
    const slots = await fetchAvailability(isoDate);

    const morningRemaining = Number(slots?.morning?.remaining);
    const afternoonRemaining = Number(slots?.afternoon?.remaining);

    slotsWrap.innerHTML = "";
    slotsWrap.appendChild(
      makeSlotButton({ isoDate, slotKey: "morning", remaining: morningRemaining })
    );
    slotsWrap.appendChild(
      makeSlotButton({
        isoDate,
        slotKey: "afternoon",
        remaining: afternoonRemaining,
      })
    );
  } catch (err) {
    console.error("Availability error:", err);

    slotsWrap.innerHTML = `
      <div style="grid-column:1/-1;">
        <div class="muted" style="margin-bottom:10px;">
          Impossible de charger les créneaux : <strong>${err.message || "erreur inconnue"}</strong>
        </div>
        <button type="button" class="slot-btn" id="retryBtn">Réessayer</button>
      </div>
    `;

    const retryBtn = slotsWrap.querySelector("#retryBtn");
    retryBtn.addEventListener("click", () => renderDay(detailsEl, isoDate));
  }
}

function buildCalendar(days = 14) {
  elCalendar.innerHTML = "";

  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const isoDate = toISODate(d);

    const details = document.createElement("details");
    details.className = "day";

    const summary = document.createElement("summary");
    summary.textContent = formatDayFR(isoDate);

    const right = document.createElement("span");
    right.className = "muted";
    right.textContent = "Voir les créneaux";
    summary.appendChild(right);

    const slots = document.createElement("div");
    slots.className = "slots";

    details.appendChild(summary);
    details.appendChild(slots);

    // ✅ Important: si ça échoue, l’utilisateur peut réessayer
    let loaded = false;
    details.addEventListener("toggle", async () => {
      if (!details.open) return;
      if (!loaded) {
        loaded = true;
        await renderDay(details, isoDate);
      }
    });

    elCalendar.appendChild(details);
  }
}

// ---------------- STEP 2 (FORM + RECAP) ----------------
function updatePricesFromSelect() {
  const opt = elMaquillage.selectedOptions[0];
  const price = opt ? Number(opt.getAttribute("data-prix")) : 0;

  state.service.name = opt?.value || "";
  state.service.totalEUR = Number.isFinite(price) ? price : 0;
  state.service.depositEUR = computeDeposit(state.service.totalEUR);

  elPrixTotal.value = eur(state.service.totalEUR);
  elAcompte.value = eur(state.service.depositEUR);

  updateSummaryBox();
}

function updateSummaryBox() {
  const dateLine =
    state.slotDate && state.slotTime
      ? `${formatDayFR(state.slotDate)} — ${SLOT_LABELS[state.slotTime]}`
      : "Non sélectionné";

  const serviceLine = state.service.name
    ? `${state.service.name} (${eur(state.service.totalEUR)})`
    : "Non sélectionné";

  elSummary.innerHTML = `
    <strong>Récapitulatif</strong><br>
    <span class="muted">Créneau :</span> ${dateLine}<br>
    <span class="muted">Prestation :</span> ${serviceLine}<br>
    <span class="muted">Acompte (50%) :</span> <strong>${eur(
      state.service.depositEUR
    )}</strong><br>
    <span class="muted">Paiement :</span> PayPal (obligatoire)
  `;
}

function validateStep2() {
  const nom = elNom.value.trim();
  const prenom = elPrenom.value.trim();
  const email = elEmail.value.trim();

  if (!state.slotDate || !state.slotTime)
    return { ok: false, message: "Veuillez choisir un créneau." };
  if (!nom || !prenom || !email)
    return { ok: false, message: "Veuillez remplir nom, prénom et email." };
  if (!state.service.name || !Number.isFinite(state.service.totalEUR) || state.service.totalEUR <= 0) {
    return { ok: false, message: "Veuillez sélectionner une prestation." };
  }

  state.customer.nom = nom;
  state.customer.prenom = prenom;
  state.customer.email = email;

  return { ok: true };
}

// ---------------- PAYPAL ----------------
async function createPayPalOrderAndRedirect() {
  const payload = {
    slotDate: state.slotDate,
    slotTime: state.slotTime, // "morning" | "afternoon"
    customer: {
      nom: state.customer.nom,
      prenom: state.customer.prenom,
      email: state.customer.email,
    },
    service: {
      name: state.service.name,
      totalEUR: state.service.totalEUR,
      depositEUR: state.service.depositEUR,
    },
  };

  const r = await fetch(`${API_BASE}/paypal/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || "Erreur PayPal create-order");
  if (!data?.approvalUrl) throw new Error("Approval URL introuvable (PayPal).");

  window.location.href = data.approvalUrl;
}

// ---------------- EVENTS ----------------
elNextBtn.addEventListener("click", () => {
  goToStep(2);
  updateSummaryBox();
});

elBackToCalendar.addEventListener("click", (e) => {
  e.preventDefault();
  goToStep(1);
});

elMaquillage.addEventListener("change", () => updatePricesFromSelect());

elForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const cgvCheckbox = document.getElementById("acceptCGV");

  if (!cgvCheckbox || !cgvCheckbox.checked) {
    alert("Veuillez accepter les Conditions Générales de Vente avant de continuer.");
    return;
  }


  const v = validateStep2();
  if (!v.ok) {
    alert(v.message);
    return;
  }

  const btn = document.getElementById("reserveBtn");
  btn.disabled = true;
  btn.textContent = "Redirection vers PayPal...";

  try {
    await createPayPalOrderAndRedirect();
  } catch (err) {
    alert(err.message || "Erreur paiement PayPal");
    btn.disabled = false;
    btn.textContent = "Réserver (PayPal)";
  }
});

// ---------------- INIT ----------------
buildCalendar(14);
setPickedInfo();
updatePricesFromSelect();
updateSummaryBox();
goToStep(1);
