import React from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  className = "",
  style,
  ...props
}) => {
  // Styles aligned with UrbanIQ's dark navy & vibrant blue design system
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    borderRadius: "8px",
    transition: "all 0.15s ease-in-out",
    cursor: disabled || isLoading ? "not-allowed" : "pointer",
    opacity: disabled || isLoading ? 0.6 : 1,
    border: "1px solid transparent",
    gap: "8px",
    fontFamily: "inherit",
    textDecoration: "none",
  };

  const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
    sm: { padding: "6px 12px", fontSize: "13px" },
    md: { padding: "10px 18px", fontSize: "14px" },
    lg: { padding: "14px 24px", fontSize: "16px" },
  };

  const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      backgroundColor: "#2563eb",
      color: "#ffffff",
      boxShadow: "0 1px 3px rgba(37, 99, 235, 0.2)",
    },
    secondary: {
      backgroundColor: "#0f172a",
      color: "#ffffff",
      boxShadow: "0 1px 3px rgba(15, 23, 42, 0.2)",
    },
    outline: {
      backgroundColor: "transparent",
      color: "#1e293b",
      borderColor: "#cbd5e1",
    },
    ghost: {
      backgroundColor: "transparent",
      color: "#475569",
    },
  };

  return (
    <button
      style={{
        ...baseStyle,
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
      disabled={disabled || isLoading}
      className={`urbaniq-btn ${className}`}
      {...props}
    >
      {isLoading ? (
        <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span>
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};

export default Button;
