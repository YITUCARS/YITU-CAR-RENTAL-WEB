import React from 'react';

const XiaohongshuRednoteIcon = ({
  size,
  color = '#000000',
  strokeWidth = 2,
  background = 'transparent',
  opacity = 1,
  rotation = 0,
  shadow = 0,
  flipHorizontal = false,
  flipVertical = false,
  padding = 0
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
  background?: string;
  opacity?: number;
  rotation?: number;
  shadow?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  padding?: number;
}) => {
  const transforms = [];
  if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
  if (flipHorizontal) transforms.push('scaleX(-1)');
  if (flipVertical) transforms.push('scaleY(-1)');

  const viewBoxSize = 48 + (padding * 2);
  const viewBoxOffset = -padding;
  const viewBox = `${viewBoxOffset} ${viewBoxOffset} ${viewBoxSize} ${viewBoxSize}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        opacity,
        transform: transforms.join(' ') || undefined,
        filter: shadow > 0 ? `drop-shadow(0 ${shadow}px ${shadow * 2}px rgba(0,0,0,0.3))` : undefined,
        backgroundColor: background !== 'transparent' ? background : undefined
      }}
    >
      <rect width="37" height="37" x="5.5" y="5.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" rx="4" ry="4"/><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M32.254 19.374v9.252m-5.781-7.776v7.776M24.95 20.85h3.047m-4.038 7.776h4.803m1.599-7.776h4.13c.49 0 .885.396.885.885v2.696"/><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" d="M29.815 24.43h7.194a.99.99 0 0 1 .99.991v2.214a.99.99 0 0 1-.99.99h-1.83m1.859-7.308l.962-.89m-16.316 8.199h-2.118m-2.378-6.655l.697 5.07m-7.202-5.07L10 27.3m3.922-7.926v7.892c0 .75-.609 1.36-1.36 1.36H12.2m9.484-9.252l-1.367 3.253h1.866l-1.367 3.252h1.865"/>
    </svg>
  );
};

export default XiaohongshuRednoteIcon;