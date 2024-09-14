import {Card} from 'antd';
import React from 'react';
import './index.css';
import {CommonBridge} from '#preload';
import {useEffect, useState} from 'react';
import {Divider, Typography, Form} from 'antd';
import {useTranslation} from 'react-i18next';
const {Title, Paragraph, Text, Link} = Typography;

const Api = () => {
  const [apiInfo, setApiInfo] = useState({
    url: '',
    status: 'ok',
    port: undefined,
  });
  const {t} = useTranslation();
  const fetchApi = async () => {
    const apiInfo = await CommonBridge.getApi();
    setApiInfo(apiInfo);
  };

  useEffect(() => {
    fetchApi();
  }, []);
  return (
    <>
      <Card
        className="content-card api-container-card p-6"
        bordered={false}
      >
        <Title level={2}>
          {t('api_title')}
          <Link
            className="ml-2"
            href="https://documenter.getpostman.com/view/25586363/2sA3BkdZ61#intro"
            target="_blank"
          >
            {t('api_link')}
          </Link>
        </Title>

        <Paragraph type="secondary">
          {t('api_description')}
        </Paragraph>
        <Divider />

        <Form
          name="validate_other"
          size="small"
          labelCol={{span: 4}}
          wrapperCol={{span: 20}}
          style={{maxWidth: 600}}
        >
          <Form.Item label={t('api_status')}>
            <Text type={apiInfo.status === 'ok' ? 'success' : 'warning'}>{apiInfo.status}</Text>
          </Form.Item>
          <Form.Item label={t('api_url')}>
            <Text
              type={apiInfo.status === 'ok' ? 'success' : 'warning'}
              copyable
            >
              {apiInfo.url}
            </Text>
          </Form.Item>
        </Form>
        <Divider />

        <Title level={3}>{t('api_supported')}</Title>
        <Title level={4}>{t('api_control')}</Title>
        <Paragraph>{t('api_getProfiles')}</Paragraph>
        <Paragraph
          code
          copyable={{text: `${apiInfo.url}/profiles`}}
        >
          GET /profiles
        </Paragraph>
        <Paragraph>{t('api_openProfile')}</Paragraph>
        <Paragraph
          code
          copyable={{text: `${apiInfo.url}/profiles/open?windowId=`}}
        >
          GET /profiles/open?windowId=xxx
        </Paragraph>
        <Paragraph>{t('api_closeProfile')}</Paragraph>
        <Paragraph
          code
          copyable={{text: `${apiInfo.url}/profiles/close?windowId=`}}
        >
          GET /profiles/close?windowId=xxx
        </Paragraph>
        <Title level={4}>{t('api_windows')}</Title>
        <Paragraph code copyable={{text: 'https://documenter.getpostman.com/view/25586363/2sA3BkdZ61#9734dfc0-2879-4cae-b4e4-029c411fafa2'}}>
          <Link
            href="https://documenter.getpostman.com/view/25586363/2sA3BkdZ61#9734dfc0-2879-4cae-b4e4-029c411fafa2"
            target="_blank"
          >
            {t('api_windowsDoc')}
          </Link>
        </Paragraph>
        <Title level={4}>{t('api.proxy')}</Title>
        <Paragraph code copyable={{text: 'https://documenter.getpostman.com/view/25586363/2sA3BkdZ61#b8af2d09-618a-4e27-9ce7-35094efee212'}}>
          <Link
            href="https://documenter.getpostman.com/view/25586363/2sA3BkdZ61#b8af2d09-618a-4e27-9ce7-35094efee212"
            target="_blank"
          >
            {t('api_proxyDoc')}
          </Link>
        </Paragraph>
      </Card>
    </>
  );
};
export default Api;
