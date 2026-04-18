import { Outlet } from 'react-router';
import { TopNav } from './components/TopNav/TopNav';
import { Sidebar } from './components/Sidebar/Sidebar';
import styles from './App.module.css';

export default function App() {
  return (
    <div className={styles.layout}>
      <TopNav />
      <Sidebar />
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
