import type {MenuProps} from 'antd';
import {Avatar, Button, Dropdown, Layout, Space} from 'antd';
import './index.css';
import Title from 'antd/es/typography/Title';
import {CloseOutlined, MinusOutlined, BorderOutlined, BlockOutlined} from '@ant-design/icons';
import {useState} from 'react';
import {customizeToolbarControl} from '#preload';
import type {MenuInfo} from 'rc-menu/lib/interface';
import {theme} from 'antd';
const {useToken} = theme;
import logo from '../../../assets/logo.png';
import {supabase} from '../../../../shared/interfaces/supabaseClient';
import {Icon} from '@iconify/react';
import {useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';

const {Header: AntdHeader} = Layout;

export default function Header() {
  const {t, i18n} = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);
  const navigate = useNavigate();
  const checkIfMaximized = async () => {
    try {
      const maximized = await customizeToolbarControl.isMaximized();
      setIsMaximized(maximized);
    } catch (error) {
      console.error('Failed to check if window is maximized:', error);
    }
  };

  const {token} = useToken();

  const items: MenuProps['items'] = [
    {
      label: t('header_settings'),
      key: 'settings',
    },
    {
      label: t('header_language'),
      key: 'language',
      children: [
        {
          label: 'English',
          key: 'en',
          onClick: () => {
            i18n.changeLanguage('en');
          },
        },
        {
          label: '简体中文',
          key: 'zh-cn',
          onClick: () => {
            i18n.changeLanguage('zh');
          },
        },
      ],
    },
    {
      type: 'divider',
    },
    {
      label: t('header_sign_out'),
      key: 'signout',
    },
  ];

  const appControl = (action: 'close' | 'minimize' | 'maximize') => {
    customizeToolbarControl[action]();
    checkIfMaximized();
  };

  const dropdownAction = (info: MenuInfo) => {
    switch (info.key) {
      case 'signout':
        supabase.auth.signOut();
        break;
      case 'settings':
        navigate('/settings');
        break;

      default:
        break;
    }
  };

  return (
    <AntdHeader className="header">
      <div className="header-left">
        <div className="logo">
          <img
            src={logo}
            alt="logo"
            className="logo-img"
          />
        </div>
        <Title
          className="title"
          level={3}
        >
          ChromePower
        </Title>
      </div>
      <div className="draggable draggable-bar"></div>
      <div className="header-right">
        <div className="avater-wrapper">
          <Dropdown
            menu={{items, onClick: menuInfo => dropdownAction(menuInfo)}}
            trigger={['click']}
          >
            <Avatar
              style={{backgroundColor: token.colorPrimary}}
              className="avatar"
              size={32}
              icon={<Icon icon="mdi:account" />}
            />
          </Dropdown>
        </div>

        <div className="control-btn">
          <Space direction="horizontal">
            <Button
              icon={<MinusOutlined />}
              onClick={() => appControl('minimize')}
            />
            <Button
              onClick={() => appControl('maximize')}
              icon={isMaximized ? <BlockOutlined /> : <BorderOutlined />}
            />
            <Button
              onClick={() => appControl('close')}
              icon={<CloseOutlined />}
            />
          </Space>
        </div>
      </div>
    </AntdHeader>
  );
}
