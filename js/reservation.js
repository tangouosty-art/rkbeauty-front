import { CONFIG } from "./config.js";
const API_BASE = CONFIG.API_BASE;

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

/**
 * Pré-remplit le formulaire à partir des paramètres d'URL
 * ?formation=...&prix=...
 * Retourne true si quelque chose a été pré-rempli.
 */
function initFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const qFormation = params.get("formation"); // ex: "Promo spéciale 7 jours"
  const qPrix = params.get("prix");           // ex: "250"

  const formationInput = document.getElementById("formation");
  const prixInput = document.getElementById("prix");
  const select = document.getElementById("formation-select");

  let used = false;

  // 1) Essayer de faire correspondre à une option du select
  if (qFormation && select) {
    const match = Array.from(select.options).find(
      (opt) =>
        opt.value.trim().toLowerCase() ===
        qFormation.trim().toLowerCase()
    );
    if (match) {
      select.value = match.value;
      updateFormationFields(); // remplit formation + prix depuis le select
      used = true;
    }
  }

  // 2) Si aucune option ne correspond (ex: promo spéciale qui n'est pas dans le select)
  if (qFormation && !used && formationInput) {
    formationInput.value = qFormation;
    used = true;
  }

  // 3) Toujours essayer de remplir le prix si présent dans l'URL
  if (qPrix && prixInput) {
    prixInput.value = qPrix.replace("€", "").trim() + "€";
    used = true;
  }

  return used;
}

function getFormationDays() {
  const select = document.getElementById("formation-select");
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Erreur disponibilité");
  return data;
}

function setSlotInfo(text, isError = false) {
  const el = document.getElementById("slotInfo");
  if (!el) return;
  el.textContent = text || "";
  el.style.color = isError ? "crimson" : "";
}

function applyAvailabilityToUI(av) {
  const slotSelect = document.getElementById("slot");
  if (!slotSelect) return;

  const morningOpt = [...slotSelect.options].find((o) => o.value === "morning");
  const afternoonOpt = [...slotSelect.options].find(
    (o) => o.value === "afternoon"
  );

  const morningRemaining = av.slots.morning.remaining;
  const afternoonRemaining = av.slots.afternoon.remaining;

  if (morningOpt) {
    morningOpt.disabled = morningRemaining <= 0;
    morningOpt.textContent =
      morningRemaining > 0
        ? `Matin (reste ${morningRemaining})`
        : `Matin (complet)`;
  }

  if (afternoonOpt) {
    afternoonOpt.disabled = afternoonRemaining <= 0;
    afternoonOpt.textContent =
      afternoonRemaining > 0
        ? `Après-midi (reste ${afternoonRemaining})`
        : `Après-midi (complet)`;
  }

  if (
    (slotSelect.value === "morning" && morningRemaining <= 0) ||
    (slotSelect.value === "afternoon" && afternoonRemaining <= 0)
  ) {
    slotSelect.value = "";
  }

  setSlotInfo(
    `Disponibilités — Matin: ${morningRemaining}/${av.slots.morning.max} | Après-midi: ${afternoonRemaining}/${av.slots.afternoon.max}`
  );
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

// ---------------- EVENTS ----------------
document.addEventListener("DOMContentLoaded", () => {
  const formationSelect = document.getElementById("formation-select");
  const dateInput = document.getElementById("date");
  const form = document.getElementById("reservationForm");

  // Quand la personne change manuellement la formation dans la liste
  formationSelect?.addEventListener("change", updateFormationFields);

  // 1) On essaie de pré-remplir depuis l'URL (formations.html / promo.html)
  const filledFromUrl = initFromUrl();

  // 2) Si pas de paramètres d'URL, on initialise avec la valeur du select
  if (!filledFromUrl) {
    updateFormationFields();
  }

  // 3) Disponibilités par date
  dateInput?.addEventListener("change", async () => {
    if (!dateInput.value) return;
    setSlotInfo("Chargement des disponibilités...");
    try {
      const av = await fetchAvailability(dateInput.value);
      applyAvailabilityToUI(av);
    } catch (e) {
      setSlotInfo(e.message, true);
    }
  });

  // 4) Submit -> Stripe
  form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = collectReservationData();

  // ✅ Calcul du dateRange AVANT l'envoi
  const days = getFormationDays();
  const dateRange = (payload.date && days) ? getDateRange(payload.date, days) : [];
  payload.dateRange = dateRange;

  if (!payload.date || !payload.slot)
    return alert("Choisis une date et un créneau.");
  if (!payload.customer.name || !payload.customer.email || !payload.customer.phone)
    return alert("Complète nom, email et téléphone.");
  if (!payload.formation || !payload.totalPriceEUR)
    return alert("Choisis une formation.");

  try {
    const { url } = await createCheckoutSession(payload);
    window.location.href = url;
  } catch (err) {
    alert(err.message || "Erreur paiement Stripe");
  }
  });
});
