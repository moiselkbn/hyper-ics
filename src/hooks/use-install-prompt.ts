import { useEffect, useState } from 'react';

// Événement non standard (Chrome/Edge/Android) : disponible seulement si le manifest et les
// critères d'installabilité sont remplis, et consommable une seule fois.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type InstallPrompt = { kind: 'none' } | { kind: 'ios' } | { kind: 'prompt'; install: () => Promise<void> };

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

// Safari iOS n'expose pas beforeinstallprompt : seule une instruction manuelle est possible.
export function useInstallPrompt(): InstallPrompt {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  if (isStandalone()) return { kind: 'none' };

  if (deferredEvent) {
    return {
      kind: 'prompt',
      async install() {
        await deferredEvent.prompt();
        setDeferredEvent(null);
      },
    };
  }

  if (isIos()) return { kind: 'ios' };

  return { kind: 'none' };
}
