import {Button, Menu, type MenuProps} from 'antd';
import type {MenuInfo} from 'rc-menu/lib/interface';
import {useRoutes} from '/@/routes';
import {useLocation, useNavigate} from 'react-router-dom';
import {PlusCircleOutlined} from '@ant-design/icons';
import {useEffect} from 'react';
import './index.css';
import React from 'react';
import {t} from 'i18next';

export default function Navigation() {
  const routes = useRoutes();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuItems, setMenuItems] = React.useState<MenuProps['items']>([]);

  useEffect(() => {
    const menuItemsTemp: MenuProps['items'] = routes
      .filter(r => !r.invisible)
      .map(route => {
        return {
          key: route.path,
          icon: route.icon,
          label: route.name,
        };
      });
    menuItemsTemp.splice(3, 0, {type: 'divider'});
    setMenuItems(menuItemsTemp);
  }, [routes]);

  const onItemClicked = (info: MenuInfo) => {
    navigate(info.key);
  };

  return (
    <>
      <div className="my-4 px-2">
        <Button
          type="primary"
          block
          className="h-[40px]"
          onClick={() => {
            navigate('/window/create');
          }}
          icon={<PlusCircleOutlined />}
        >
          {t('new_window')}
        </Button>
      </div>
      <Menu
        mode="inline"
        defaultSelectedKeys={['/']}
        selectedKeys={[location.pathname]}
        style={{borderRight: 0}}
        onClick={onItemClicked}
        rootClassName="navigation"
        items={menuItems}
      />
    </>
  );
}
