import { useState } from 'react';
import { reportBug } from '../api/client';
import { Button } from './button';
import './bug-report-modal.css';

const MAX_LENGTH = 2000;

type BugReportModalProps = {
  onClose: () => void;
};

export function BugReportModal({ onClose }: BugReportModalProps) {
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function submit() {
    setStatus('sending');
    try {
      await reportBug(description, new AbortController().signal);
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="bug-report-modal" role="dialog" aria-modal="true">
      <div className="bug-report-modal__panel">
        {status === 'sent' ? (
          <>
            <p className="bug-report-modal__message">Merci, ton signalement a bien été envoyé.</p>
            <Button onClick={onClose}>Fermer</Button>
          </>
        ) : (
          <>
            <p className="bug-report-modal__title">Signaler un bug</p>
            <textarea
              className="bug-report-modal__textarea"
              value={description}
              maxLength={MAX_LENGTH}
              placeholder="Décris ce qui ne fonctionne pas…"
              onChange={(event) => setDescription(event.target.value)}
            />
            {status === 'error' && (
              <p className="bug-report-modal__error" role="alert">
                Échec de l’envoi. Réessaie.
              </p>
            )}
            <div className="bug-report-modal__actions">
              <button type="button" className="bug-report-modal__cancel" onClick={onClose}>
                Annuler
              </button>
              <Button
                variant="accent"
                className="bug-report-modal__submit"
                onClick={submit}
                disabled={description.trim().length === 0 || status === 'sending'}
              >
                {status === 'sending' ? 'Envoi…' : 'Envoyer'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
