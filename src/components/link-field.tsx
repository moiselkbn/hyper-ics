import { useState } from 'react';
import { copyText, LINK_COPIED } from '../data/share';
import './link-field.css';

type LinkFieldProps = {
  url: string;
  // Nom accessible du bouton « Copier ».
  label: string;
  // Légende affichée au-dessus du lien.
  caption?: string;
  copiedMessage?: string;
};

// Un lien affiché sans « https:// » (plus lisible), copié en entier, avec sa confirmation dessous.
export function LinkField({ url, label, caption, copiedMessage = LINK_COPIED }: LinkFieldProps) {
  const [message, setMessage] = useState('');
  return (
    <div className="link-field">
      {caption && <p className="link-field__caption">{caption}</p>}
      <div className="link-field__box">
        <span className="link-field__url">{url.replace(/^https?:\/\//, '')}</span>
        <button
          className="link-field__copy"
          type="button"
          aria-label={label}
          onClick={async () => setMessage(await copyText(url, copiedMessage))}
        >
          Copier
        </button>
      </div>
      <p className="link-field__status" role="status">
        {message}
      </p>
    </div>
  );
}
