import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { JourneyProvider } from '@/context/JourneyContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ToastProvider } from '@/context/ToastContext';
import { AppLayout } from '@/layouts/AppLayout';
import { FullPageLoader, PublicOnly, RequireAuth } from '@/layouts/guards';
import { PublicLayout } from '@/layouts/PublicLayout';
import Landing from '@/pages/Landing';

const About = lazy(() => import('@/pages/info/About'));
const InfoPage = lazy(() => import('@/pages/info/InfoPage'));
const SignIn = lazy(() => import('@/pages/auth/SignIn'));
const SignUp = lazy(() => import('@/pages/auth/SignUp'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));
const VerifyEmail = lazy(() => import('@/pages/auth/VerifyEmail'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const PlanJourney = lazy(() => import('@/pages/PlanJourney'));
const ActiveJourney = lazy(() => import('@/pages/ActiveJourney'));
const SafeCircle = lazy(() => import('@/pages/SafeCircle'));
const CommunityMap = lazy(() => import('@/pages/CommunityMap'));
const Settings = lazy(() => import('@/pages/Settings'));
const History = lazy(() => import('@/pages/History'));
const Sos = lazy(() => import('@/pages/Sos'));
const Moderation = lazy(() => import('@/pages/Moderation'));
const SharedJourney = lazy(() => import('@/pages/public/SharedJourney'));
const Invite = lazy(() => import('@/pages/public/Invite'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const DemoStart = lazy(() => import('@/pages/DemoStart'));

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <NotificationProvider>
          <JourneyProvider>
            <Suspense fallback={<FullPageLoader />}>
              <Routes>
                <Route element={<PublicLayout />}>
                  <Route index element={<Landing />} />
                  <Route path="about" element={<About />} />
                  <Route path="privacy" element={<InfoPage page="privacy" />} />
                  <Route path="terms" element={<InfoPage page="terms" />} />
                  <Route path="help" element={<InfoPage page="help" />} />
                  <Route path="contact" element={<InfoPage page="contact" />} />
                </Route>

                <Route path="signin" element={<PublicOnly><SignIn /></PublicOnly>} />
                <Route path="signup" element={<PublicOnly><SignUp /></PublicOnly>} />
                <Route path="forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
                <Route path="verify-email" element={<VerifyEmail />} />
                <Route path="reset-password" element={<ResetPassword />} />
                <Route path="demo" element={<DemoStart />} />
                <Route path="s/:token" element={<SharedJourney />} />
                <Route path="invite/:token" element={<Invite />} />

                <Route path="onboarding" element={<RequireAuth allowUnonboarded><Onboarding /></RequireAuth>} />

                <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="plan" element={<PlanJourney />} />
                  <Route path="journey" element={<ActiveJourney />} />
                  <Route path="circle" element={<SafeCircle />} />
                  <Route path="community" element={<CommunityMap />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="history" element={<History />} />
                  <Route path="sos" element={<Sos />} />
                  <Route path="moderation" element={<Moderation />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </JourneyProvider>
        </NotificationProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
