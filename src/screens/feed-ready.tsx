import { useEffect, useState } from 'react';
import arrowUpRightUrl from '../assets/arrow-up-right.svg';
import checkBadgeUrl from '../assets/check-badge.svg';
import { AddToHomeScreen } from '../components/add-to-home-screen';
import { AppHeader } from '../components/app-header';
import { Button } from '../components/button';
import { CalendarAppTabs } from '../components/calendar-app-tabs';
import { DeleteSubscriptionModal } from '../components/delete-subscription-modal';
import { Stepper } from '../components/stepper';
import {
  detectCalendarApp,
  googleCalendarUrl,
  isAndroid,
  isAppleTouchDevice,
  isPhone,
  outlookUrl,
  webcalUrl,
  type CalendarApp,
} from '../data/subscription-links';
import './feed-ready.css';

// Ajout à la main, selon l'appareil Apple.
const APPLE_TOUCH_STEPS =
  'Vérifie que Calendrier a accès aux données cellulaires (Réglages → Données cellulaires → Calendrier), ou réessaie en Wi-Fi. Sinon, ajoute-le à la main : dans l’app Calendrier, touche « Calendriers », puis « Ajouter un calendrier » et « Ajouter un calendrier avec abonnement », et colle cette adresse :';
const APPLE_MAC_STEPS =
  'Ajoute-le à la main : dans Calendrier, menu « Fichier », puis « Nouvel abonnement à un calendrier… », et colle cette adresse :';
const GOOGLE_STEPS =
  'Sur calendar.google.com, depuis un ordinateur : « Autres agendas », « + », puis « À partir de l’URL », et colle cette adresse. S’il n’apparaît pas ensuite sur ton téléphone : appli Google Agenda, Paramètres, HyperICS, active « Synchroniser ».';
const OUTLOOK_STEPS =
  'Sur outlook.com, depuis un ordinateur : « Ajouter un calendrier », puis « S’abonner à partir du web », et colle cette adresse.';

// Sur Android, Chrome confie à l'appli Google Agenda tout lien vers calendar.google.com ouvert juste après un toucher
// (activation utilisateur, ~5 s) : l'appli demande « Ajouter l'agenda ? » mais n'ajoute rien. Passé ce délai, Chrome
// ouvre le site, qui abonne vraiment le compte (testé le 2026-09-30 sur émulateur, Chrome connecté à Google).
const GOOGLE_ANDROID_DELAY_SECONDS = 6;

const COPIED = 'Lien copié.';
const COPY_FAILED = 'Impossible de copier, sélectionne le lien à la main.';

async function copyText(text: string): Promise<string> {
  try {
    await navigator.clipboard.writeText(text);
    return COPIED;
  } catch {
    return COPY_FAILED;
  }
}

// Sur mobile, ouvre la feuille de partage native (Messages, Mail, WhatsApp…) ; sans support (la plupart
// des navigateurs desktop), on retombe sur la copie. Renvoie le message à afficher, ou '' si partagé ou annulé.
async function shareOrCopy(url: string): Promise<string> {
  if (!navigator.share) return copyText(url);
  try {
    await navigator.share({ url, title: 'Mon calendrier HyperICS' });
  } catch {
    // Annulé par l'élève : rien à faire.
  }
  return '';
}

