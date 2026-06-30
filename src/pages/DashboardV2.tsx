import Dashboard from './Dashboard';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function DashboardV2() {
  usePageTitle('Dashboard');
  return <Dashboard />;
}
