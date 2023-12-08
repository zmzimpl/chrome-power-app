import {Route, Routes, useLocation} from 'react-router-dom';
import Navigation from './components/navigation';

import dayjs from 'dayjs';

import './index.css';
import './styles/antd.css';
import {Button, Layout, Spin, Typography} from 'antd';
import {useRoutes, useRoutesMap} from './routes';
import Header from './components/header';
import {useEffect, useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {Auth} from '@supabase/auth-ui-react';
import type {ViewType} from '@supabase/auth-ui-shared';
import {CLASS_NAMES, ThemeSupa} from '@supabase/auth-ui-shared';
import {supabase} from '../../shared/interfaces/supabaseClient';
import api from '../../shared/api/api';
import {theme} from 'antd';
import {CommonBridge} from '#preload';
import {setMembership} from './slices/user-slice';
import {useDispatch} from 'react-redux';
import {useTranslation} from 'react-i18next';

const {useToken} = theme;

const {Title} = Typography;

const {Content, Sider} = Layout;

dayjs.locale('zh-cn');

const App = () => {
  const {t} = useTranslation();
  const routes = useRoutes();
  const routesMap = useRoutesMap();
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100); // 延迟显示组件
  }, []);

  const views: {id: ViewType; title: string; desc?: string}[] = [
    {
      id: CLASS_NAMES.SIGN_IN,
      title: t('sign_in'),
    },
    {id: CLASS_NAMES.SIGN_UP, title: 'Sign Up'},
    {
      id: CLASS_NAMES.FORGOTTEN_PASSWORD,
      title: t('forgotten_password'),
      desc: t('forgotten_password_desc'),
    },
    {id: CLASS_NAMES.UPDATE_PASSWORD, title: t('update_password')},
    // {id: 'verify_otp', title: 'Verify Otp'},
  ];

  const [session, setSession] = useState<Session | null>(null);
  const {token} = useToken();
  const [view, setView] = useState(views[0]);
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const dispatch = useDispatch();

  const getMembership = async () => {
    try {
      const {data} = await api.get('/power-api/users/membership');
      dispatch(setMembership(data));
      await CommonBridge.share('membership', data);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      localStorage.setItem('chrome_power_session', JSON.stringify(session));
      getMembership();
    }
  }, [session]);

  useEffect(() => {
    setLoading(true);
    supabase.auth.getSession().then(async ({data: {session}}) => {
      await CommonBridge.share('session', session);
      setSession(session);
      setLoading(false);
    });

    const {
      data: {subscription},
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await CommonBridge.share('session', session);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return (
      <div
        className={`flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8 fade-in ${
          isVisible && 'visible'
        }`}
      >
        <Spin spinning={loading}>
          <div className="sm:mx-auto sm:w-full sm:max-w-sm">
            <img
              className="mx-auto h-48 w-auto scale-140"
              src="../assets/logo.png"
              alt="ChromePower"
            />
            <h2 className=" text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
              {view.title}
            </h2>
            {view.desc && <p className="mt-4 text-center text-sm text-gray-500">{view.desc}</p>}
          </div>
          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
            <Auth
              supabaseClient={supabase}
              view={view.id}
              showLinks={false}
              appearance={{
                theme: ThemeSupa,
                style: {
                  button: {
                    backgroundColor: token.colorPrimary,
                  },
                },
              }}
              providers={[]}
            />
          </div>
          {view.id === CLASS_NAMES.SIGN_UP && (
            <p className="mt-10 text-center text-sm text-gray-500">
              {t('account_already_have')}{' '}
              <Button
                type="link"
                className="font-semibold leading-6"
                onClick={() => setView(views[0])}
              >
                {t('account_sign_in')}
              </Button>
            </p>
          )}
          {view.id === CLASS_NAMES.SIGN_IN && (
            <>
              <p className="mt-2 text-center text-sm text-gray-500">
                <Button
                  type="link"
                  className="font-semibold leading-6"
                  onClick={() => setView(views[2])}
                >
                  {t('account_forgot_password')}
                </Button>
              </p>

              <p className="mt-12 text-center text-sm text-gray-500">
                {t('account_do_not_have')}{' '}
                <Button
                  type="link"
                  className="font-semibold leading-6"
                  onClick={() => setView(views[1])}
                >
                  {t('account_sign_up')}
                </Button>
              </p>
            </>
          )}
          {view.id === CLASS_NAMES.FORGOTTEN_PASSWORD && (
            <>
              <p className="mt-2 text-center text-sm text-gray-500">
                <Button
                  type="link"
                  className="font-semibold leading-6"
                  onClick={() => setView(views[0])}
                >
                  {t('account_sign_in')}
                </Button>
              </p>
            </>
          )}
        </Spin>
      </div>
    );
  } else {
    return (
      <Layout className={`h-full fade-in ${isVisible ? 'visible' : ''}`}>
        <Header></Header>
        <Layout>
          <Sider
            width={164}
            className="sider"
          >
            <Navigation></Navigation>
          </Sider>
          <Content className="content">
            <Title
              className="mt-0"
              level={2}
            >
              {routesMap[location.pathname]?.name}
            </Title>
            <Routes>
              {routes.map(route => {
                return (
                  <Route
                    key={route.path}
                    path={route.path}
                    Component={route.component}
                  />
                );
              })}
            </Routes>
          </Content>
        </Layout>
      </Layout>
    );
  }
};
export default App;
