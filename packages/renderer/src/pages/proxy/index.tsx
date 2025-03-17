import type { MenuProps } from 'antd';
import {
  Badge,
  Button,
  Card,
  Dropdown,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  message,
} from 'antd';
import _, { debounce } from 'lodash';
import { useEffect, useState } from 'react';
import type { MenuInfo } from 'rc-menu/lib/interface';
import type { DB } from '../../../../shared/types/db';
import { ProxyBridge } from '#preload';
import type { SearchProps } from 'antd/es/input';
import { containsKeyword } from '/@/utils/str';
import {
  GlobalOutlined,
  MoreOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
  EyeTwoTone,
  EyeInvisibleTwoTone,
  WifiOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { PIN_URL } from '../../../../shared/constants';
import { MESSAGE_CONFIG } from '/@/constants';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WindowBridge } from '#preload';
import localeToZhMap from '../../utils/proxy_contry_to_Chinese';

type ProxyFormProps = {
  proxy_type?: string;
  ip_checker?: string;
  ip?: string;
  host?: string;
  port?: string;
  username?: string;
  password?: string;
  remark?: string;
};

type ProxyDBData = {
  // 代理的id
  id?: number | undefined;
  // 代理的ip
  ip?: string | null;
  // 代理的类型
  proxy?: string | null;
  // 代理的类型
  proxy_type?: string | null;
  // 代理的国家
  ip_country?: string | null;
  // 代理的可用性
  check_result?: string | null;
};

// 将代理的JSON 数据转换为 CSV 格式
function jsonToCsv(data: ProxyDBData[], windowDataCopy: any[]): string {
  // 如果数据为空，直接返回空字符串
  if (data.length === 0) return "";

  // 定义需要保留的列名及其对应的中文名称
  const columns = {
    id: "id",
    proxy: "代理信息",
    ip: "出口ip",
    ip_country: "代理国家",
    check_result: "是否可用",
    关联窗口: "关联窗口" 
  };

  // 提取列名并转换为数组
  const columnNames = Object.values(columns);

  // 创建一个映射表，用于快速查找窗口数据
  const windowMap = new Map<number, string[]>();
  windowDataCopy.forEach((windowItem) => {
    if (windowItem.proxy_id) {
      if (!windowMap.has(windowItem.proxy_id)) {
        windowMap.set(windowItem.proxy_id, []);
      }
      windowMap.get(windowItem.proxy_id)!.push(windowItem.name);
    }
  });

  // 转换每一行数据为 CSV 格式
  const rows = data.map((item) => {
    // 合并 proxy_type 和 proxy
    const combinedProxy = item.proxy_type ? `${item.proxy_type.toLowerCase()}://${item.proxy}` : '';

    // 替换 ip_country 的值为中文名称
    const ipCountry = item.ip_country ? localeToZhMap.get(item.ip_country) || item.ip_country : '';

    // 检查 check_result 是否包含 "connected"
    const checkResult = item.check_result ? item.check_result.includes("connected") : false;

    // 获取关联窗口的名称
    const relatedWindows = item.id !== undefined ? windowMap.get(item.id) || [] : [];
    const relatedWindowsStr = relatedWindows.join(", "); // 用逗号分隔多个窗口名称

    // 提取需要的字段并转换为数组
    const row = [
      item.id,
      combinedProxy, // 合并后的 proxy 字段
      item.ip ?? "", // 如果 ip 是 null，用空字符串代替
      ipCountry, // 替换后的 ip_country 中文字段
      checkResult, // 如果 check_result 包含 "connected"，返回 true，否则返回 false
      relatedWindowsStr // 关联窗口的名称
    ];

    // 处理特殊字符并拼接为 CSV 格式
    return row.map((value) => {
      const formattedValue = value?.toString() || '';
      if (formattedValue.includes(",") || formattedValue.includes("\n") || formattedValue.includes('"')) {
        return `"${formattedValue.replace(/"/g, '""')}"`; // 转义双引号
      }
      return formattedValue;
    }).join(",");
  });

  // 将列名和数据行拼接成 CSV 格式的字符串
  const csvString = [columnNames.join(","), ...rows].join("\n");
  return csvString;
}

const jsonData: ProxyDBData[] = [];

