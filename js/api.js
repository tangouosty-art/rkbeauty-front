// js/api.js
import { CONFIG } from "./config.js";

// ---------- Helpers MOCK ----------
function mockAvailability(dateStr) {
  // Exemple simple: week-end plus chargé, et jour 15 matin complet
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0 dimanche, 6 samedi

  let morningRemaining = CONFIG.QUOTA_MAX_MORNING;
  let afternoonRemaining = CONFIG.QUOTA_MAX_AFTERNOON;

  if (day === 0 || day === 6) {
    morningRemaining = 2;
    afternoonRemaining = 3;
  }

  if (d.getDate() === 15) {
    morningRemaining = 0;
  }

  return {
    date: dateStr,
    morning: {
      max: CONFIG.QUOTA_MAX_MORNING,
      reserved: CONFIG.QUOTA_MAX_MORNING - morningRemaining,
      remaining: morningRemaining
    },
    afternoon: {
      max: CONFIG.QUOTA_MAX_AFTERNOON,
      reserved: CONFIG.QUOTA_MAX_AFTERNOON - afternoonRemaining,
      remaining: afternoonRemaining
    }
  };
}

// ---------- API publiques ----------
export async function getAvailability(dateStr) {
  if (CONFIG.USE_MOCK) {
    return mockAvailability(dateStr);
  }

  const res = await fetch(`${CONFIG.API_BASE}/availability?date=${encodeURIComponent(dateStr)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Erreur disponibilité");
  return data;
}

// Quand ton back sera prêt, tu utiliseras ça pour enregistrer en base
export async function createReservation(payload) {
  if (CONFIG.USE_MOCK) {
    // Simule un succès
    return { id: "MOCK-" + Date.now(), ok: true };
  }

  const res = await fetch(`${CONFIG.API_BASE}/reserve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Erreur réservation");
  return data;
}
