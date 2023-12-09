import {Button, Menu, type MenuProps, Row, Col} from 'antd';
import type {MenuInfo} from 'rc-menu/lib/interface';
import {useRoutes} from '/@/routes';
import {useLocation, useNavigate} from 'react-router-dom';
import {PlusCircleOutlined} from '@ant-design/icons';
import type {RootState} from '/@/store';
import {useSelector} from 'react-redux';
import {useEffect} from 'react';
import './index.css';
import React from 'react';
import { t } from 'i18next';

export interface MembershipOptions {
  expiredAt?: string;
  startAt?: string;
  userId: string;
  windowsLimit?: number;
  windowsUsed?: number;
}

export default function Navigation() {
  const routes = useRoutes();
  const navigate = useNavigate();
  const location = useLocation();
  const membership = useSelector((state: RootState) => state.user.membership);
  const [formattedMembership, setFormattedMembership] = React.useState<MembershipOptions>();
  const [menuItems, setMenuItems] = React.useState<MenuProps['items']>([]);

  const dateFormater = (date: string) => {
    if (!date) return;
    return new Date(date).toISOString().split('T')[0];
  };

  useEffect(() => {
    setFormattedMembership({
      expiredAt: dateFormater(membership?.expiredAt),
      startAt: dateFormater(membership?.startAt),
      userId: membership?.userId,
      windowsLimit: membership?.windowsLimit,
      windowsUsed: membership?.windowsUsed || 0,
    });
  }, [membership]);

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
      <div className="membership">
        {formattedMembership?.userId && (
          <>
            <Row>
              <Col span={15}>
                <div className="text-blue-600">{formattedMembership.expiredAt || 'Indefinite'}</div>
              </Col>

              <Col
                className="text-right "
                span={9}
              >
                <a
                  className="text-xs underline underline-offset-4 text-orange-400 hover:text-orange-500"
                  href="https://www.chromepower.xyz/pricing"
                >
                  {formattedMembership.expiredAt ? t('membership_renew') : t('membership_upgrade')}
                </a>
              </Col>
            </Row>
            <Row className="mt-3 text-gray-500">
              <Col
                span={10}
                className="text-xs"
              >
                <div>{t('membership_window_count')}</div>
              </Col>

              <Col
                className="text-right text-xs"
                span={14}
              >
                {formattedMembership.windowsUsed} / {formattedMembership.windowsLimit}
              </Col>
            </Row>
          </>
        )}
      </div>
    </>
  );
}
