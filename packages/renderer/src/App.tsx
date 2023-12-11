import {Route, Routes, useLocation} from 'react-router-dom';
import Navigation from './components/navigation';

import dayjs from 'dayjs';

import './index.css';
import './styles/antd.css';
import {Button, Checkbox, Layout, Modal, Spin, Typography, message} from 'antd';
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
  const [userAgreementVisible, setUserAgreementVisible] = useState(false);
  const [isAgree, setIsAgree] = useState(false);
  const [isAgreeLoading, setIsAgreeLoading] = useState(false);

  const showUserAgreement = () => {
    setUserAgreementVisible(true);
  };

  const handleAgree = async () => {
    try {
      setIsAgreeLoading(true);
      const {data} = await api.post('/power-api/users/agreement');
      if (data.status) {
        setUserAgreementVisible(false);
        setIsAgree(true);
      }
    } catch (error) {
      message.error('unknown error');
      console.log(error);
    }
  };

  const getMembership = async () => {
    setLoading(true);
    try {
      const {data} = await api.get('/power-api/users/membership');
      dispatch(setMembership(data));
      await CommonBridge.share('membership', data);
      if (!data.agree) {
        showUserAgreement();
      }
      setLoading(false);
    } catch (error) {
      console.log(error);
      setLoading(false);
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
        <Spin
          spinning={loading}
          rootClassName={loading ? 'fullscreen-spin-wrapper visible' : ''}
        />
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
        <Modal
          title={
            <div className="text-center w-full">
              <span>用户协议</span>
            </div>
          }
          open={userAgreementVisible}
          onOk={handleAgree}
          closable={false}
          footer={
            <Button
              disabled={!isAgree}
              loading={isAgreeLoading}
              onClick={handleAgree}
              type="primary"
            >
              开始使用
            </Button>
          }
        >
          <div className="h-[500px] overflow-auto bg-gray-100 p-4">
            <h1>ChromePower 应用用户协议</h1>

            <h2>1. 引言</h2>
            <p>
              欢迎使用 ChromePower 应用（以下简称“应用”）。本应用由 zmzimpl
              个人开发和维护。在您使用本应用前，请仔细阅读本用户协议（以下简称“协议”）。
            </p>

            <h2>2. 接受条款</h2>
            <p>
              通过下载、安装或使用本应用，您确认您已阅读、理解并同意受本协议的约束。如果您不同意本协议的任何条款，请不要下载、安装或使用本应用。
            </p>

            <h2>3. 使用许可</h2>
            <p>
              我们授予您有限的、非排他性的、不可转让的许可，以下载、安装和使用本应用，仅供个人和非商业用途。
            </p>

            <h2>4. 知识产权</h2>
            <p>
              本应用及其所有内容，包括但不限于文本、图像、用户界面、商标、徽标和软件代码，均为我们或我们的许可方所有，并受到版权、商标以及其他知识产权法律的保护。
            </p>

            <h2>5. 用户行为</h2>
            <p>
              您同意在使用本应用时不会违反任何适用的法律、规定或本协议的任何条款。您不得传播任何非法、侵扰性、侮辱性、威胁性或诽谤性内容。
            </p>

            <h2>6. 数据和隐私</h2>
            <p>
              我们承诺不会收集除邮箱以外的任何隐私数据。我们深知用户隐私的重要性，并承诺将此作为我们服务的核心部分。
            </p>

            <h2>7. 第三方链接和服务</h2>
            <p>
              本应用可能包含指向第三方网站或服务的链接。这些第三方网站或服务不受我们控制，我们对其内容、隐私政策或实践不负任何责任。
            </p>

            <h2>8. 免责声明</h2>
            <p>本应用及其内容以“现状”和“可用”基础提供。我们不提供任何形式的明示或暗示保证。</p>

            <h2>9. 限制责任</h2>
            <p>
              在适用法律允许的最大范围内，我们不对任何直接的、间接的、偶然的、特殊的、后果性的或惩罚性的损害负责。
            </p>

            <h2>10. 修改和终止</h2>
            <p>
              我们保留修改本协议或终止本应用的权利。您继续使用本应用将构成您对修改后的协议的接受。
            </p>

            <h2>11. 用户资产责任声明</h2>
            <p>
              鉴于我们软件的非数据采集特性，我们不对用户的任何资产负责。我们建议用户应对使用本软件过程中可能涉及的资产进行谨慎管理，并自行承担相关责任。
            </p>

            <h2>12. 服务连续性承诺</h2>
            <p>
              我们承诺不会无故停用服务。我们理解用户对于服务的依赖性和重要性，我们会尽最大努力确保服务的连续性和稳定性。
            </p>

            <h2>13. 长期维护和开源承诺：</h2>
            <p>
              在未来，如果我们决定不再维护本软件，我们承诺会在服务完最后一位付费用户后将软件后台的所有代码开源。这样做的目的是为了社区能够接手维护和进一步发展本软件，确保长期服务的可持续性。
            </p>

            <h2>14. 联系我们</h2>
            <p>如果您对本协议或本应用有任何疑问，请通过 zmzimpl@gmail.com 联系我们。</p>
          </div>
          <Checkbox
            className="mt-2"
            checked={isAgree}
            onChange={e => {
              setIsAgree(e.target.checked);
            }}
          >
            我同意遵守此协议
          </Checkbox>
        </Modal>
      </Layout>
    );
  }
};
export default App;
