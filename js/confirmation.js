import { CONFIG } from "./config.js";
const API_BASE = CONFIG.API_BASE;

function qs(id) { return document.getElementById(id); }

function prettySlot(slot) {
  if (slot === "morning") return "Matin";
  if (slot === "afternoon") return "Après-midi";
  return slot || "—";
}

function statusLabel(status) {
  if (status === "paid") return "Paiement validé";
  if (status === "pending") return "Paiement en attente";
  if (status === "failed") return "Paiement refusé";
  if (status === "canceled") return "Paiement annulé";
  return status || "—";
}

// ✅ Stripe Option A : on récupère une "session" via /payments/session/:sessionId
async function fetchCheckoutSessionStatus(sessionId) {
  const res = await fetch(`${API_BASE}/payments/session/${encodeURIComponent(sessionId)}`);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || "Impossible de récupérer la confirmation");
    err.status = res.status;
    throw err;
  }
  return data;
}

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);

  // ✅ Stripe Checkout renvoie {CHECKOUT_SESSION_ID} si tu l’as mis dans success_url
  const sessionId = params.get("session_id");

  if (!sessionId) {
    qs("resStatus").textContent = "ID de session manquant";
    qs("debug").textContent =
      "Stripe n’a pas renvoyé session_id dans l’URL. Vérifie que success_url contient ?session_id={CHECKOUT_SESSION_ID}.";
    return;
  }

  try {
    const r = await fetchCheckoutSessionStatus(sessionId);

    // On essaie de supporter plusieurs formats possibles côté back
    // Format attendu (souvent) : { reservation: {...} } ou directement { ...reservationFields }
    const reservation = r.reservation || r;

    qs("resId").textContent = reservation.id ?? "—";
    qs("resStatus").textContent = statusLabel(reservation.status);

    qs("resDate").textContent = reservation.date ?? "—";
    qs("resSlot").textContent = prettySlot(reservation.slot);

    // meta peut être dans reservation.meta, ou directement dans r.meta selon ton implémentation
    const meta = reservation.meta || r.meta || {};
    qs("resFormation").textContent = meta.formation || "—";

    const c = meta.customer;
    qs("resCustomer").textContent = c ? `${c.name || ""} (${c.email || ""})` : "—";
  } catch (e) {
    qs("resStatus").textContent = "Impossible de confirmer";
    qs("debug").textContent = e.message || String(e);
  }
});
