import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  footer?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  action,
  footer,
  className = "",
  style,
  ...props
}) => {
  const cardStyle: React.CSSProperties = {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    ...style,
  };

  const headerStyle: React.CSSProperties = {
    padding: "18px 22px 14px 22px",
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  };

  const bodyStyle: React.CSSProperties = {
    padding: "20px 22px",
    flex: 1,
  };

  const footerStyle: React.CSSProperties = {
    padding: "12px 22px",
    backgroundColor: "#f8fafc",
    borderTop: "1px solid #f1f5f9",
  };

  return (
    <div style={cardStyle} className={`urbaniq-card ${className}`} {...props}>
      {(title || subtitle || action) && (
        <div style={headerStyle}>
          <div>
            {title && (
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#0f172a" }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                {subtitle}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div style={bodyStyle}>{children}</div>
      {footer && <div style={footerStyle}>{footer}</div>}
    </div>
  );
};

export default Card;
