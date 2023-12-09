import type {UploadProps} from 'antd';
import {Button, Form, Space, Spin, Upload, message} from 'antd';
import {UploadOutlined} from '@ant-design/icons';
import {CommonBridge, WindowBridge} from '#preload';
import {useNavigate} from 'react-router-dom';
import {MESSAGE_CONFIG} from '/@/constants';
import {useState} from 'react';
import {useDispatch} from 'react-redux';
import {setMembership} from '/@/slices/user-slice';
import api from '../../../../../../shared/api/api';
import type {OperationResult} from '../../../../../../shared/types/common';
import {useTranslation} from 'react-i18next';

const WindowImportForm = () => {
  const key = 'updatable';

  const [messageApi, contextHolder] = message.useMessage(MESSAGE_CONFIG);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const dispatch = useDispatch();
  const {t} = useTranslation();

  const getMembership = async () => {
    try {
      const {data} = await api.get('/power-api/users/membership');
      dispatch(setMembership(data));
      await CommonBridge.share('membership', data);
    } catch (error) {
      console.log(error);
    }
  };

  const props: UploadProps = {
    name: 'import',
    customRequest: async ({file}) => {
      try {
        setLoading(true);
        messageApi.open({type: 'loading', content: 'Importing...', key: key});
        const result: OperationResult = await WindowBridge?.import((file as unknown as File).path);
        console.log(result);
        if (result.success) {
          getMembership();
        }
        messageApi
          .open({
            type: (result.data as number[]).length > 0 ? 'success' : 'error',
            content: `${
              result.message +
              (result.data.length > 0
                ? `, will be automatically jumped after ${MESSAGE_CONFIG.duration}s`
                : '')
            }`,
            key: key,
          })
          .then(() => {
            setLoading(false);
            if (result.data.length > 0) {
              navigate('/');
            }
          });
      } catch (error) {
        console.error(error);
      }
    },
    showUploadList: false,
  };

  const downLoadTempalte = async () => {
    try {
      const filePath = 'renderer/assets/template.xlsx';
      const rs = await CommonBridge.download(filePath);
      if (rs) {
        messageApi.success('Template downloaded successfully');
      }
    } catch (error) {
      console.error(error);
      messageApi.error('Failed to download template');
    }
  };

  return (
    <>
      {contextHolder}
      <Spin spinning={loading}>
        <Form
          layout="horizontal"
          size="large"
          labelCol={{span: 5}}
        >
          <Form.Item label={t('window_import_from_template')}>
            <Space>
              <Upload {...props}>
                <Button icon={<UploadOutlined />}>
                  {t('window_import_from_template_tip')}
                </Button>
              </Upload>
              <Button
                type="link"
                onClick={() => downLoadTempalte()}
              >
                {t('window_import_from_template_download')}
              </Button>
            </Space>
          </Form.Item>
          <Form.Item label={t('window_import_from_ads')}>
            <Upload {...props}>
              <Button icon={<UploadOutlined />}>
                {t('window_import_from_ads_tip')}
              </Button>
            </Upload>
          </Form.Item>
        </Form>
      </Spin>
    </>
  );
};

export default WindowImportForm;
