import {Button, Card, Form, Input, List, Modal, Space, Tag} from 'antd';
import {CommonBridge, WindowBridge} from '#preload';
import {useEffect, useState} from 'react';
import type {SettingOptions} from '../../../../shared/types/common';
import {useTranslation} from 'react-i18next';

type FieldType = {
  profileCachePath: string;
  useLocalChrome: boolean;
  localChromePath: string;
  chromiumBinPath: string;
  automationConnect: boolean;
};

const Settings = () => {
  const [formValue, setFormValue] = useState<SettingOptions>({
    profileCachePath: '',
    useLocalChrome: true,
    localChromePath: '',
    chromiumBinPath: '',
    automationConnect: false,
  });
  const [isDefaultBrowser, setIsDefaultBrowser] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [urlToOpen, setUrlToOpen] = useState<string | null>(null);
  const [openWindows, setOpenWindows] = useState<any[]>([]);
  const [form] = Form.useForm();
  const {t} = useTranslation();

  useEffect(() => {
    fetchSettings();
    // Check default browser status (Windows only)
    CommonBridge.isDefaultBrowser().then(setIsDefaultBrowser);
    // Listen for open-url-request from main process
    CommonBridge.onOpenUrlRequest((url: string) => {
      setUrlToOpen(url);
      WindowBridge.getAll().then((wins: any[]) => setOpenWindows(wins));
    });
  }, []);

  const fetchSettings = async () => {
    const settings = await CommonBridge.getSettings();
    setFormValue(settings);
    form.setFieldsValue(settings);
  };

  const handleSave = async (values: SettingOptions) => {
    await CommonBridge.saveSettings(values);
  };

  const handleChoosePath = async (
    field: 'profileCachePath' | 'localChromePath' | 'chromiumBinPath',
    type: 'openFile' | 'openDirectory',
  ) => {
    const path = await CommonBridge.choosePath(type);
    if (!formValue[field] || (path && formValue[field] !== path)) {
      handleFormValueChange({
        ...formValue,
        [field]: path,
      });
    }
  };

  const handleFormValueChange = (changed: SettingOptions) => {
    const newFormValue = {
      ...formValue,
      ...changed,
    };
    setFormValue(newFormValue);
    handleSave(newFormValue);
  };


  const handleRegisterDefaultBrowser = async () => {
    setRegisterLoading(true);
    const result = await CommonBridge.registerDefaultBrowser();
    if (result.success) {
      setIsDefaultBrowser(true);
    }
    setRegisterLoading(false);
  };

  const handleUnregisterDefaultBrowser = async () => {
    await CommonBridge.unregisterDefaultBrowser();
    setIsDefaultBrowser(false);
  };

  const handleOpenUrlInWindow = async (port: number) => {
    if (!urlToOpen) return;
    await CommonBridge.openUrlInWindow(port, urlToOpen);
    setUrlToOpen(null);
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
          labelCol={{span: 5}}
          size="large"
          form={form}
          initialValues={formValue}
          onValuesChange={handleFormValueChange}
        >
          <Form.Item<FieldType>
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
                onClick={() => handleChoosePath('profileCachePath', 'openDirectory')}
              >
                {t('settings_choose_cache_path')}
              </Button>
            </Space.Compact>
          </Form.Item>
          {/* <Form.Item<FieldType>
            label={t('settings_use_local_chrome')}
            name="useLocalChrome"
          >
            <Switch value={formValue.useLocalChrome} />
          </Form.Item> */}
          {formValue.useLocalChrome ? (
            <Form.Item<FieldType>
              label={t('settings_chrome_path')}
              name="localChromePath"
            >
              <Space.Compact style={{width: '100%'}}>
                <Input
                  readOnly
                  disabled
                  value={formValue.localChromePath}
                />
                <Button
                  type="default"
                  onClick={() => handleChoosePath('localChromePath', 'openFile')}
                >
                  {t('settings_choose_cache_path')}
                </Button>
              </Space.Compact>
            </Form.Item>
          ) : (
            <Form.Item<FieldType>
              label={t('setting_chromium_path')}
              name="chromiumBinPath"
            >
              <Space.Compact style={{width: '100%'}}>
                <Input
                  readOnly
                  disabled
                  value={formValue.chromiumBinPath}
                />
                <Button
                  type="default"
                  onClick={() => handleChoosePath('chromiumBinPath', 'openFile')}
                >
                  {t('settings_choose_cache_path')}
                </Button>
              </Space.Compact>
            </Form.Item>
          )}
          {/* <Form.Item<FieldType>
            label={t('settings_automation_connect')}
            name="automationConnect"
            >
              <Switch value={formValue.automationConnect} />
          </Form.Item> */}
        </Form>
      </Card>
      {/* <div className="content-footer pl-24">
        <Button
          type="primary"
          className="w-20"
          onClick={() => handleSave(formValue)}
        >
          {t('footer_ok')}
        </Button>
      </div> */}

      <Card className="content-card p-6 mt-4" bordered={false}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <div>
            <div style={{fontWeight:600}}>{t('settings_default_browser')}</div>
            <div style={{color:'#999', fontSize:12, marginTop:4}}>{t('settings_default_browser_desc')}</div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            {isDefaultBrowser && <Tag color="success">{t('settings_default_browser_active')}</Tag>}
            {isDefaultBrowser ? (
              <Button onClick={handleUnregisterDefaultBrowser}>{t('settings_unregister_default_browser')}</Button>
            ) : (
              <Button type="primary" loading={registerLoading} onClick={handleRegisterDefaultBrowser}>
                {t('settings_register_default_browser')}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Modal
        title={t('select_window_to_open')}
        open={!!urlToOpen}
        onCancel={() => setUrlToOpen(null)}
        footer={null}
      >
        <div style={{color:'#999', fontSize:12, marginBottom:12, wordBreak:'break-all'}}>
          URL: {urlToOpen}
        </div>
        <List
          dataSource={openWindows}
          locale={{emptyText: t('no_open_windows')}}
          renderItem={(win: any) => (
            <List.Item
              style={{cursor:'pointer'}}
              onClick={() => handleOpenUrlInWindow(win.port)}
            >
              <span style={{color: win.status === 2 ? '#52c41a' : '#999', marginRight:8}}>
                {win.status === 2 ? '●' : '○'}
              </span>
              <span style={{fontFamily:'monospace'}}>{win.name}</span>
              <span style={{color:'#999', fontSize:12, marginLeft:12}}>{win.proxy}</span>
            </List.Item>
          )}
        />
      </Modal>
    </>
  );
};
export default Settings;
