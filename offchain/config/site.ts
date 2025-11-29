export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "EquiBasket",
  description: "Trade Real-World Baskets. Instantly, On-Chain. Mint and trade synthetic equity baskets backed by ADA collateral.",
  navItems: [
    { label: "Dashboard", href: "/" },
    { label: "Create Basket", href: "/create" },
    { label: "Mint & Burn", href: "/mint-burn" },
    { label: "Trade", href: "/trade" },
  ],
  navMenuItems: [
    { label: "Dashboard", href: "/" },
    { label: "Create Basket", href: "/create" },
    { label: "Mint & Burn", href: "/mint-burn" },
    { label: "Trade", href: "/trade" },
  ],
  links: {
    github: "https://github.com/equibasket",
    docs: "/docs",
  },
};
