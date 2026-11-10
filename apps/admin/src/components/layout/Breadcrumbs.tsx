import { Link, useLocation } from 'react-router-dom';

function titleCase(segment: string): string {
  return segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length <= 1) return null;

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {segments.map((segment, index) => {
        const path = '/' + segments.slice(0, index + 1).join('/');
        const isLast = index === segments.length - 1;
        return (
          <span key={path}>
            {index > 0 && ' / '}
            {isLast ? <span aria-current="page">{titleCase(segment)}</span> : <Link to={path}>{titleCase(segment)}</Link>}
          </span>
        );
      })}
    </nav>
  );
}
