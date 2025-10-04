import React from "react";
import "./Badge.scss";

export interface BadgeProps {
  children: React.ReactNode;
}

export function Badge({ children }: BadgeProps) {
  return <div className="badge">{children}</div>;
}




