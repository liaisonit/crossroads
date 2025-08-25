import React from 'react';
import { cn } from '@/lib/utils';

type LogoProps = {
  className?: string;
};

const Logo = ({ className }: LogoProps) => {
  return (
    <div className={cn("font-headline text-xl font-bold tracking-tight", className)}>
      <span>Cross</span>
      <span className="text-primary">roads</span>
    </div>
  );
};

export default Logo;
