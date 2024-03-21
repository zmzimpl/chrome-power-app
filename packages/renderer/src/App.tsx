import {Route, Routes, useLocation} from 'react-router-dom';
import Navigation from './components/navigation';

import dayjs from 'dayjs';

import './index.css';
import './styles/antd.css';
import {Layout, Typography, message} from 'antd';
import {useRoutes, useRoutesMap} from './routes';
import Header from './components/header';
import {useEffect, useState} from 'react';
import {CommonBridge} from '#preload';
import {MESSAGE_CONFIG} from './constants';
import type {BridgeMessage} from '../../shared/types/common';

const {Title} = Typography;

const {Content, Sider} = Layout;

dayjs.locale('zh-cn');

const App = () => {
  const routes = useRoutes();
  const routesMap = useRoutesMap();
  const [isVisible, setIsVisible] = useState(false);
  const [messageApi, contextHolder] = message.useMessage(MESSAGE_CONFIG);


  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100); // 延迟显示组件
  }, []);

  const location = useLocation();

  useEffect(() => {
    const handleMessaged = (_: Electron.IpcRendererEvent, msg: BridgeMessage) => {
      messageApi.open({
        type: msg.type,
        content: msg.text,
      });
    };

    CommonBridge?.offMessaged(handleMessaged);

    CommonBridge?.onMessaged(handleMessaged);

    return () => {
      CommonBridge?.offMessaged(handleMessaged);
    };
  }, []);

  return (
    <Layout className={`h-full fade-in ${isVisible ? 'visible' : ''}`}>
      {contextHolder}
      {/* <Spin
        spinning={loading}
        rootClassName={loading ? 'fullscreen-spin-wrapper visible' : ''}
      /> */}
      {location.pathname !== '/start' && <Header></Header>}
      <Layout>
        {location.pathname !== '/start' && (
          <Sider
            width={164}
            className="sider"
          >
            <Navigation></Navigation>
          </Sider>
        )}

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
};
export default App;
