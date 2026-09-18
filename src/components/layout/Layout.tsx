import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: '首页', icon: '🏠' },
  { to: '/add', label: '录单词', icon: '➕' },
  { to: '/review', label: '回顾', icon: '🔁' },
  { to: '/library', label: '单词库', icon: '📚' },
  { to: '/practice', label: '刷题', icon: '🎯' },
  { to: '/curve', label: '记忆曲线', icon: '📈' },
  { to: '/settings', label: '设置', icon: '⚙️' },
];

const COLLAPSE_KEY = 'wordapp-sidebar-collapsed';

function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="sidebar-scroll flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
          title={collapsed ? item.label : undefined}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
              collapsed ? 'justify-center px-0' : ''
            } ${
              isActive
                ? 'bg-brand-600 font-semibold text-white shadow-sm'
                : 'text-slate-600 hover:bg-brand-100/80 hover:text-brand-800'
            }`
          }
        >
          <span className="text-lg leading-none">{item.icon}</span>
          {!collapsed && <span className="truncate font-medium">{item.label}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

function BrandBlock({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <NavLink
      to="/"
      onClick={onNavigate}
      className={`flex h-16 shrink-0 items-center gap-2 border-b border-brand-200/70 ${
        collapsed ? 'justify-center' : 'px-4'
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-lg text-white shadow-sm">
        词
      </span>
      {!collapsed && (
        <span className="font-display text-lg font-bold tracking-wide text-brand-900">
          墨记单词
        </span>
      )}
    </NavLink>
  );
}

export function Layout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === '1'
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-bg flex min-h-full">
      {/* 桌面侧边栏 */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-brand-200/70 bg-white/70 backdrop-blur transition-[width] duration-200 lg:flex ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <BrandBlock collapsed={collapsed} />
        <SidebarNav collapsed={collapsed} />
        <div className="shrink-0 border-t border-brand-200/70 p-3">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-brand-100/80 hover:text-brand-800"
            title={collapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {collapsed ? (
              <span className="text-lg leading-none">»</span>
            ) : (
              <span className="flex w-full items-center gap-2">
                <span className="text-lg leading-none">«</span>
                <span>收起</span>
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* 移动端抽屉 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
            <BrandBlock collapsed={false} onNavigate={() => setMobileOpen(false)} />
            <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 移动端顶栏 */}
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-brand-200/70 bg-white/70 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="-ml-1 rounded-lg p-1.5 text-slate-600 hover:bg-brand-100"
            aria-label="打开菜单"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-display text-base font-bold tracking-wide text-brand-900">
            墨记单词
          </span>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}