import {Button, Card, Input, Space, message, Typography, Row, Col, Table, Badge} from 'antd';
import './index.css';
import {useEffect, useState} from 'react';
import type {DB} from '../../../../../shared/types/db';
import {useNavigate} from 'react-router-dom';
import {MESSAGE_CONFIG} from '/@/constants';
import type {ColumnsType} from 'antd/es/table';
import {ProxyBridge} from '#preload';
import _ from 'lodash';
import {PIN_URL} from '../../../../../shared/constants';
import {useTranslation} from 'react-i18next';

const {Text} = Typography;

interface ProxyImportProps {
  id: number;
  type: string;
  ip?: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  remark?: string;
  checking?: boolean;
  check_result?: string;
}

const ProxyImportFooter = ({proxies}: {proxies: DB.Proxy[]}) => {
  const navigate = useNavigate();
  const {t} = useTranslation();
  const [messageApi, contextHolder] = message.useMessage(MESSAGE_CONFIG);
  const [loading, setLoading] = useState(false);
  const back = () => {
    history.back();
  };

  const handleOk = () => {
    setLoading(true);
    messageApi.open({type: 'loading', content: 'Importing...', key: 'import'}).then(async () => {
      const createdIds = await ProxyBridge?.import(proxies);
      if (createdIds.length) {
        messageApi
          .open({
            type: 'success',
            content: `Imported successfully, will be automatically jumped after ${MESSAGE_CONFIG.duration}s`,
            key: 'import',
          })
          .then(() => navigate('/proxy'));
      } else {
        messageApi.open({
          type: 'error',
          content: 'Import failed, please try again',
          key: 'import',
        });
      }
    });
  };

  return (
    <>
      {contextHolder}
      <div className="content-footer">
        <Space
          className="pl-24"
          size={16}
        >
          <Button
            loading={loading}
            type="primary"
            className="w-20"
            onClick={() => handleOk()}
          >
            {t('footer_ok')}
          </Button>
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

const ProxyImport = () => {
  const OFFSET = 624;
  const {t} = useTranslation();
  const [importData, setImportData] = useState<ProxyImportProps[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [tableScrollY, setTableScrollY] = useState(window.innerHeight - OFFSET);
  const [checking, setChecking] = useState(false);
  const columns: ColumnsType<ProxyImportProps> = [
    {
      title: t('proxy_import_column_type'),
      width: 120,
      dataIndex: 'type',
    },
    {
      title: t('proxy_import_column_host'),
      width: 160,
      dataIndex: 'host',
    },
    {
      title: t('proxy_import_column_port'),
      width: 80,
      dataIndex: 'port',
    },
    {
      title: t('proxy_import_column_username'),
      width: 160,
      dataIndex: 'username',
    },
    {
      title: t('proxy_import_column_password'),
      width: 160,
      dataIndex: 'password',
    },
    {
      title: t('proxy_import_column_remark'),
      dataIndex: 'remark',
    },
    {
      title: t('proxy_import_column_status'),
      key: 'status',
      width: 280,
      render: (_, recorder) => (
        <Space size={12}>
          {PIN_URL?.map((m, index: number) => (
            <Badge
              key={index}
              classNames={{indicator: `w-[8px] h-[8px] ${recorder.checking ? 'animate-ping' : ''}`}}
              status={getStatus(recorder, index)}
              text={m.n}
            />
          ))}
        </Space>
      ),
    },
  ];

  function getStatus(recorder: DB.Proxy, index: number) {
    if (recorder.checking) return 'processing';
    const connectivity =
      (recorder.check_result && JSON.parse(recorder.check_result)?.connectivity) || [];
    if (!connectivity[index]?.status) return 'default';
    return connectivity[index]?.status === 'connected' ? 'success' : 'error';
  }

  useEffect(() => {
    const handleResize = _.debounce(() => {
      setTableScrollY(window.innerHeight - OFFSET); // Note: Adjust SOME_OFFSET based on your design
    }, 200);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const parseProxy = (proxy: string, index: number) => {
    let type = 'HTTP'; // 默认类型
    let host = '',
      port = 0,
      username = '',
      password = '',
      remark = '';

    const proxyLower = proxy.toLowerCase();

    if (proxyLower.startsWith('socks5://')) {
      type = 'SOCKS5';
      proxy = proxy.substring(9);
    } else if (proxyLower.startsWith('http://')) {
      proxy = proxy.substring(7);
    }

    // 如果存在，提取备注
    const remarkIndex = proxy.indexOf('{');
    if (remarkIndex !== -1) {
      remark = proxy.substring(remarkIndex + 1, proxy.length - 1);
      proxy = proxy.substring(0, remarkIndex).trim();
    }

    // 调整正则表达式以使用户名和密码可选
    const proxyRegex = /^([a-zA-Z0-9.-]+):(\d{1,5})(?::([a-zA-Z0-9-]*):([a-zA-Z0-9]*))?$/;

    if (!proxyRegex.test(proxy)) {
      throw new Error('无效的代理格式');
    }

    const parts = proxy.match(proxyRegex);

    host = parts?.[1] || '';
    port = Number(parts?.[2] || '');

    if (parts?.[3] && parts[4]) {
      username = parts[3];
      password = parts[4];
    }

    return {
      id: index,
      type,
      host,
      port,
      username,
      password,
      remark,
    };
  };

  const transformProxy = (proxy: ProxyImportProps) => {
    const {type, host, port, username, password, remark} = proxy;
    return {
      proxy_type: type,
      proxy: `${host}:${port}` + (username ? `:${username}:${password}` : ''),
      remark: remark,
      ip_checker: 'ip2location',
    } as DB.Proxy;
  };

  const onTextAreaBlur = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (e) {
      e.preventDefault();
    }
    const proxies = inputValue.split('\n');
    setImportData(proxies.filter(f => f.trim()).map((proxy, index) => parseProxy(proxy, index)));
  };

  const toggleCheckingStatus = (checking: boolean, id?: number, testResult?: string) => {
    setImportData(
      [...importData].map(m => {
        if (id !== undefined) {
          if (m.id === id) {
            m.checking = checking;
            if (testResult) {
              m.check_result = JSON.stringify(testResult);
            }
          }
        }
        return m;
      }),
    );
  };

  const testAll = async () => {
    setChecking(true);
    for (let index = 0; index < importData.length; index++) {
      const proxy = importData[index];
      toggleCheckingStatus(true, index);
      const result = await ProxyBridge?.checkProxy(transformProxy(proxy));
      toggleCheckingStatus(false, index, result);
    }
    setChecking(false);
  };

  return (
    <>
      <Card className="proxy-detail-card">
        <Row gutter={18}>
          <Col span={12}>
            <Card
              className="bg-blue-50 select-text	h-[300px]"
              rootClassName="overflow-auto"
              bodyStyle={{padding: '12px 16px'}}
            >
              <Space
                direction="vertical"
                size={4}
              >
                {t('proxy_import_tip')
                  .split('\n')
                  .map((item, index) => {
                    return (
                      <Text
                        className="break-keep"
                        key={index}
                      >
                        {item}
                      </Text>
                    );
                  })}
              </Space>
            </Card>
          </Col>
          <Col span={12}>
            <Input.TextArea
              className="h-full"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onBlur={e => onTextAreaBlur(e)}
            ></Input.TextArea>
          </Col>
        </Row>
        <Space
          className="my-4"
          size={16}
        >
          <Button
            type="primary"
            loading={checking}
            onClick={() => testAll()}
          >
            {t('proxy_check_all')}
          </Button>
          <Text>{`${t('proxy_total')}: ${importData.length}`}</Text>
        </Space>
        <Table
          columns={columns}
          rowKey={'id'}
          pagination={false}
          dataSource={importData}
          scroll={{y: tableScrollY}}
        ></Table>
      </Card>
      <ProxyImportFooter proxies={importData.map(proxy => transformProxy(proxy))} />
    </>
  );
};

export default ProxyImport;
