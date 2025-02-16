import {Button, Space, message} from 'antd';
import type {OperationResult} from '../../../../../../shared/types/common';
import {WindowBridge} from '#preload';
import type {DB, SafeAny} from '../../../../../../shared/types/db';
import {MESSAGE_CONFIG} from '/@/constants';
import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const WindowDetailFooter = ({
  currentTab,
  formValue,
  fingerprints,
  loading,
}: {
  loading: boolean;
  fingerprints: SafeAny;
  currentTab: string;
  formValue: DB.Window;
}) => {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage(MESSAGE_CONFIG);
  const [saving, setSaving] = useState(false);
  const {t} = useTranslation();

  const back = () => {
    history.back();
  };

  const handleOk = () => {
    console.log('handleOk', formValue);
    saveWindow(formValue);
  };

  const savePreparation = (formValue: DB.Window) => {
    if (formValue.tags && formValue.tags instanceof Array) {
      formValue.tags = formValue.tags.join(',');
    }
  };

  const showMessage = (result: OperationResult) => {
    messageApi[result.success ? 'success' : 'error'](
      result.success
        ? `Saved successfully`
        : result.message,
    ).then(() => {
      setSaving(false);
      if (result.success) {
        navigate('/');
      }
    });
  };

  const saveWindow = async (formValue: DB.Window) => {
    setSaving(true);
    savePreparation(formValue);
    let result: OperationResult;
    if (formValue.id) {
      result = await WindowBridge?.update(formValue.id, {
        ...formValue,
        proxy_id: formValue.proxy_id || null,
      });
      showMessage(result);
    } else {
      if (currentTab === 'windowForm') {
        result = await WindowBridge?.create(formValue, fingerprints);
        showMessage(result);
      }
    }
  };

  return (
    <>
      {contextHolder}
      <div className="content-footer">
        <Space
          className="pl-24"
          size={16}
        >
          {currentTab !== 'import' && (
            <Button
              disabled={loading}
              loading={saving}
              type="primary"
              className="w-20"
              onClick={() => handleOk()}
            >
              {t('footer_ok')}
            </Button>
          )}
          <Button
            type="text"
            onClick={() => back()}
            className="w-20"
          >
            {t('footer_cancel')}
          </Button>
        </Space>
      </div>
    </>
  );
};

export default WindowDetailFooter;
