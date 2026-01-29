import { CONFIG } from "./config.js";
const API_BASE = CONFIG.API_BASE;

// ---------------- DOM ----------------
const dateInput = document.getElementById("date");
const slotSelect = document.getElementById("slot");
const slotInfo = document.getElementById("slotInfo");
const payBtn = document.getElementById("payBtn");

// ---------------- HELPERS ----------------
function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function setSlotInfo(text, isError = false) {
  if (!slotInfo) return;
  slotInfo.textContent = text || "";
  slotInfo.style.color = isError ? "crimson" : "";
}

function setPayEnabled(enabled) {
  if (payBtn) payBtn.disabled = !enabled;
}

function resetSlotUI() {
  if (!slotSelect) return;

  // remettre les options à leur texte de base
  const morningOpt = [...slotSelect.options].find((o) => o.value === "morning");
  const afternoonOpt = [...slotSelect.options].find((o) => o.value === "afternoon");

  if (morningOpt) {
    morningOpt.disabled = false;
    morningOpt.textContent = "Matin de 11h à 14h";
  }
  if (afternoonOpt) {
    afternoonOpt.disabled = false;
    afternoonOpt.textContent = "Après-midi de 16h à 20h";
  }

  slotSelect.value = "";
  setPayEnabled(false);
}

function setOptionState(value, disabled, labelSuffix = "") {
  if (!slotSelect) return;
  const opt = [...slotSelect.options].find((o) => o.value === value);
  if (!opt) return;

  opt.disabled = !!disabled;
  opt.textContent =
    value === "morning"
      ? `Matin de 11h à 14h${labelSuffix}`
      : `Après-midi de 16h à 20h${labelSuffix}`;
}

// ---------------- FORMATION ----------------
function updateFormationFields() {
  const select = document.getElementById("formation-select");
  const formationInput = document.getElementById("formation");
  const prixInput = document.getElementById("prix");
  if (!select || !formationInput || !prixInput) return;

  const opt = select.options[select.selectedIndex];
  const formation = select.value || "";
  const price = opt?.dataset?.prix ? String(opt.dataset.prix) : "";

  formationInput.value = formation;
  prixInput.value = price ? `${price}€` : "0€";
}

function initFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const qFormation = params.get("formation");
  const qPrix = params.get("prix");

  const formationInput = document.getElementById("formation");
  const prixInput = document.getElementById("prix");
  const select = document.getElementById("formation-select");

  let used = false;

  if (qFormation && select) {
    const match = Array.from(select.options).find(
      (opt) => opt.value.trim().toLowerCase() === qFormation.trim().toLowerCase()
    );
    if (match) {
      select.value = match.value;
      updateFormationFields();
      used = true;
    }
  }

  if (qFormation && !used && formationInput) {
    formationInput.value = qFormation;
    used = true;
  }

  if (qPrix && prixInput) {
    prixInput.value = qPrix.replace("€", "").trim() + "€";
    used = true;
  }

  return used;
}

function getFormationDays() {
  const select = document.getElementById("formation-select");
  if (!select) return 1;
  const opt = select.options[select.selectedIndex];
  return opt?.dataset?.days ? Number(opt.dataset.days) : 1;
}

function getDateRange(startDate, days) {
  const dates = [];
  const d = new Date(startDate + "T00:00:00");

  for (let i = 0; i < days; i++) {
    const tmp = new Date(d);
    tmp.setDate(d.getDate() + i);
    dates.push(tmp.toISOString().slice(0, 10));
  }
  return dates;
}