// Le lien affiché sans « https:// » (plus lisible), copié en entier.
function LinkField({ url, label, onCopied }: { url: string; label: string; onCopied: (message: string) => void }) {
  return (
    <div className="feed-ready__link-field">
      <span className="feed-ready__link-url">{url.replace(/^https?:\/\//, '')}</span>
      <button className="feed-ready__copy" type="button" onClick={async () => onCopied(await copyText(url))} aria-label={label}>
        <span className="feed-ready__copy-icon" aria-hidden="true" />
      </button>
    </div>
  );
}

function Status({ message }: { message: string }) {
  return (
    <p className={message ? 'feed-ready__status feed-ready__status--visible' : 'feed-ready__status'} role="status">
      {message}
    </p>
  );
}

function AddButton({ children, onClick, disabled }: { children: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Button className="feed-ready__add" onClick={onClick} disabled={disabled}>
      {children}
      <img className="feed-ready__add-icon" src={arrowUpRightUrl} alt="" width={13} height={13} />
    </Button>
  );
}

// Adresse du flux à coller à la main, quand le bouton ne convient pas.
function ManualSubscription({ summary, steps, feedUrl }: { summary: string; steps: string; feedUrl: string }) {
  const [message, setMessage] = useState('');
  return (
    <details className="feed-ready__help">
      <summary className="feed-ready__help-summary">{summary}</summary>
      <div className="feed-ready__help-body">
        <p className="feed-ready__hint">{steps}</p>
        <LinkField url={feedUrl} label="Copier l’adresse du calendrier" onCopied={setMessage} />
        <Status message={message} />
      </div>
    </details>
  );
}

function SendLinkButton({ pageUrl }: { pageUrl: string }) {
  const [message, setMessage] = useState('');
  return (
    <>
      <Button onClick={async () => setMessage(await shareOrCopy(pageUrl))}>Envoyer le lien vers mon ordinateur</Button>
      <Status message={message} />
    </>
  );
}

// Outlook (et Google Agenda sur iPhone) n'acceptent un abonnement par adresse que sur leur site, depuis un ordinateur :
// sur un téléphone, on propose d'envoyer le lien de cette page vers un ordinateur.
function SendToComputer({ appName, tabLabel, pageUrl }: { appName: string; tabLabel: string; pageUrl: string }) {
  return (
    <>
      <p className="feed-ready__hint">
        {appName} ne permet d’ajouter un calendrier que depuis un ordinateur. Envoie-toi ce lien, ouvre-le sur un
        ordinateur et choisis l’onglet <strong>{tabLabel}</strong> : tes cours apparaîtront ensuite tout seuls sur ton
        téléphone.
      </p>
      <SendLinkButton pageUrl={pageUrl} />
    </>
  );
}

// Android : ouvre le site de Google Agenda dans l'onglet, après un compte à rebours (voir GOOGLE_ANDROID_DELAY_SECONDS).
function GoogleAndroidButton({ url }: { url: string }) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft === 0) {
      window.location.href = url;
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft, url]);

  // Retour depuis Google Agenda : la page ressort du cache avec le compte à rebours fini, on réarme le bouton.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setSecondsLeft(null);
    };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  if (secondsLeft === null) {
    return (
      <AddButton onClick={() => setSecondsLeft(GOOGLE_ANDROID_DELAY_SECONDS)}>Ajouter à Google Agenda</AddButton>
    );
  }
  return (
    <AddButton onClick={() => {}} disabled>
      {secondsLeft > 0 ? `Ouverture dans ${secondsLeft} s…` : 'Ouverture…'}
    </AddButton>
  );
}

type FeedReadyProps = {
  pageUrl: string;
  feedUrl: string;
  // Page de l'élève : modifier ses cours.
  onEdit?: () => void;
  // Sélection tout juste modifiée depuis la page de l'élève.
  updated?: boolean;
  // Page de l'élève : supprimer son calendrier, après confirmation.
  onDelete?: () => Promise<void>;
};

