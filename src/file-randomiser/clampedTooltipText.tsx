import { Text, Tooltip } from "@mantine/core";
import { useRef, useState, useEffect } from "react";

interface ClampedTooltipTextProps {
  children: string;
  size?: string;
  fw?: number;
  c?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

const ClampedTooltipText = ({
  children,
  size,
  fw,
  c,
  style,
  onClick,
}: ClampedTooltipTextProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setIsOverflowing(el.scrollWidth > el.clientWidth);
  }, [children]);

  const text = (
    <Text
      ref={ref}
      size={size}
      fw={fw}
      c={c}
      style={{
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        ...style,
      }}
      onClick={onClick}
    >
      {children}
    </Text>
  );

  if (isOverflowing) {
    return (
      <Tooltip
        label={children}
        position="bottom-start"
        styles={(theme) => ({
          tooltip: {
            fontSize: theme.fontSizes.xs, // smaller text
          },
        })}
      >
        {text}
      </Tooltip>
    );
  }

  return text;
};

export default ClampedTooltipText;
