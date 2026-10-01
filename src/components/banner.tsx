import './banner.css';

type BannerProps = {
  title: string;
  children: string;
};

// Confirmation en haut de la page de l'élève : calendrier créé, ou sélection modifiée.
export function Banner({ title, children }: BannerProps) {
  return (
    <div className="banner" role="status">
      <span className="banner__badge" aria-hidden="true">
        ✓
      </span>
      <div className="banner__text">
        <p className="banner__title">{title}</p>
        <p className="banner__message">{children}</p>
      </div>
    </div>
  );
}
