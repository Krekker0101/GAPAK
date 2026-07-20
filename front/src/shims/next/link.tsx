import React from 'react';
import { Link as RouterLink } from 'react-router-dom';

export default function Link({ href, children, ...props }: any) {
  const to = typeof href === 'string' ? href : (href?.pathname ?? '/');
  return <RouterLink to={to} {...props}>{children}</RouterLink>;
}
