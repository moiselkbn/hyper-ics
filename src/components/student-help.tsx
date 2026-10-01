import { useState } from 'react';
import { detectCalendarApp, type CalendarApp } from '../data/subscription-links';
import { unsubscribeSteps } from '../data/unsubscribe-steps';
import { CalendarAppTabs } from './calendar-app-tabs';
import './student-help.css';

// Hyperplanning de l'HEFF en accès invité, d'où viennent les cours.
const HYPERPLANNING_URL = 'https://heffpm.hyperplanning.fr/hp/invite';

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="student-help__bullets">
      {items.map((item) => (
        <li key={item} className="student-help__bullet">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function GoodToKnow() {
  return (
    <>
      <Bullets
        items={[
          'Tes cours sont vérifiés toutes les heures, de 7h à 17h. Rien n’est mis à jour après 17h.',
          'Google Agenda peut mettre jusqu’à 24 h à afficher un changement.',
          'Les mémos d’Hyperplanning ne sont pas repris.',
          'En cas de doute, Hyperplanning fait foi.',
        ]}
      />
      <a className="student-help__link" href={HYPERPLANNING_URL} target="_blank" rel="noopener noreferrer">
        Ouvrir Hyperplanning ↗
      </a>
    </>
  );
}

// Doit rester exact : c'est l'engagement de transparence envers les élèves (voir server/subscription.mjs pour la
// sélection et ses dates, server/feed-reads.mjs pour les synchros, api/feed.mjs pour la ligne de log). Les journaux
// de requêtes de Vercel gardent l'adresse appelée, donc le jeton du flux (vérifié le 2026-10-01) : l'application de
// calendrier ne peut lire le flux qu'avec le lien complet.
export function YourData() {
  return (
    <div className="student-help__sections">
      <section className="student-help__section">
        <h3 className="student-help__heading">Ce qu’on garde</h3>
        <Bullets
          items={[
            'Tes promotions et les cours que tu as cochés.',
            'Les dates de création et de dernière modification.',
            'Les dates de première et de dernière synchro, et le nom de ton application.',
          ]}
        />
      </section>
      <section className="student-help__section">
        <h3 className="student-help__heading">Ce qu’on ne garde jamais</h3>
        <Bullets
          items={[
            'Ton nom, ton adresse mail, ton identifiant Hyperplanning.',
            'Ton lien : en base, seulement une empreinte, qui ne permet pas de le retrouver.',
          ]}
        />
      </section>
      <section className="student-help__section">
        <h3 className="student-help__heading">À savoir aussi</h3>
        <Bullets
          items={[
            'Données stockées en Europe (Francfort).',
            'Chaque fois que ton application relit ton calendrier, une ligne technique est notée : le nom et la version de ton application.',
            'L’hébergeur (Vercel) garde aussi, pendant une durée limitée, l’adresse appelée, qui contient ton lien.',
            'Les cours viennent de la page publique d’Hyperplanning de l’HEFF. HyperICS n’est pas un service officiel de l’HEFF.',
          ]}
        />
      </section>
      <p className="student-help__note">Pour tout effacer : « Supprimer mon calendrier », en bas de la page.</p>
    </div>
  );
}

const QUESTIONS: [string, string][] = [
  ['Un cours manque ou est en trop ?', '« Modifier mes cours ».'],
  ['Je suis des cours de deux années ?', '« Modifier mes cours », puis ajoute une seconde promotion.'],
  [
    'Mes cours apparaissent en double ?',
    'Tu as ajouté le calendrier deux fois : retire l’un des deux (voir « Retirer HyperICS de mon application »).',
  ],
  [
    'Un changement n’apparaît pas ?',
    'Ton application peut mettre jusqu’à 24 h (Google), et rien n’est mis à jour après 17h. Sur iPhone, vérifie que Calendrier a accès aux données cellulaires.',
  ],
  [
    'Je change de téléphone ?',
    'Avec iCloud ou ton compte Google, rien à faire. Sinon, rouvre ce lien sur le nouveau téléphone.',
  ],
  [
    'J’ai perdu mon lien ?',
    'Impossible de le retrouver : crée un nouveau calendrier, et retire l’ancien de ton application.',
  ],
  ['Une salle ou un horaire est faux ?', 'Vérifie sur Hyperplanning, puis « Signaler un bug ».'],
];

export function Faq() {
  return (
    <dl className="student-help__faq">
      {QUESTIONS.map(([question, answer]) => (
        <div key={question} className="student-help__qa">
          <dt className="student-help__question">{question}</dt>
          <dd className="student-help__answer">{answer}</dd>
        </div>
      ))}
    </dl>
  );
}

// Retirer l'abonnement de l'application garde la sélection ; « Supprimer mon calendrier » efface tout.
export function RemoveFromApp() {
  const [app, setApp] = useState<CalendarApp>(() => detectCalendarApp());
  return (
    <div className="student-help__sections">
      <p className="student-help__intro">
        Ça retire tes cours de ton application, mais garde ta sélection ici : tu pourras le rajouter. Pour tout effacer,
        utilise « Supprimer mon calendrier ».
      </p>
      <CalendarAppTabs value={app} onChange={setApp} />
      <p className="student-help__steps">{unsubscribeSteps(app)}</p>
    </div>
  );
}
