import { Link, type LinkProps } from 'react-router-dom';
import { useCallback } from 'react';
import { prefetchRoute } from '@/lib/prefetch';

/**
 * `<Link>` that starts loading the destination route's chunk on hover/focus,
 * so clicks feel instant. Non-string targets (relative `to` objects) skip it.
 */
export default function PrefetchLink({ to, onMouseEnter, onFocus, ...props }: LinkProps) {
  const handleEnter = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (typeof to === 'string') prefetchRoute(to);
      onMouseEnter?.(e);
    },
    [to, onMouseEnter],
  );
  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLAnchorElement>) => {
      if (typeof to === 'string') prefetchRoute(to);
      onFocus?.(e);
    },
    [to, onFocus],
  );
  return <Link to={to} onMouseEnter={handleEnter} onFocus={handleFocus} {...props} />;
}
