import { Icon } from "@iconify/react";

export const ICON_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface Props {
  code: string;
  className?: string;
  size?: number | string;
}

export default function DynamicIcon({ code, className, size = "1em" }: Props) {
  if (!ICON_CODE_PATTERN.test(code)) {
    return <span className={className} aria-hidden="true">?</span>;
  }
  return <Icon className={className} icon={code} width={size} height={size} aria-hidden="true" />;
}
