import {Button, Card, Form, Input, Space} from 'antd';
import {CommonBridge} from '#preload';
import {useEffect, useState} from 'react';
import type {SettingOptions} from '../../../../shared/types/common';
import { useTranslation } from 'react-i18next';

const Settings = () => {
  const [formValue, setFormValue] = useState<SettingOptions>({profileCachePath: ''});
  const [form] = Form.useForm();
  const {t} = useTranslation();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const settings = await CommonBridge.getSettings();
    setFormValue(settings);
  };

  const handleSave = async (values: SettingOptions) => {
    await CommonBridge.saveSettings(values);
  };
  const handleChoosePath = async () => {
    const path = await CommonBridge.choosePath();
    handleFormValueChange({profileCachePath: path});
  };

  const handleFormValueChange = (changed: SettingOptions) => {
    const newFormValue = {
      ...formValue,
      ...changed,
    };
    setFormValue(newFormValue);
  };

  // type FieldType = SettingOptions;

  return (
    <>
      <Card
        className="content-card p-6"
        bordered={false}
      >
        <Form
          name="settingsForm"
          className="w-2/3"
          size="large"
          form={form}
          initialValues={formValue}
          onValuesChange={handleFormValueChange}
        >
          <Form.Item
            label={t('settings_cache_path')}
            name="profileCachePath"
          >
            <Space.Compact style={{width: '100%'}}>
              <Input
                readOnly
                disabled
                value={formValue.profileCachePath}
              />
              <Button
                type="default"
                onClick={handleChoosePath}
              >
                {t('settings_choose_cache_path')}
              </Button>
            </Space.Compact>
          </Form.Item>
        </Form>
      </Card>
      <div className="content-footer pl-24">
        <Button
          type="primary"
          className="w-20"
          onClick={() => handleSave(formValue)}
        >
          {t('footer_ok')}
        </Button>
      </div>
    </>
  );
};
export default Settings;
