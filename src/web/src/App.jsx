import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, HashRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import { PageLoader } from './components/States.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { LibraryProvider } from './context/LibraryContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ROUTER_MODE } from './api/config.js';

// Carga diferida por pantalla: cada ruta es un fichero JS aparte que solo se descarga al visitarla.
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Onboarding = lazy(() => import('./pages/Onboarding.jsx'));
const Discover = lazy(() => import('./pages/Discover.jsx'));
const Search = lazy(() => import('./pages/Search.jsx'));
const MovieDetail = lazy(() => import('./pages/MovieDetail.jsx'));
const MyList = lazy(() => import('./pages/MyList.jsx'));
const MyRatings = lazy(() => import('./pages/MyRatings.jsx'));
const Account = lazy(() => import('./pages/Account.jsx'));
const About = lazy(() => import('./pages/About.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview.jsx'));
const AdminCatalog = lazy(() => import('./pages/admin/AdminCatalog.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers.jsx'));
const AdminUsage = lazy(() => import('./pages/admin/AdminUsage.jsx'));

const Router = ROUTER_MODE === 'hash' ? HashRouter : BrowserRouter;

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <PageLoader />;
  if (status === 'anon') return <Navigate to="/entrar" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

function RequireOnboarded() {
  const { user } = useAuth();
  if (user && !user.onboarded) return <Navigate to="/bienvenida" replace />;
  return <Outlet />;
}

function RequireAdmin() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}

function PublicOnly() {
  const { status } = useAuth();
  if (status === 'loading') return <PageLoader />;
  if (status === 'auth') return <Navigate to="/" replace />;
  return <Outlet />;
}

function AppLayout() {
  return (
    <>
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>
      <Header />
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}

function BareLayout() {
  return (
    <main id="main" tabIndex={-1}>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </main>
  );
}

export default function App() {
  return (
    <Router>
      <ToastProvider>
        <AuthProvider>
          <LibraryProvider>
            <ScrollToTop />
            <Routes>
              <Route element={<BareLayout />}>
                <Route element={<PublicOnly />}>
                  <Route path="/entrar" element={<Login />} />
                  <Route path="/registro" element={<Register />} />
                </Route>
                <Route element={<RequireAuth />}>
                  <Route path="/bienvenida" element={<Onboarding />} />
                </Route>
              </Route>

              <Route element={<RequireAuth />}>
                <Route element={<AppLayout />}>
                  <Route element={<RequireOnboarded />}>
                    <Route index element={<Discover />} />
                    <Route path="/buscar" element={<Search />} />
                    <Route path="/pelicula/:id" element={<MovieDetail />} />
                    <Route path="/mi-lista" element={<MyList />} />
                    <Route path="/valoraciones" element={<MyRatings />} />
                  </Route>
                  <Route path="/cuenta" element={<Account />} />
                  <Route path="/acerca" element={<About />} />
                  <Route element={<RequireAdmin />}>
                    <Route path="/admin" element={<AdminLayout />}>
                      <Route index element={<AdminOverview />} />
                      <Route path="catalogo" element={<AdminCatalog />} />
                      <Route path="usuarios" element={<AdminUsers />} />
                      <Route path="uso" element={<AdminUsage />} />
                    </Route>
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>
            </Routes>
          </LibraryProvider>
        </AuthProvider>
      </ToastProvider>
    </Router>
  );
}