const Proxy = () => {
  const { t } = useTranslation();
  const OFFSET = 266;
  const [searchValue, setSearchValue] = useState('');
  const [tableScrollY, setTableScrollY] = useState(window.innerHeight - OFFSET);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedRow, setSelectedRow] = useState<DB.Proxy>();
  const [proxyData, setProxyData] = useState<DB.Proxy[]>([]);
  const [proxyDataCopy, setProxyDataCopy] = useState<DB.Proxy[]>([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [messageApi, contextHolder] = message.useMessage(MESSAGE_CONFIG);
  const [form] = Form.useForm();
  const [formValue, setFormValue] = useState<ProxyFormProps>();
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateCheckResult, setUpdateCheckResult] = useState('');
  const navigate = useNavigate();
  const [windowDataCopy, setWindowDataCopy] = useState<DB.Window[]>([]);

  // 获取所有窗口数据
  const fetchWindowData = async () => {
    const data = await WindowBridge?.getAll();
    // 更新状态
    setWindowDataCopy(data);
  };

  useEffect(() => {
    fetchWindowData();
  }, []);


  const moreActionDropdownItems: MenuProps['items'] = [
    // {
    //   key: 'export',
    //   label: 'Export',
    //   icon: <ExportOutlined />,
    // },
    // {
    //   type: 'divider',
    // },
    {
      key: 'delete',
      danger: true,
      label: t('proxy_delete'),
      icon: <DeleteOutlined />,
    },
  ];

  const recorderDropdownItems: MenuProps['items'] = [
    {
      key: 'update',
      label: t('proxy_edit'),
      icon: <EditOutlined />,
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      danger: true,
      label: t('proxy_delete'),
      icon: <DeleteOutlined />,
    },
  ];

  // 设置页面显示的行数
  const [pageSize, setPageSize] = useState(6);

  function getStatus(checking: boolean, check_result: string, index: number) {
    if (checking) return 'processing';
    const connectivity = (check_result && JSON.parse(check_result)?.connectivity) || [];
    if (!connectivity[index]?.status) return 'default';
    return connectivity[index]?.status === 'connected' ? 'success' : 'error';
  }

  const columns: ColumnsType<DB.Proxy> = [
    {
      title: 'ID',
      width: 60,
      dataIndex: 'id',
      key: 'id',
      fixed: 'left',
    },
    {
      title: 'Host',
      width: 100,
      dataIndex: 'host',
      key: 'host',
      render: (_, recorder) => (
        <Space size={12}>{recorder.proxy}</Space>
      ),
    },
    {
      title: t('proxy_column_type'),
      dataIndex: 'proxy_type',
      key: 'proxy_type',
      width: 80,
    },
    {
      title: t('proxy_column_status'),
      key: 'status',
      width: 200,
      render: (_, recorder) => (
        <Space size={12}>
          {PIN_URL?.map((m, index: number) => (
            <Badge
              key={index}
              classNames={{ indicator: `w-[8px] h-[8px] ${recorder.checking ? 'animate-ping' : ''}` }}
              status={getStatus(!!recorder.checking, recorder.check_result!, index)}
              text={m.n}
            />
          ))}
        </Space>
      ),
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 120,
      render: (_, recorder) =>
        recorder.ip ? (
          <Space size={12}>
            {recorder.ip}
            {recorder.ip_country}
          </Space>
        ) : (
          <Space size={12}>
            {recorder.check_result && JSON.parse(recorder.check_result)?.ipInfo?.ip}
            {recorder.check_result && JSON.parse(recorder.check_result)?.ipInfo?.country}
          </Space>
        ),
    },
    // {
    //   title: t('proxy_column_country'),
    //   dataIndex: 'ip_country',
    //   key: 'ip_country',
    //   width: 100,
    //   render: (_, recorder) => (
    //     <Space size={12}>
    //       {recorder.check_result && JSON.parse(recorder.check_result)?.ipInfo?.country}
    //     </Space>
    //   ),
    // },
    {
      title: t('proxy_column_remark'),
      dataIndex: 'remark',
      key: 'remark',
      width: 150,
    },
    {
      title: t('proxy_column_checker'),
      dataIndex: 'ip_checker',
      key: 'ip_checker',
      width: 150,
    },
    {
      title: '',
      key: 'operation',
      fixed: 'right',
      align: 'center',
      width: 60,
      render: (_, recorder) => (
        <Space size={24}>
          <WifiOutlined
            onClick={() => checkProxy(recorder.id)}
            className={`inline-block p-[8px] rounded-lg cursor-pointer ${recorder.checking ? 'animate-ping text-blue-500' : ''
              }`}
          />
          <Dropdown
            className="inline-block p-[8px] rounded-lg cursor-pointer"
            menu={{
              items: recorderDropdownItems,
              onClick: menuInfo => recorderAction(menuInfo, recorder),
            }}
          >
            <MoreOutlined />
          </Dropdown>
        </Space>
      ),
    },
  ];

  useEffect(() => {
    // 组件加载时从 localStorage 读取 pageSize
    const storedPageSize = localStorage.getItem('pageSizeProxy');
    if (storedPageSize) {
      setPageSize(Number(storedPageSize)); // 将字符串转换为数字
    }
    fetchProxyData();
  }, []);

  // 更新 pageSize 时保存到 localStorage
  const handlePageSizeChange = (newPage: number, newPageSize: number) => {
    setPageSize(newPageSize);
    localStorage.setItem('pageSizeProxy', newPageSize.toString()); // 保存到 localStorage
  };

  const recorderAction = (info: MenuInfo, recorder: DB.Proxy) => {
    switch (info.key) {
      case 'delete':
        setSelectedRow(recorder);
        deleteProxy();
        break;
      case 'update':
        {
          setSelectedRow(recorder);
          setUpdateCheckResult('');
          setUpdateChecking(false);
          const [host, port, username, password] = recorder?.proxy?.split(':') || [];
          if (form) {
            form.resetFields();
            form.setFieldsValue({
              proxy_type: recorder.proxy_type,
              ip_checker: recorder.ip_checker,
              host: host,
              port: port,
              username: username,
              password: password,
            });
          } else {
            setFormValue({
              proxy_type: recorder.proxy_type,
              ip_checker: recorder.ip_checker,
              ip: host,
              port: port,
              username: username,
              password: password,
            });
          }
          setUpdateModalVisible(true);
        }
        break;

      default:
        break;
    }
  };

  const onSelectChange = (newSelectedRowKeys: React.Key[]) => {
    setSelectedRowKeys(newSelectedRowKeys as number[]);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const moreAction = (info: MenuInfo) => {
    switch (info.key) {
      case 'delete':
        setSelectedRow(undefined);
        deleteProxy();
        break;

      default:
        break;
    }
  };

  useEffect(() => {
    const handleResize = _.debounce(() => {
      setTableScrollY(window.innerHeight - OFFSET);
    }, 200);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 获取所有代理数据
  const fetchProxyData = async () => {
    // 设置加载状态为 true，表示正在加载数据
    setLoading(true);
    // 从 ProxyBridge 获取所有代理数据，等待异步操作完成
    const data = await ProxyBridge?.getAll();

    // 直接修改 data 数组中的每个对象的国家改成中文
    const updatedData = data.map((item: DB.Window) => ({
      ...item,
      ip_country: item.ip_country ? localeToZhMap.get(item.ip_country) || item.ip_country : ''
    }));

    // 将获取到的代理数据设置到状态中
    setProxyData(updatedData);
    // 复制代理数据到另一个状态，以便后续使用
    setProxyDataCopy(updatedData);
    // 设置加载状态为 false，表示数据加载完成
    setLoading(false);
  };

  const onSearch: SearchProps['onSearch'] = (value: string) => {
    if (value) {
      const keyword = value.toLowerCase();
      setProxyData(
        [...proxyDataCopy].filter(
          f =>
            containsKeyword(f.ip_country, keyword) ||
            containsKeyword(f.proxy, keyword) ||
            containsKeyword(f.ip, keyword) ||
            containsKeyword(f.proxy_type, keyword),
        ),
      );
    } else {
      fetchProxyData();
    }
  };

  const debounceSearch = debounce(value => {
    onSearch(value);
  }, 500);

  const handleSearchValueChange = (value: string) => {
    setSearchValue(value.trim());
    debounceSearch(value.trim());
  };

  const checkProxy = async (id?: number) => {
    if (id) {
      toggleCheckingStatus(true, id);
      const testResult = await ProxyBridge?.checkProxy(id);
      toggleCheckingStatus(false, id, testResult);
    } else {
      for (let index = 0; index < selectedRowKeys.length; index++) {
        const key = selectedRowKeys[index];
        toggleCheckingStatus(true, key);
        const testResult = await ProxyBridge?.checkProxy(key);
        toggleCheckingStatus(false, key, testResult);
      }
    }
  };

  const toggleCheckingStatus = (checking: boolean, id?: number, testResult?: string) => {
    setProxyData(
      [...proxyData].map(m => {
        if (id) {
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

  const onDeleteModalOk = async () => {
    const ids = selectedRow ? [selectedRow.id!] : selectedRowKeys;
    const result = await ProxyBridge?.batchDelete(ids);
    if (!result.success) {
      messageApi.error(result.message, result?.referencedIds?.join(', '));
    }
    setDeleteModalVisible(false);
    await fetchProxyData();
  };

  const onDeleteModalCancel = () => {
    setDeleteModalVisible(false);
  };

  const deleteProxy = () => {
    setDeleteModalVisible(true);
  };

  const newProxy = async () => {
    navigate('/proxy/import');
  };

  const onUpdateModalOk = async () => {
    form.validateFields().then(async values => {
      const proxy: DB.Proxy = {
        id: selectedRow?.id,
        proxy_type: values.proxy_type,
        ip_checker: values.ip_checker,
        // host: values.host,
        proxy:
          `${values.host}:${values.port}` +
          (values.username ? `:${values.username}:${values.password}` : ''),
        remark: values.remark,
      };
      const result = await ProxyBridge?.update(proxy.id!, proxy);
      if (!result) {
        messageApi.error('Failed to update proxy');
      } else {
        messageApi.success('Proxy updated successfully');
        setUpdateModalVisible(false);
        await fetchProxyData();
      }
    });
  };

  const onUpdateModalCancel = () => {
    setUpdateModalVisible(false);
  };

  const onUpdateModalCheck = () => {
    setUpdateChecking(true);
    form.validateFields().then(async values => {
      const testResult = await ProxyBridge?.checkProxy({
        proxy_type: values.proxy_type,
        ip_checker: values.ip_checker,
        host: values.host,
        proxy:
          `${values.host}:${values.port}` +
          (values.username ? `:${values.username}:${values.password}` : ''),
      });
      setUpdateCheckResult(JSON.stringify(testResult));
      setUpdateChecking(false);
    });
  };

  return (
    <>
      <div className="content-toolbar">
        {contextHolder}
        <Space size={16}>
          <Input
            value={searchValue}
            className="content-toolbar-search"
            placeholder="Search"
            onChange={e => handleSearchValueChange(e.target.value)}
            prefix={<SearchOutlined />}
          />
          <Button
            icon={<WifiOutlined />}
            onClick={() => checkProxy()}
            type="primary"
          >
            {t('proxy_check')}
          </Button>
          <Button
            type="default"
            onClick={async () => {
              await fetchProxyData();
              messageApi.success('Refreshed successfully');
            }}
            icon={<SyncOutlined />}
          >
            {t('refresh')}
          </Button>
        </Space>
        <Space
          size={8}
          className="content-toolbar-btns"
        >
          <Button
            icon={<GlobalOutlined />}
            onClick={() => newProxy()}
            type="primary"
          >
            {t('proxy_new_proxy')}
          </Button>
          <Button
            onClick={() => {
              console.log('proxyDataCopy', proxyDataCopy);

              // 导出代理数据

              console.log('windowDataCopy', windowDataCopy);
              const csvData = jsonToCsv(proxyDataCopy, windowDataCopy);
              const blob = new Blob([csvData], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'proxy_data.csv';
              a.click();
            }}
            type="primary"
          >
            导出代理
          </Button>
          <Dropdown
            menu={{
              items: moreActionDropdownItems,
              onClick: menuInfo => moreAction(menuInfo),
            }}
          >
            <Button
              type="default"
              className="rotate-90 font-black"
              icon={<MoreOutlined />}
            ></Button>
          </Dropdown>
        </Space>
      </div>
      <Card
        className="content-card"
        bordered={false}
      >
        <Table
          className="content-table"
          columns={columns}
          rowKey={'id'}
          loading={loading}
          rowSelection={rowSelection}
          dataSource={proxyData}
          scroll={{ x: 1500, y: tableScrollY }}
          pagination={{
            rootClassName: 'pagination-wrapper',
            pageSize: pageSize,
            pageSizeOptions: [6,8,12,50,100,500],
            showSizeChanger: true,
            onChange: handlePageSizeChange, // 改变页面显示的行数
          }}
        />
      </Card>
      <Modal
        title={
          <>
            <ExclamationCircleFilled
              style={{ color: '#faad14', fontSize: '22px', marginRight: '12px' }}
            ></ExclamationCircleFilled>
            <span>Delete IPs</span>
          </>
        }
        open={deleteModalVisible}
        centered
        onOk={onDeleteModalOk}
        onCancel={onDeleteModalCancel}
        closable={false}
        okText="Confirm"
        cancelText="Cancel"
      >
        <div className="pl-[36px]">
          <div>Are you sure you want to delete the selected IPs?</div>
        </div>
      </Modal>
      <Modal
        title="Update Proxy"
        open={updateModalVisible}
        centered
        width={560}
        onOk={onUpdateModalOk}
        onCancel={onUpdateModalCancel}
        closable={true}
        footer={[
          (updateChecking || updateCheckResult) && (
            <Space
              key="status"
              size={12}
              className="mr-4"
            >
              {PIN_URL?.map((m, index: number) => (
                <Badge
                  key={index}
                  classNames={{
                    indicator: `w-[8px] h-[8px] ${updateChecking ? 'animate-ping' : ''}`,
                  }}
                  status={getStatus(updateChecking, updateCheckResult, index)}
                  text={m.n}
                />
              ))}
            </Space>
          ),

          <Button
            key="check"
            loading={updateChecking}
            onClick={onUpdateModalCheck}
            type="link"
          >
            Check
          </Button>,
          <Button
            key="back"
            onClick={onUpdateModalCancel}
            type="default"
          >
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={onUpdateModalOk}
          >
            Save
          </Button>,
        ]}
        okText="Save"
        cancelText="Cancel"
      >
        <div className="pr-16 pt-4">
          {/* Proxy Update Form */}
          <Form
            layout="horizontal"
            form={form}
            size="large"
            initialValues={formValue}
            labelCol={{ span: 6 }}
          >
            <Form.Item<ProxyFormProps>
              label="Proxy Type"
              name="proxy_type"
              rules={[{ required: true, message: 'Please Select Proxy Type!' }]}
            >
              <Select
                options={[
                  { label: 'Socks5', value: 'socks5' },
                  { label: 'Http', value: 'http' },
                ]}
              />
            </Form.Item>
            <Form.Item<ProxyFormProps>
              label="IP Checker"
              name="ip_checker"
              rules={[{ required: true, message: 'Please Select IP Checker!' }]}
            >
              <Select
                options={[
                  { label: 'Ip2Location', value: 'ip2location' },
                  { label: 'GeoIp', value: 'geoip' },
                ]}
              />
            </Form.Item>
            <Form.Item<ProxyFormProps>
              label="Host"
              name="host"
              rules={[{ required: true, message: 'Please input IP!' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item<ProxyFormProps>
              label="Port"
              name="port"
              rules={[{ required: true, message: 'Please input Port!' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item<ProxyFormProps>
              label="Username"
              name="username"
            >
              <Input />
            </Form.Item>
            <Form.Item<ProxyFormProps>
              label="Password"
              name="password"
            >
              <Input.Password
                iconRender={visible => (visible ? <EyeTwoTone /> : <EyeInvisibleTwoTone />)}
              />
            </Form.Item>
            <Form.Item<ProxyFormProps>
              label="Remark"
              name="remark"
            >
              <Input.TextArea style={{ height: 120, resize: 'none' }} />
            </Form.Item>
          </Form>
        </div>
      </Modal>
      <div className="content-footer"></div>
    </>
  );
};
export default Proxy;
