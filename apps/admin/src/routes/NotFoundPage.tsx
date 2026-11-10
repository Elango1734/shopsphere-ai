import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="state-panel">
      <h1>Page not found</h1>
      <Link to="/">Go home</Link>
    </div>
  );
}
