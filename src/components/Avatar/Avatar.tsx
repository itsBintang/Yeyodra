import { useMemo } from "react";
import "./Avatar.scss";

export interface AvatarProps {
  src?: string;
  alt?: string;
  size?: number;
  className?: string;
}

export function Avatar({ src, alt, size = 40, className = "" }: AvatarProps) {
  // Generate initials from alt text
  const initials = useMemo(() => {
    if (!alt) return "?";
    
    const words = alt.trim().split(" ");
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return alt.substring(0, 2).toUpperCase();
  }, [alt]);

  // Generate background color from name
  const backgroundColor = useMemo(() => {
    if (!alt) return "#2a2a2a";
    
    let hash = 0;
    for (let i = 0; i < alt.length; i++) {
      hash = alt.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = hash % 360;
    return `hsl(${hue}, 50%, 40%)`;
  }, [alt]);

  return (
    <div
      className={`avatar ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={alt || "Avatar"}
          className="avatar__image"
        />
      ) : (
        <div
          className="avatar__placeholder"
          style={{ backgroundColor }}
        >
          <span className="avatar__initials">{initials}</span>
        </div>
      )}
    </div>
  );
}
