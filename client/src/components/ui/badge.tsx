import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border text-xs font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 whitespace-nowrap',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground border-border',
        success:
          'border-transparent bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30',
        warning:
          'border-transparent bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30',
        info: 'border-transparent bg-primary/10 text-primary border-primary/30',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs min-h-[20px] min-w-[60px]',
        sm: 'px-2 py-0.5 text-[10px] min-h-[18px] min-w-[50px]',
        lg: 'px-3 py-1 text-sm min-h-[24px] min-w-[70px]',
        xs: 'px-1.5 py-0.5 text-[9px] min-h-[16px] min-w-[40px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
