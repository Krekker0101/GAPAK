import React from 'react';

export default function NotFoundPage() {
  return (
    <div className="p-8 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">The page you requested does not exist.</p>
    </div>
  );
}
