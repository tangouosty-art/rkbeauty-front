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

  const morningOpt = [...slotSelect.options].find(o => o.value === "morning");
  const afternoonOpt = [...slotSelect.options].find(o => o.value === "afternoon");

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
  const opt = formationSelect?.options?.[formationSelect.selectedIndex];

  const formation =
    document.getElementById("formation")?.value.trim() ||
    formationSelect?.value?.trim() ||
    "";

  const totalPriceEUR = opt?.dataset?.prix ? String(opt.dataset.prix) : "";
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

  formationSelect?.addEventListener("change", updateFormationFields);
  updateFormationFields();

  dateInput?.addEventListener("change", async () => {
    setSlotInfo("Chargement des disponibilités...");
    try {
      const av = await fetchAvailability(dateInput.value);
      applyAvailabilityToUI(av);
    } catch (e) {
      setSlotInfo(e.message, true);
    }
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = collectReservationData();

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