// ---------------- AVAILABILITY (FORMATION) ----------------
async function fetchAvailability(date) {
  const res = await fetch(
    `${API_BASE}/availability?date=${encodeURIComponent(date)}&type=formation`
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Erreur disponibilité");
  return data;
}

// ✅ détecte si la date est bloquée admin (supporte plusieurs formats)
function isDayBlocked(av) {
  // 1) si ton backend renvoie explicitement blocked: true
  if (av?.blocked === true) return true;

  // 2) si le backend gère le blocage via open=false sur les 2 slots
  const mOpen = av?.slots?.morning?.open;
  const aOpen = av?.slots?.afternoon?.open;
  if (mOpen === false && aOpen === false) return true;

  return false;
}

async function onDateChange() {
  const date = dateInput?.value;
  if (!date) return;

  resetSlotUI();
  setSlotInfo("Chargement des disponibilités...");

  try {
    const av = await fetchAvailability(date);

    // ✅ Date bloquée par l'admin : on stop tout ici
    if (isDayBlocked(av)) {
      setOptionState("morning", true, " — Bloqué");
      setOptionState("afternoon", true, " — Bloqué");
      setPayEnabled(false);
      setSlotInfo("⛔ Cette date est bloquée par l'administration. Choisis une autre date.", true);
      return;
    }

    const m = av.slots.morning;
    const a = av.slots.afternoon;

    // matin
    if (!m.open) {
      setOptionState("morning", true, " — Fermé");
    } else if (m.remaining <= 0) {
      setOptionState("morning", true, " — Complet");
    } else {
      setOptionState("morning", false, ` — ${m.remaining} place(s)`);
    }

    // après-midi
    if (!a.open) {
      setOptionState("afternoon", true, " — Fermé");
    } else if (a.remaining <= 0) {
      setOptionState("afternoon", true, " — Complet");
    } else {
      setOptionState("afternoon", false, ` — ${a.remaining} place(s)`);
    }

    const anyOpen = (m.open && m.remaining > 0) || (a.open && a.remaining > 0);

    setSlotInfo(
      anyOpen
        ? `Disponibilités — Matin: ${m.remaining}/${m.quota} | Après-midi: ${a.remaining}/${a.quota}`
        : "Journée non disponible (fermée ou complète)."
    );
  } catch (e) {
    console.error(e);
    setPayEnabled(false);
    setSlotInfo(e.message || "Erreur de chargement des disponibilités.", true);
  }
}

function onSlotChange() {
  const v = slotSelect?.value;
  if (!v) {
    setPayEnabled(false);
    return;
  }

  // ✅ Empêche de valider un créneau désactivé
  const opt = [...slotSelect.options].find((o) => o.value === v);
  if (opt?.disabled) {
    slotSelect.value = "";
    setPayEnabled(false);
    setSlotInfo("Ce créneau n'est pas disponible.", true);
    return;
  }

  setPayEnabled(true);
}

// ---------------- COLLECT DATA ----------------
function collectReservationData() {
  const name = document.getElementById("nom")?.value.trim();
  const email = document.getElementById("email")?.value.trim();
  const phone = document.getElementById("telephone")?.value.trim();

  const date = document.getElementById("date")?.value;
  const slot = document.getElementById("slot")?.value;

  const formationSelect = document.getElementById("formation-select");
  const formationInput = document.getElementById("formation");
  const prixInput = document.getElementById("prix");

  const opt = formationSelect?.options?.[formationSelect.selectedIndex];

  const formation =
    formationInput?.value.trim() ||
    formationSelect?.value?.trim() ||
    "";

  let totalPriceEUR = "";
  if (opt?.dataset?.prix) {
    totalPriceEUR = String(opt.dataset.prix);
  } else if (prixInput?.value) {
    totalPriceEUR = prixInput.value.replace("€", "").replace(",", ".").trim();
  }

  const message = document.getElementById("message")?.value?.trim() || "";

  return {
    date,
    slot,
    customer: { name, email, phone },
    formation,
    totalPriceEUR,
    message,
  };
}

// ---------------- STRIPE ----------------
async function createCheckoutSession(payload) {
  const res = await fetch(`${API_BASE}/payments/create-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Erreur création Checkout");
  return data;
}

// ---------------- INIT ----------------
document.addEventListener("DOMContentLoaded", () => {
  // min date = today (bloque dates passées)
  if (dateInput) dateInput.min = todayISO();

  // init formation
  const formationSelect = document.getElementById("formation-select");
  formationSelect?.addEventListener("change", updateFormationFields);

  const filledFromUrl = initFromUrl();
  if (!filledFromUrl) updateFormationFields();

  // events
  dateInput?.addEventListener("change", onDateChange);
  slotSelect?.addEventListener("change", onSlotChange);

  // submit
  const form = document.getElementById("reservationForm");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = collectReservationData();

    // dateRange basé sur data-days
    const days = getFormationDays();
    payload.dateRange = (payload.date && days) ? getDateRange(payload.date, days) : [];

    if (!payload.date || !payload.slot) return alert("Choisis une date et un créneau.");
    if (!payload.customer.name || !payload.customer.email || !payload.customer.phone)
      return alert("Complète nom, email et téléphone.");
    if (!payload.formation || !payload.totalPriceEUR)
      return alert("Choisis une formation.");

    // 🔒 Vérification finale: date/créneau encore dispo (anti-triche + anti-changement)
    try {
      const av = await fetchAvailability(payload.date);

      if (isDayBlocked(av)) {
        alert("⛔ Cette date est bloquée par l'administration. Choisis une autre date.");
        return;
      }

      const m = av.slots.morning;
      const a = av.slots.afternoon;

      const ok =
        (payload.slot === "morning" && m.open && m.remaining > 0) ||
        (payload.slot === "afternoon" && a.open && a.remaining > 0);

      if (!ok) {
        alert("❌ Ce créneau n'est plus disponible. Choisis un autre créneau/date.");
        return;
      }
    } catch (e) {
      alert("Erreur de vérification des disponibilités. Réessaie.");
      return;
    }

    // ✅ Stripe
    try {
      const { url } = await createCheckoutSession(payload);
      window.location.href = url;
    } catch (err) {
      alert(err.message || "Erreur paiement Stripe");
    }
  });
});
