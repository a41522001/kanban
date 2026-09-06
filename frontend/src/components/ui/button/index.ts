import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';

export { default as Button } from './Button.vue';

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-bold transition-[background-color,border-color,color,box-shadow,opacity] duration-150 outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          'bg-action-primary text-content-on-dark hover:bg-action-primary-hover focus-visible:ring-action-primary/20',
        destructive:
          'bg-feedback-danger text-content-on-dark hover:bg-feedback-danger/90 focus-visible:ring-feedback-danger/20',
        outline:
          'border border-border bg-surface text-content-primary hover:bg-surface-subtle focus-visible:ring-action-primary/20',
        secondary:
          'bg-surface text-content-primary hover:bg-surface-subtle focus-visible:ring-action-primary/20',
        ghost: 'text-content-primary hover:bg-surface-subtle focus-visible:ring-action-primary/20',
        link: 'text-action-primary-hover underline-offset-4 hover:text-action-primary hover:underline',
      },
      size: {
        default: 'h-11 px-5 has-[>svg]:px-4',
        xs: "h-7 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-9 gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-12 px-6 has-[>svg]:px-5',
        icon: 'size-11',
        'icon-xs': "size-7 [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-9',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
export type ButtonVariants = VariantProps<typeof buttonVariants>;
