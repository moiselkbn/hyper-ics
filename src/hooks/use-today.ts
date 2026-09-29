import { useEffect, useState } from 'react';

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Date du jour (à minuit, heure locale), renouvelée au passage de minuit et au retour sur l'onglet.
export function useToday(): Date {
  const [today, setToday] = useState(startOfToday);

  useEffect(() => {
    function refresh() {
      const next = startOfToday();
      if (next.getTime() !== today.getTime()) setToday(next);
    }

    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    // Un minuteur en arrière-plan peut être retardé : visibilitychange rattrape le changement de jour.
    const timer = window.setTimeout(refresh, tomorrow.getTime() - Date.now());
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [today]);

  return today;
}
