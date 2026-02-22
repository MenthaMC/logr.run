import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  onPress?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  isDisabled?: boolean;
  isLoading?: boolean;
  isIconOnly?: boolean;
  variant?: 'solid' | 'light' | 'bordered' | 'flat' | 'ghost' | string;
  color?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | string;
  size?: 'sm' | 'md' | 'lg' | string;
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'full' | string;
  fullWidth?: boolean;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function resolveVariantClass(variant: ButtonProps['variant'], color: ButtonProps['color']) {
  if (!variant && !color) return '';

  const normalizedVariant = variant ?? 'solid';
  const normalizedColor = color ?? 'default';

  if (normalizedVariant === 'light') {
    return 'bg-transparent text-inherit border border-transparent hover:bg-white/10';
  }

  if (normalizedVariant === 'bordered') {
    if (normalizedColor === 'primary') {
      return 'bg-transparent text-white border border-white/20 hover:bg-white/10';
    }
    return 'bg-transparent text-zinc-200 border border-white/15 hover:bg-white/10';
  }

  if (normalizedVariant === 'flat') {
    if (normalizedColor === 'primary') {
      return 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/20 hover:bg-emerald-500/25';
    }
    return 'bg-white/10 text-zinc-100 border border-white/10 hover:bg-white/15';
  }

  if (normalizedVariant === 'ghost') {
    return 'bg-transparent text-inherit border border-transparent hover:bg-white/5';
  }

  if (normalizedColor === 'primary') {
    return 'bg-white text-zinc-950 border border-white/25 hover:bg-zinc-200';
  }
  if (normalizedColor === 'success') {
    return 'bg-emerald-600 text-white border border-emerald-500 hover:bg-emerald-500';
  }
  if (normalizedColor === 'warning') {
    return 'bg-amber-500 text-zinc-950 border border-amber-400 hover:bg-amber-400';
  }
  if (normalizedColor === 'danger') {
    return 'bg-red-600 text-white border border-red-500 hover:bg-red-500';
  }
  return 'bg-zinc-100 text-zinc-950 border border-zinc-200 hover:bg-zinc-200';
}

function resolveSizeClass(size: ButtonProps['size']) {
  if (!size) return '';
  if (size === 'sm') return 'h-8 px-3 text-xs';
  if (size === 'lg') return 'h-12 px-5 text-base';
  return 'h-10 px-4 text-sm';
}

function resolveRadiusClass(radius: ButtonProps['radius']) {
  if (!radius) return '';
  if (radius === 'none') return 'rounded-none';
  if (radius === 'sm') return 'rounded-md';
  if (radius === 'lg') return 'rounded-xl';
  if (radius === 'full') return 'rounded-full';
  return '';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  props,
  ref,
) {
  const {
    onPress,
    onClick,
    isDisabled,
    isLoading,
    isIconOnly,
    variant,
    color,
    size,
    radius,
    fullWidth,
    startContent,
    endContent,
    disabled,
    onMouseEnter,
    onMouseLeave,
    onMouseDown,
    onMouseUp,
    onPointerDown,
    onPointerUp,
    onPointerLeave,
    onFocus,
    onBlur,
    onKeyDown,
    onKeyUp,
    type = 'button',
    className,
    children,
    ...rest
  } = props;

  const resolvedDisabled = disabled !== undefined ? disabled : isDisabled;
  const finalDisabled = Boolean(resolvedDisabled || isLoading);

  const [isHovered, setIsHovered] = React.useState(false);
  const [isPressed, setIsPressed] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [isFocusVisible, setIsFocusVisible] = React.useState(false);
  const keyboardFocusRef = React.useRef(false);

  const setActive = (next: boolean) => {
    if (!finalDisabled) {
      setIsPressed(next);
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (finalDisabled) {
      event.preventDefault();
      return;
    }

    if (typeof onClick === 'function') {
      onClick(event);
    }

    if (!event.defaultPrevented && typeof onPress === 'function') {
      onPress(event);
    }
  };

  const handleMouseEnter = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!finalDisabled) setIsHovered(true);
    if (typeof onMouseEnter === 'function') onMouseEnter(event);
  };

  const handleMouseLeave = (event: React.MouseEvent<HTMLButtonElement>) => {
    setIsHovered(false);
    setIsPressed(false);
    if (typeof onMouseLeave === 'function') onMouseLeave(event);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    keyboardFocusRef.current = false;
    setActive(true);
    if (typeof onMouseDown === 'function') onMouseDown(event);
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLButtonElement>) => {
    setActive(false);
    if (typeof onMouseUp === 'function') onMouseUp(event);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    keyboardFocusRef.current = false;
    setActive(true);
    if (typeof onPointerDown === 'function') onPointerDown(event);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    setActive(false);
    if (typeof onPointerUp === 'function') onPointerUp(event);
  };

  const handlePointerLeave = (event: React.PointerEvent<HTMLButtonElement>) => {
    setIsPressed(false);
    if (typeof onPointerLeave === 'function') onPointerLeave(event);
  };

  const handleFocus = (event: React.FocusEvent<HTMLButtonElement>) => {
    setIsFocused(true);
    setIsFocusVisible(keyboardFocusRef.current);
    if (typeof onFocus === 'function') onFocus(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLButtonElement>) => {
    setIsFocused(false);
    setIsFocusVisible(false);
    setIsPressed(false);
    if (typeof onBlur === 'function') onBlur(event);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    keyboardFocusRef.current = true;
    if (event.key === 'Enter' || event.key === ' ') setActive(true);
    if (typeof onKeyDown === 'function') onKeyDown(event);
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') setActive(false);
    if (typeof onKeyUp === 'function') onKeyUp(event);
  };

  const slotStart = isLoading ? (
    <span
      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
      aria-hidden="true"
    />
  ) : (
    startContent
  );

  const baseClassName = cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap align-middle select-none transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-50',
    isIconOnly ? 'p-0 aspect-square' : resolveSizeClass(size),
    resolveRadiusClass(radius),
    resolveVariantClass(variant, color),
    fullWidth && 'w-full',
  );

  return (
    <button
      ref={ref}
      type={type}
      className={cn(baseClassName, className)}
      disabled={finalDisabled}
      aria-busy={isLoading || undefined}
      data-hover={isHovered ? 'true' : 'false'}
      data-pressed={isPressed ? 'true' : 'false'}
      data-focus={isFocused ? 'true' : 'false'}
      data-focus-visible={isFocusVisible ? 'true' : 'false'}
      data-disabled={finalDisabled ? 'true' : 'false'}
      data-loading={isLoading ? 'true' : 'false'}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      {...rest}
    >
      {slotStart}
      {children}
      {!isLoading ? endContent : null}
    </button>
  );
});
