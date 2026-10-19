// Routes that render their own full-screen sidebar+topbar shell (dashboard,
// team, ...) instead of the public marketing site's chrome. Navbar /
// Footer / AnnouncementBar each check this so a page that opts into an
// app-shell layout doesn't get the public header/footer stacked on top
// of it. Add a route here the moment — and only once — it actually gets
// its own <BusinessSidebar> (or equivalent); adding it too early leaves
// that page with no navigation at all, and forgetting it entirely is
// exactly what caused the double-navbar bug on /team.
export const FULL_SCREEN_APP_ROUTES = ['/dashboard', '/team']

// Whole sections that bring their own shell (every /admin/... page is rendered
// inside app/admin/layout.tsx, which has its own sidebar, topbar and mobile nav).
const FULL_SCREEN_APP_PREFIXES = ['/admin', '/app']

export function isFullScreenAppRoute(pathname: string | null): boolean {
  if (!pathname) return false
  if (FULL_SCREEN_APP_ROUTES.includes(pathname)) return true
  return FULL_SCREEN_APP_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}
