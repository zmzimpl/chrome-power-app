import type {TabsProps} from 'antd';
import {Card, Tabs} from 'antd';
import './index.css';
import WindowEditForm from '../components/edit-form';
import WindowImportForm from '../components/import-form';
import {useCallback, useEffect, useState} from 'react';
import type {DB, SafeAny} from '../../../../../shared/types/db';
import {useSearchParams} from 'react-router-dom';
import {WindowBridge} from '#preload';
import FingerprintInfo from '../components/fingerprint-info';
import api from '../../../../../shared/api/api';
import WindowDetailFooter from '../components/edit-footer';

const WindowDetailTabs = ({
  formValue,
  onChange,
  fingerprints,
  formValueChangeCallback,
}: {
  formValue: DB.Window;
  fingerprints?: SafeAny;
  onChange: (key: string) => void;
  formValueChangeCallback: (changed: DB.Window, data: DB.Window) => void;
}) => {
  const DEFAULT_ACTIVE_KEY = '0';
  const items: TabsProps['items'] = [
    {
      key: 'windowForm',
      label: 'Create',
      forceRender: true,
      children: (
        <div className="flex w-full">
          {WindowEditForm({
            formValue: formValue,
            formChangeCallback: formValueChangeCallback,
          })}
          {FingerprintInfo({fingerprints})}
        </div>
      ),
    },
    {
      key: 'import',
      label: 'Import',
      children: WindowImportForm(),
    },
  ];

  return (
    <Tabs
      size="small"
      defaultActiveKey={DEFAULT_ACTIVE_KEY}
      items={items}
      onChange={onChange}
    />
  );
};

const WindowDetail = () => {
  // const [formValue, setFormValue] = useState<DB.Window>({});
  const [formValue, setFormValue] = useState<DB.Window>(new Object());
  const [currentTab, setCurrentTab] = useState('windowForm');
  const [searchParams] = useSearchParams();
  const [fingerprints, setFingerprints] = useState<SafeAny>(new Object());

  useEffect(() => {
    initFormValue();
  }, [searchParams]);

  const fetchFingerprints = async (windowId?: number) => {
    try {
      const {data} = await api.get('/power-api/fingerprints/window', {
        params: {
          windowId: windowId,
        },
      });
      setFingerprints(data);
    } catch (error) {
      setFingerprints(new Object());
      console.log(error);
    }
  };

  const initFormValue = async () => {
    const id = searchParams.get('id');
    if (id) {
      const window = await WindowBridge?.getById(Number(id));
      if (window.tags) {
        if (typeof window.tags === 'string') {
          window.tags = window.tags.split(',').map((item: string) => Number(item));
        } else if (typeof window.tags === 'number') {
          window.tags = [window.tags];
        }
      } else {
        window.tags = [];
      }
      setFormValue(window || new Object());
      fetchFingerprints(Number(id));
    } else {
      setFormValue(new Object());
      fetchFingerprints();
    }
  };

  const onTabChange = useCallback((tab: string) => {
    setCurrentTab(tab);
  }, []);

  const formValueChangeCallback = (changed: DB.Window, _: DB.Window) => {
    const newFormValue = {
      ...formValue,
      ...changed,
    };
    setFormValue(newFormValue);
    // setFormValue(data);
  };

  return (
    <>
      <Card className="window-detail-card">
        {searchParams.get('id') ? (
          <div className="flex w-full mt-4">
            <WindowEditForm
              formValue={formValue}
              formChangeCallback={formValueChangeCallback}
            ></WindowEditForm>
            <FingerprintInfo fingerprints={fingerprints} />
          </div>
        ) : (
          <WindowDetailTabs
            formValue={formValue}
            onChange={onTabChange}
            fingerprints={fingerprints}
            formValueChangeCallback={formValueChangeCallback}
          />
        )}
      </Card>
      <WindowDetailFooter
        currentTab={currentTab}
        formValue={formValue}
        fingerprints={fingerprints}
      />
    </>
  );
};

export default WindowDetail;
