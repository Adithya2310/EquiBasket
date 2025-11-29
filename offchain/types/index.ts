import { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

// Re-export all types
export * from "./cardano";
export * from "./action";
export * from "./equibasket";
