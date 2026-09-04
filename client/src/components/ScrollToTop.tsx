import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Resets scroll to top on every navigation so pages don't open mid-way. */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}
