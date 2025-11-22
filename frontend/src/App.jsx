import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import ApproverDashboard from './pages/ApproverDashboard.jsx';
import CreateRequestPage from './pages/CreateRequestPage.jsx';
import FinanceDashboard from './pages/FinanceDashboard.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import RequestDetailPage from './pages/RequestDetailPage.jsx';
import StaffDashboard from './pages/StaffDashboard.jsx';

const GuardedLayout = ({ allow }) => (
  <ProtectedRoute allow={allow}>
    <Layout>
      <Outlet />
    </Layout>
  </ProtectedRoute>
);

const App = () => (
  <AuthProvider>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<GuardedLayout allow={['staff']} />}>
        <Route path="/staff" element={<StaffDashboard />} />
        <Route path="/staff/create" element={<CreateRequestPage />} />
        <Route path="/staff/request/:id" element={<RequestDetailPage />} />
      </Route>
      <Route element={<GuardedLayout allow={['approver_level_1', 'approver_level_2']} />}>
        <Route path="/approver" element={<ApproverDashboard />} />
      </Route>
      <Route element={<GuardedLayout allow={['finance']} />}>
        <Route path="/finance" element={<FinanceDashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </AuthProvider>
);

export default App;

