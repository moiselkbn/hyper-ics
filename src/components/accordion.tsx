import type { ReactNode, Ref } from 'react';
import './accordion.css';

// Lignes dépliables de la page de l'élève, regroupées dans une même carte. Une seule ligne dépliée à la fois : les
// <details> d'un même groupe partagent leur `name`.
const GROUP_NAME = 'student-page-help';

export function AccordionGroup({ children }: { children: ReactNode }) {
  return <div className="accordion-group">{children}</div>;
}

type AccordionItemProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  // Pour déplier la ligne depuis ailleurs dans la page (« Réajouter mon calendrier »).
  ref?: Ref<HTMLDetailsElement>;
};

// Pas de flex sur <summary> lui-même (ignoré par d'anciens Safari) : la ligne est dans un <span>.
export function AccordionItem({ title, subtitle, children, ref }: AccordionItemProps) {
  return (
    <details className="accordion-item" name={GROUP_NAME} ref={ref}>
      <summary className="accordion-item__summary">
        <span className="accordion-item__head">
          <span className="accordion-item__titles">
            <span className="accordion-item__title">{title}</span>
            {subtitle && <span className="accordion-item__subtitle">{subtitle}</span>}
          </span>
          <span className="accordion-item__chevron" aria-hidden="true">
            ›
          </span>
        </span>
      </summary>
      <div className="accordion-item__body">{children}</div>
    </details>
  );
}
