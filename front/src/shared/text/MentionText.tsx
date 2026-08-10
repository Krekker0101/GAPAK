import React from 'react';
import { Link } from 'react-router-dom';

const TOKEN = /(@[A-Za-z0-9_.$-]{2,64})/g;

/** Renders user text without HTML injection. Mentions become real profile links. */
export const MentionText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const parts = text.split(TOKEN);
  return <>{parts.map((part, index) => part.startsWith('@') ? <Link key={`${part}-${index}`} to={`/@${encodeURIComponent(part.slice(1))}`} className={className ?? 'font-semibold text-indigo-500 hover:underline'}>{part}</Link> : <React.Fragment key={index}>{part}</React.Fragment>)}</>;
};
