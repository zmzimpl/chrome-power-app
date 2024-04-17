import {Card} from 'antd';
import React from 'react';
import './index.css';
import {CommonBridge} from '#preload';
import {useEffect, useState} from 'react';
import {Divider, Typography, Form} from 'antd';

const {Title, Paragraph, Text, Link} = Typography;

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
        className="content-card api-container-card p-6 "
        bordered={false}
      >
        <Title level={2}>
          API 详情{' '}
          <Link
            href="https://documenter.getpostman.com/view/25586363/2sA3BkdZ61#intro"
            target="_blank"
          >
            查看 API 文档
          </Link>
        </Title>

        <Paragraph type="secondary">
          API 作用于开发人员通过 <Text code>Puppeteer / Playwright / Selenium</Text>{' '}
          等自动化工具连接浏览器实例，执行自动化脚本，非开发人员无需使用此功能。
        </Paragraph>
        <Divider />

        <Form
          name="validate_other"
          size="small"
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
        <Title level={4}>控制开启/关闭</Title>
        <Paragraph>* 获取所有 Profiles 列表</Paragraph>
        <Paragraph
          code
          copyable={{text: `${apiInfo.url}/profiles`}}
        >
          GET /profiles
        </Paragraph>
        <Paragraph>* 根据 ID 打开指定 Profiles（返回值中有调试链接）</Paragraph>
        <Paragraph
          code
          copyable={{text: `${apiInfo.url}/profiles/open?windowId=`}}
        >
          GET /profiles/open?windowId=xxx
        </Paragraph>
        <Paragraph>* 根据 ID 关闭指定 Profiles</Paragraph>
        <Paragraph
          code
          copyable={{text: `${apiInfo.url}/profiles/close?windowId=`}}
        >
          GET /profiles/close?windowId=xxx
        </Paragraph>
        <Title level={4}>Windows CRUD</Title>
        <Paragraph code>
          <Link
            href="https://documenter.getpostman.com/view/25586363/2sA3BkdZ61#9734dfc0-2879-4cae-b4e4-029c411fafa2"
            target="_blank"
          >
            详情文档
          </Link>
        </Paragraph>
        <Title level={4}>代理 CRUD</Title>
        <Paragraph code>
          <Link
            href="https://documenter.getpostman.com/view/25586363/2sA3BkdZ61#b8af2d09-618a-4e27-9ce7-35094efee212"
            target="_blank"
          >
            详情文档
          </Link>
        </Paragraph>
      </Card>
    </>
  );
};
export default Api;
