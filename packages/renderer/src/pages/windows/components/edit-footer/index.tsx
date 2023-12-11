import {Button, Space, message} from 'antd';
import type {OperationResult} from '../../../../../../shared/types/common';
import {CommonBridge, WindowBridge} from '#preload';
import type {DB, SafeAny} from '../../../../../../shared/types/db';
import {setMembership} from '/@/slices/user-slice';
import {MESSAGE_CONFIG} from '/@/constants';
import {useDispatch} from 'react-redux';
import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import api from '../../../../../../shared/api/api';
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
  const dispatch = useDispatch();
  const {t} = useTranslation();

  const back = () => {
    history.back();
  };

  const handleOk = () => {
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
        ? `Saved successfully, will be automatically jumped after ${MESSAGE_CONFIG.duration}s`
        : result.message,
    ).then(() => {
      setSaving(false);
      if (result.success) {
        navigate('/');
      }
    });
  };

  const getMembership = async () => {
    try {
      const {data} = await api.get('/power-api/users/membership');
      dispatch(setMembership(data));
      await CommonBridge.share('membership', data);
    } catch (error) {
      console.log(error);
    }
  };

  const saveWindow = async (formValue: DB.Window) => {
    setSaving(true);
    savePreparation(formValue);
    let result: OperationResult;
    if (formValue.id) {
      result = await WindowBridge?.update(formValue.id, formValue);
      showMessage(result);
    } else {
      if (currentTab === 'windowForm') {
        result = await WindowBridge?.create(formValue, fingerprints);
        if (result.success) {
          getMembership();
        }
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
