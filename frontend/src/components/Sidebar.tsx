import { NavLink } from 'react-router-dom';
import { FlaskConical, FileText, Sparkles, Settings } from 'lucide-react';

export function Sidebar() {
  const navItems = [
    { to: '/', icon: FileText, label: 'Prompts' },
    { to: '/experiments', icon: FlaskConical, label: 'Experiments' },
    { to: '/ape', icon: Sparkles, label: 'APE' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>🧪 Prompt Lab</h1>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
