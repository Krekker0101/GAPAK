import React from 'react';

export default function Image(props: any) {
  const { src, alt, ...rest } = props;
  return <img src={src} alt={alt ?? ''} {...rest} />;
}
