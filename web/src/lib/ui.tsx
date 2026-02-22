import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  onPress?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  isDisabled?: boolean;
  isLoading?: boolean;
  isIconOnly?: boolean;
  variant?: string;
};

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

  return (
    <button
      ref={ref}
      type={type}
      className={className}
      disabled={finalDisabled}
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
      {children}
    </button>
  );
});
