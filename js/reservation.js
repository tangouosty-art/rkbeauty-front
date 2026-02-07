import { CONFIG } from "./config.js";
const API_BASE = CONFIG.API_BASE;

// ---------------- API helpers ----------------
async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) throw new Error(data?.message || `Erreur HTTP ${res.status}`);
  return data;
}

async function apiPost(path, payload) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Erreur");
  return data;
}

function fmtDateFR(yyyyMMdd) {
  const [y, m, d] = String(yyyyMMdd).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function setHelp(msg, ok = true) {
  const el = document.getElementById("session-help");
  if (!el) return;
  el.textContent = msg || "";
  el.style.color = ok ? "" : "crimson";
}

// ---------------- DOM ----------------
const formationSelect = document.getElementById("formation-select");
const sessionSelect = document.getElementById("session-select");

const slotSelect = document.getElementById("slot");
const slotInfo = document.getElementById("slotInfo");
const payBtn = document.getElementById("payBtn");

// ---------------- UI helpers ----------------
function setPayEnabled(enabled) {
  if (payBtn) payBtn.disabled = !enabled;
}

function setSlotInfo(text, isError = false) {
  if (!slotInfo) return;
  slotInfo.textContent = text || "";
  slotInfo.style.color = isError ? "crimson" : "";
}

function resetSlots() {
  if (!slotSelect) return;
  const optMorning = slotSelect.querySelector('option[value="morning"]');
  const optAfternoon = slotSelect.querySelector('option[value="afternoon"]');

  if (optMorning) optMorning.disabled = false;
  if (optAfternoon) optAfternoon.disabled = false;

  slotSelect.value = "";
  setPayEnabled(false);
  setSlotInfo("");
}

function applySlotPolicy(slotPolicy) {
  if (!slotSelect) return;

  const optMorning = slotSelect.querySelector('option[value="morning"]');
  const optAfternoon = slotSelect.querySelector('option[value="afternoon"]');

  // reset
  if (optMorning) optMorning.disabled = false;
  if (optAfternoon) optAfternoon.disabled = false;

  if (slotPolicy === "morning") {
    if (optAfternoon) optAfternoon.disabled = true;
    slotSelect.value = "morning";
    setPayEnabled(true);
    return;
  }

  if (slotPolicy === "afternoon") {
    if (optMorning) optMorning.disabled = true;
    slotSelect.value = "afternoon";
    setPayEnabled(true);
    return;
  }

  // both
  if (!["morning", "afternoon"].includes(slotSelect.value)) slotSelect.value = "";
  setPayEnabled(false);
}

// ---------------- FORMATION fields ----------------
function updateFormationFields() {
  const formationInput = document.getElementById("formation");
  const prixInput = document.getElementById("prix");
  if (!formationSelect || !formationInput || !prixInput) return;

  const opt = formationSelect.options[formationSelect.selectedIndex];
  const code = formationSelect.value || "";
  const price = opt?.dataset?.prix ? String(opt.dataset.prix) : "";

  formationInput.value = code;
  prixInput.value = price ? `${price}€` : "0€";
}

// ---------------- Sessions loading ----------------
async function loadSessionsForFormationCode(code) {
  if (!sessionSelect) return;

  sessionSelect.innerHTML = `<option value="">Chargement...</option>`;
  setHelp("");
  resetSlots();
  setSlotInfo("");

  if (!code) {
    sessionSelect.innerHTML = `<option value="">— Sélectionnez une formation d’abord —</option>`;
    return;
  }

  const sessions = await apiGet(`/formation-sessions?formation_code=${encodeURIComponent(code)}`);

  if (!Array.isArray(sessions) || sessions.length === 0) {
    sessionSelect.innerHTML = `<option value="">Aucune session disponible</option>`;
    setHelp(
      "La session de cette formation n’est pas encore disponible. Sélectionnez une autre formation.",
      false
    );
    return;
  }

  sessionSelect.innerHTML =
    `<option value="">— Choisir une date —</option>` +
    sessions
      .map((s) => {
        const label = `${fmtDateFR(s.start_date)} (${s.remaining} place(s) restante(s))`;
        return `
          <option
            value="${s.id}"
            data-start="${s.start_date}"
            data-slot-policy="${s.slot_policy}"
            data-remaining="${s.remaining}"
          >${label}</option>
        `;
      })
      .join("");

  setHelp("Choisis une date proposée par RKbeauty (session).");
}

// ---------------- Events ----------------
formationSelect?.addEventListener("change", async () => {
  updateFormationFields();
  try {
    await loadSessionsForFormationCode(formationSelect.value);
  } catch (e) {
    console.error(e);
    setHelp(e.message || "Erreur chargement sessions", false);
  }
});

sessionSelect?.addEventListener("change", () => {
  resetSlots();

  const opt = sessionSelect.options[sessionSelect.selectedIndex];
  const policy = opt?.dataset?.slotPolicy || "both";
  const remaining = opt?.dataset?.remaining;

  if (!sessionSelect.value) {
    setSlotInfo("");
    setPayEnabled(false);
    return;
  }

  applySlotPolicy(policy);

  if (remaining != null) {
    setSlotInfo(`Places restantes pour cette session : ${remaining}`);
  }
});

slotSelect?.addEventListener("change", () => {
  const v = slotSelect.value;

  // empêche de choisir option disabled
  const opt = slotSelect.querySelector(`option[value="${v}"]`);
  if (!v || opt?.disabled) {
    slotSelect.value = "";
    setPayEnabled(false);
    setSlotInfo("Ce créneau n'est pas disponible.", true);
    return;
  }

  setPayEnabled(true);
});

// ---------------- Collect + submit ----------------
function collectReservationPayload() {
  const name = document.getElementById("nom")?.value.trim();
  const email = document.getElementById("email")?.value.trim();
  const phone = document.getElementById("telephone")?.value.trim();

  const formationCode = formationSelect?.value?.trim() || "";
  const opt = formationSelect?.options?.[formationSelect.selectedIndex];

  const formationLabel = opt?.textContent?.trim() || formationCode;
  const totalPriceEUR = opt?.dataset?.prix
    ? String(opt.dataset.prix)
    : (document.getElementById("prix")?.value || "").replace("€", "").replace(",", ".").trim();

  const slot = slotSelect?.value || "";
  const sessionId = Number(sessionSelect?.value);

  const message = document.getElementById("message")?.value?.trim() || "";

  return {
    formation_session_id: sessionId,
    slot,
    customer: { name, email, phone },
    formation: formationLabel,
    totalPriceEUR,
    message,
  };
}

document.addEventListener("DOMContentLoaded", () => {
  updateFormationFields();
  resetSlots();

  const form = document.getElementById("reservationForm");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const cgv = document.getElementById("acceptCGV");
    if (!cgv?.checked) {
      alert("Vous devez accepter les Conditions Générales de Vente avant de payer.");
      return;
    }

    const payload = collectReservationPayload();

    if (!Number.isFinite(payload.formation_session_id)) {
      alert("Choisis une date de session.");
      return;
    }
    if (!payload.slot) {
      alert("Choisis un créneau.");
      return;
    }
    if (!payload.customer.name || !payload.customer.email || !payload.customer.phone) {
      alert("Complète nom, email et téléphone.");
      return;
    }
    if (!payload.formation || !payload.totalPriceEUR) {
      alert("Choisis une formation.");
      return;
    }

    try {
      const { url } = await apiPost("/payments/create-checkout-session", payload);
      window.location.href = url;
    } catch (err) {
      alert(err.message || "Erreur paiement Stripe");
    }
  });
});


const modal = document.getElementById("legalModal");
const iframe = document.getElementById("legalIframe");
const title = document.getElementById("legalModalTitle");

function openLegal(titleText, file) {
  title.textContent = titleText;
  iframe.src = file;
  modal.setAttribute("aria-hidden", "false");
  modal.style.display = "flex";
}

function closeLegal() {
  modal.setAttribute("aria-hidden", "true");
  modal.style.display = "none";
  iframe.src = "";
}

document.getElementById("openCGV")?.addEventListener("click", () => {
  openLegal("Conditions Générales de Vente", "cgv.html");
});

document.getElementById("openMentions")?.addEventListener("click", () => {
  openLegal("Mentions légales", "mentions-legales.html");
});

document.getElementById("openPrivacy")?.addEventListener("click", () => {
  openLegal("Politique de confidentialité", "politique-confidentialite.html");
});

document.querySelectorAll("[data-close-legal]").forEach(el => {
  el.addEventListener("click", closeLegal);
});

