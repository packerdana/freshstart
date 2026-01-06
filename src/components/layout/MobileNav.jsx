import { Home, Map, BarChart3, Settings } from 'lucide-react';

export default function MobileNav() {
  const navItems = [
    { id: 'today', icon: Home, label: 'Today', active: true },
    { id: 'route', icon: Map, label: 'Route', active: false },
    { id: 'stats', icon: BarChart3, label: 'Stats', active: false },
    { id: 'settings', icon: Settings, label: 'Settings', active: false },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-inset-bottom">
      <div className="flex justify-around items-center h-16">
        {navItems.map(({ id, icon: Icon, label, active }) => (
          <button
            key={id}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              active ? 'text-blue-600' : 'text-gray-500'
            }`}
            disabled={!active}
          >
            <Icon size={24} />
            <span className="text-xs mt-1">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
