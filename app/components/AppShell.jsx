import { Link, useLocation } from "react-router";

const NAV_ITEMS = [
  { href: "/app", label: "Home", icon: "home", exact: true },
  { href: "/app/reels", label: "Reels", icon: "video" },
  { href: "/app/upload", label: "Upload", icon: "upload" },
  { href: "/app/carousels", label: "Carousels", icon: "slideshow" },
  { href: "/app/analytics", label: "Analytics", icon: "chart-line" },
];

export default function AppShell({ children }) {
  const location = useLocation();

  return (
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="shell-brand">
          <div className="shell-brand-icon">
            <s-icon type="video" color="base" size="small" />
          </div>
          <div>
            <div className="shell-brand-title">Video Reels</div>
            <div className="shell-brand-subtitle">Carousel app</div>
          </div>
        </div>
        <nav className="shell-nav">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.href
              : location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`shell-nav-link${isActive ? " is-active" : ""}`}
              >
                <s-icon type={item.icon} size="small" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="shell-content">{children}</main>
    </div>
  );
}