// Dernier écran : l'abonnement est prêt, l'élève l'ajoute à son calendrier.
// Le flux se met à jour tout seul : c'est un abonnement, jamais un fichier importé une fois pour toutes.
export function FeedReady({ pageUrl, feedUrl, onEdit, updated = false, onDelete }: FeedReadyProps) {
  const [app, setApp] = useState<CalendarApp>(() => detectCalendarApp());
  const [keepMessage, setKeepMessage] = useState('');
  // Après une modification, l'ajout au calendrier est replié : l'élève l'a normalement déjà fait, et l'ajouter une
  // seconde fois doublerait ses cours. Il reste accessible pour celui qui ne l'avait pas encore fait.
  const [addRevealed, setAddRevealed] = useState(false);
  const showAdd = !updated || addRevealed;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const phone = isPhone();
  const android = isAndroid();
  // Sur un téléphone, le lien direct vers Google Agenda (sauf Android) ou Outlook ne marche pas : la marche à suivre
  // devient l'action principale.
  const webSummary = phone ? 'Ou ajoute-le à la main' : 'Le bouton ne marche pas ?';

  // Apple Calendar (iPhone, iPad, Mac) s'ouvre sur l'abonnement ; Google et Outlook dans un nouvel onglet.
  const addToAppleCalendar = () => {
    window.location.href = webcalUrl(feedUrl);
  };
  const openInNewTab = (url: string) => window.open(url, '_blank', 'noopener');

  return (
    <div className="feed-ready">
      <AppHeader onEdit={onEdit} />
      <Stepper total={4} current={4} />

      <h1 className="feed-ready__title">
        <img src={checkBadgeUrl} alt="" width={28} height={28} />
        {updated ? 'C’est à jour !' : 'C’est prêt !'}
      </h1>

      {updated && (
        <p className="feed-ready__updated">
          Rien à refaire : ton calendrier se met à jour tout seul. Selon ton application, ça peut prendre jusqu’à 24 h.
        </p>
      )}

      {!showAdd && (
        <button className="feed-ready__reveal" type="button" onClick={() => setAddRevealed(true)}>
          Tu ne l’as pas encore ajouté à ton calendrier ?
        </button>
      )}

      {showAdd && (
        <>
          <CalendarAppTabs value={app} onChange={setApp} />

          {app === 'apple' && (
            <div className="feed-ready__panel">
              <AddButton onClick={addToAppleCalendar}>Ajouter à Apple Calendar</AddButton>
              <p className="feed-ready__hint">
                Ajoute-le une seule fois : avec iCloud, il apparaît aussi sur tes autres appareils Apple.
              </p>
              <ManualSubscription
                summary="Le bouton ne marche pas ?"
                steps={isAppleTouchDevice() ? APPLE_TOUCH_STEPS : APPLE_MAC_STEPS}
                feedUrl={feedUrl}
              />
            </div>
          )}

          {app === 'google' && android && (
            <div className="feed-ready__panel">
              <GoogleAndroidButton url={googleCalendarUrl(feedUrl)} />
              <p className="feed-ready__hint">
                Google Agenda s’ouvre dans Chrome après quelques secondes : ne touche à rien en attendant, puis confirme
                l’ajout. Ensuite, dans l’appli Google Agenda : Paramètres, HyperICS, active « Synchroniser ».
              </p>
              <p className="feed-ready__hint">Google Agenda peut mettre jusqu’à 24 h à afficher un changement de cours.</p>
              <details className="feed-ready__help">
                <summary className="feed-ready__help-summary">Le bouton ne marche pas ?</summary>
                <div className="feed-ready__help-body">
                  <p className="feed-ready__hint">
                    Si Google t’a demandé de te connecter puis a ouvert l’appli Agenda : reviens dans Chrome et recharge
                    la page. Sinon, envoie-toi ce lien, ouvre-le sur un ordinateur et choisis l’onglet{' '}
                    <strong>Google</strong>.
                  </p>
                  <SendLinkButton pageUrl={pageUrl} />
                </div>
              </details>
            </div>
          )}

          {app === 'google' && !android && (
            <div className="feed-ready__panel">
              {phone ? (
                <SendToComputer appName="Google Agenda" tabLabel="Google" pageUrl={pageUrl} />
              ) : (
                <AddButton onClick={() => openInNewTab(googleCalendarUrl(feedUrl))}>Ajouter à Google Agenda</AddButton>
              )}
              <p className="feed-ready__hint">Google Agenda peut mettre jusqu’à 24 h à afficher un changement de cours.</p>
              <ManualSubscription summary={webSummary} steps={GOOGLE_STEPS} feedUrl={feedUrl} />
            </div>
          )}

          {app === 'outlook' && (
            <div className="feed-ready__panel">
              {phone ? (
                <SendToComputer appName="Outlook" tabLabel="Outlook" pageUrl={pageUrl} />
              ) : (
                <AddButton onClick={() => openInNewTab(outlookUrl(feedUrl))}>Ajouter à Outlook</AddButton>
              )}
              <ManualSubscription summary={webSummary} steps={OUTLOOK_STEPS} feedUrl={feedUrl} />
            </div>
          )}
        </>
      )}

      <div className="feed-ready__keep">
        <p className="feed-ready__keep-title">Ne perds pas cette page</p>
        <p className="feed-ready__keep-text">
          Ce lien unique est ta seule façon de revenir ici pour changer tes cours plus
          tard. Si tu le perds, il faudra tout recommencer.</p>
          <p className="feed-ready__keep-text">Conseil : <strong>pense à l'ajouter dans ton écran d'accueil </strong>ou tes favoris pour y accéder facilement.</p>

        <LinkField url={pageUrl} label="Copier le lien de cette page" onCopied={setKeepMessage} />
        <Status message={keepMessage} />

        <div className="feed-ready__keep-actions">
          <Button onClick={async () => setKeepMessage(await shareOrCopy(pageUrl))}>Partager le lien</Button>
          <AddToHomeScreen />
        </div>
      </div>

      {/* Tout en bas, hors du chemin : on ne doit pas tomber dessus par erreur. */}
      {onDelete && (
        <button className="feed-ready__delete" type="button" onClick={() => setConfirmingDelete(true)}>
          Supprimer mon calendrier
        </button>
      )}
      {onDelete && confirmingDelete && (
        <DeleteSubscriptionModal onConfirm={onDelete} onClose={() => setConfirmingDelete(false)} />
      )}
    </div>
  );
}
