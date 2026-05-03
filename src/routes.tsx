import { Navigate, type RouteObject } from 'react-router';
import App from './App';
import Dashboard from './pages/Dashboard/Dashboard';
import PlayerPage from './pages/Player/PlayerPage';
import FightPage from './pages/Fight/FightPage';
import LeagueLayout from './pages/League/LeagueLayout';
import Standings from './pages/League/Standings';
import Calendar from './pages/League/Calendar';
import RecentResults from './pages/League/RecentResults';
import Schedule from './pages/League/Schedule';
import ContractNegotiation from './pages/League/ContractNegotiation';
import PpvSignup from './pages/League/PpvSignup';
import GymLayout from './pages/Gym/GymLayout';
import Roster from './pages/Gym/Roster';
import Finances from './pages/Gym/Finances';
import Coaches from './pages/Gym/Coaches';
import PlayersLayout from './pages/Players/PlayersLayout';
import Recruiting from './pages/Players/Recruiting';
import CoachRecruiting from './pages/Players/CoachRecruiting';
import Compare from './pages/Players/Compare';
import ToolsLayout from './pages/Tools/ToolsLayout';
import GodMode from './pages/Tools/GodMode';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'player/:id', element: <PlayerPage /> },
      { path: 'fight/:fightId', element: <FightPage /> },
      {
        path: 'league',
        element: <LeagueLayout />,
        children: [
          { index: true, element: <Navigate to="standings" replace /> },
          { path: 'standings', element: <Standings /> },
          { path: 'calendar', element: <Calendar /> },
          { path: 'results', element: <RecentResults /> },
          { path: 'schedule', element: <Schedule /> },
          { path: 'contracts/:id', element: <ContractNegotiation /> },
          { path: 'ppv/:fightId', element: <PpvSignup /> },
        ],
      },
      {
        path: 'gym',
        element: <GymLayout />,
        children: [
          { index: true, element: <Navigate to="roster" replace /> },
          { path: 'roster', element: <Roster /> },
          { path: 'finances', element: <Finances /> },
          { path: 'coaches', element: <Coaches /> },
        ],
      },
      {
        path: 'players',
        element: <PlayersLayout />,
        children: [
          { index: true, element: <Navigate to="recruiting" replace /> },
          { path: 'recruiting', element: <Recruiting /> },
          { path: 'coaches', element: <CoachRecruiting /> },
          { path: 'compare', element: <Compare /> },
        ],
      },
      {
        path: 'tools',
        element: <ToolsLayout />,
        children: [
          { index: true, element: <Navigate to="god-mode" replace /> },
          { path: 'god-mode', element: <GodMode /> },
        ],
      },
    ],
  },
];
