import {Card} from 'antd';
import React from 'react';
import './index.css';
import {CommonBridge} from '#preload';
import {useEffect, useState} from 'react';
import {Divider, Typography, Form} from 'antd';

const {Title, Paragraph, Text} = Typography;

const Api = () => {
  const [apiInfo, setApiInfo] = useState({
    url: '',
    status: 'ok',
    port: undefined,
  });
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
        className="content-card p-6 "
        bordered={false}
      >
        <Title level={2}>API 详情</Title>

        <Paragraph type="secondary">
          API 作用于开发人员通过 <Text code>Puppeteer / Playwright / Selenium</Text>{' '}
          等自动化工具连接浏览器实例，执行自动化脚本，非开发人员无需使用此功能。
        </Paragraph>
        <Divider />

        <Form
          name="validate_other"
          size="large"
          labelCol={{span: 4}}
          wrapperCol={{span: 20}}
          style={{maxWidth: 600}}
        >
          <Form.Item label="接口状态">
            <Text type={apiInfo.status === 'ok' ? 'success' : 'warning'}>{apiInfo.status}</Text>
          </Form.Item>
          <Form.Item label="接口 URL">
            <Text
              type={apiInfo.status === 'ok' ? 'success' : 'warning'}
              copyable
            >
              {apiInfo.url}
            </Text>
          </Form.Item>
        </Form>
        <Divider />

        <Title level={3}>已支持接口</Title>

        <Paragraph>* 获取所有窗口列表</Paragraph>
        <Paragraph code copyable={{ text: `${apiInfo.url}/profiles` }}>
          GET /profiles
        </Paragraph>
        <Paragraph>* 根据 ID 打开指定窗口（返回值中有调试链接）</Paragraph>
        <Paragraph code copyable={{ text: `${apiInfo.url}/profiles/browser?windowId=` }}>
          GET /profiles/browser?windowId=xxx
        </Paragraph>
      </Card>
    </>
  );
};
export default Api;
