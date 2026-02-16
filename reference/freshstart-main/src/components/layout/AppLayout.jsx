import { Outlet } from 'react-router-dom';
import MobileNav from './MobileNav';
import useRouteStore from '../../stores/routeStore';

export default function AppLayout() {
  const currentRoute = useRouteStore((state) => state.currentRoute);

  return (
    <div className="min-h-screen flex flex-col pb-16">
      <header className="bg-blue-600 text-white py-4 px-6 shadow-md">
        <h1 className="text-xl font-bold">RouteWise</h1>
        <p className="text-sm text-blue-100">Route {currentRoute}</p>
      </header>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      <MobileNav />
    </div>
  );
}
