import type {MenuProps} from 'antd';
import {
  Button,
  Card,
  Dropdown,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Row,
  Col,
  Typography,
  message,
} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import type {MenuInfo} from 'rc-menu/lib/interface';
import {useEffect, useMemo, useState} from 'react';
import _, {debounce} from 'lodash';

import {
  CloseOutlined,
  // SendOutlined,
  ChromeOutlined,
  MoreOutlined,
  SearchOutlined,
  EditOutlined,
  GlobalOutlined,
  DeleteOutlined,
  SyncOutlined,
  UsergroupAddOutlined,
  // ExportOutlined,
  ExclamationCircleFilled,
} from '@ant-design/icons';
import type {DB} from '../../../../shared/types/db';
import {GroupBridge, ProxyBridge, TagBridge, WindowBridge} from '#preload';
import type {SearchProps} from 'antd/es/input';
import {containsKeyword} from '/@/utils/str';
import {useNavigate} from 'react-router-dom';
import {MESSAGE_CONFIG, WINDOW_STATUS} from '/@/constants';
import {useTranslation} from 'react-i18next';

const {Text} = Typography;

const Windows = () => {
  const OFFSET = 266;
  const [searchValue, setSearchValue] = useState(''); // Note: Set SOME_OFFSET based on your design
  const [tableScrollY, setTableScrollY] = useState(window.innerHeight - OFFSET); // Note: Set SOME_OFFSET based on your design
  const {t, i18n} = useTranslation();
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRow, setSelectedRow] = useState<DB.Window>();
  const [windowData, setWindowData] = useState<DB.Window[]>([]);
  const [windowDataCopy, setWindowDataCopy] = useState<DB.Window[]>([]);
  const [groupOptions, setGroupOptions] = useState<DB.Group[]>([{id: -1, name: 'All'}]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [tagMap, setTagMap] = useState(new Map<number, DB.Tag>());
  const [messageApi, contextHolder] = message.useMessage(MESSAGE_CONFIG);
  const [proxySettingVisible, setProxySettingVisible] = useState(false);
  const [proxies, setProxies] = useState<DB.Proxy[]>([]);
  const [selectedProxy, setSelectedProxy] = useState<number>();
  const navigate = useNavigate();

  const moreActionDropdownItems: MenuProps['items'] = [
    // {
    //   key: 'group',
    //   label: 'Switching Group',
    //   icon: <SendOutlined />,
    // },
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
      label: t('window_delete'),
      icon: <DeleteOutlined />,
    },
  ];
  const recorderDropdownItems: MenuProps['items'] = [
    {
      key: 'edit',
      label: t('window_edit'),
      icon: <EditOutlined />,
    },
    {
      key: 'proxy',
      label: t('window_proxy_setting'),
      icon: <GlobalOutlined />,
    },
    // {
    //   key: 'set-cookie',
    //   label: t('window_set_cookie'),
    //   icon: <UsergroupAddOutlined />,
    // },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      danger: true,
      label: t('window_delete'),
      icon: <DeleteOutlined />,
    },
  ];
  const columns: ColumnsType<DB.Window> = useMemo(() => {
    return [
      {
        title: 'ID',
        width: 60,
        dataIndex: 'id',
        key: 'id',
        fixed: 'left',
      },
      {
        title: t('window_column_profile_id'),
        width: 100,
        dataIndex: 'profile_id',
        key: 'profile_id',
        fixed: 'left',
      },
      {
        title: t('window_column_group'),
        width: 100,
        dataIndex: 'group_name',
        key: 'group_name',
        // fixed: 'left',
      },
      {
        title: t('window_column_name'),
        width: 100,
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: t('window_column_remark'),
        dataIndex: 'remark',
        key: 'remark',
        width: 150,
      },
      {
        title: t('window_column_tags'),
        dataIndex: 'tags',
        key: 'tags',
        width: 150,
        render: (_, recorder) => (
          <>
            {recorder.tags &&
              recorder.tags.toString().split(',').map(tagId => {
                const tag = tagMap.get(Number(tagId));
                return (
                  <Tag
                    key={tagId}
                    color={tag?.color}
                  >
                    {tag?.name}
                  </Tag>
                );
              })}
          </>
        ),
      },
      {
        title: t('window_column_proxy'),
        dataIndex: 'proxy',
        key: 'proxy',
        width: 350,
      },
      {
        title: t('window_column_last_open'),
        dataIndex: 'opened_at',
        key: 'opened_at',
        width: 150,
        render: value => {
          if (!value) return '';
          const utcDate = new Date(value + 'Z');

          const localDateStr = utcDate.toLocaleString();
          return localDateStr;
        },
      },
      {
        title: t('window_column_created_at'),
        dataIndex: 'created_at',
        key: 'created_at',
        width: 150,
        render: value => {
          const utcDate = new Date(value + 'Z');

          const localDateStr = utcDate.toLocaleString();
          return localDateStr;
        },
      },
      {
        title: t('window_column_action'),
        key: 'operation',
        fixed: 'right',
        width: 120,
        align: 'center',
        render: (_, recorder) => (
          <Button
            icon={<ChromeOutlined />}
            disabled={
              recorder.status === WINDOW_STATUS.RUNNING ||
              recorder.status === WINDOW_STATUS.PREPARING
            }
            type="primary"
            onClick={() => openWindows(recorder.id)}
          >
            {recorder.status === 1
              ? t('window_open')
              : recorder.status === 2
              ? t('window_running')
              : t('window_preparing')}
          </Button>
        ),
      },
      {
        title: '',
        key: 'operation',
        fixed: 'right',
        align: 'center',
        width: 40,
        render: (_, recorder) => (
          <Dropdown
            className="cursor-pointer"
            menu={{
              items: recorderDropdownItems,
              onClick: menuInfo => recorderAction(menuInfo, recorder),
            }}
          >
            <MoreOutlined />
          </Dropdown>
        ),
      },
    ];
  }, [tagMap, i18n.language]);

  const onSelectChange = (newSelectedRowKeys: React.Key[]) => {
    setSelectedRowKeys(newSelectedRowKeys as number[]);
  };
  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const fetchWindowData = async () => {
    setLoading(true);
    const data = await WindowBridge?.getAll();
    console.log(data);
    setWindowData(data);
    setWindowDataCopy(data);
    setLoading(false);
    setSelectedRowKeys([]);
    setSelectedRow(undefined);
  };

  const fetchTagData = async () => {
    const data = await TagBridge?.getAll();
    const newTagMap = new Map<number, DB.Tag>();
    data?.forEach((tag: DB.Tag) => {
      newTagMap.set(tag.id!, tag);
    });
    setTagMap(newTagMap);
  };

  const fetchGroupData = async () => {
    const data = await GroupBridge?.getAll();
    data.splice(0, 0, {id: -1, name: 'All'});
    setGroupOptions(data);
  };

  const fetchProxies = async () => {
    const proxies = await ProxyBridge?.getAll();
    setProxies(
      proxies.map((proxy: DB.Proxy) => {
        return {
          host: proxy.proxy?.split(':')[0] ?? proxy.id,
          ...proxy,
        };
      }),
    );
  };

  const moreAction = (info: MenuInfo) => {
    switch (info.key) {
      case 'delete':
        setSelectedRow(undefined);
        deleteWindows();
        break;

      default:
        break;
    }
  };

  useEffect(() => {
    fetchTagData();
    fetchProxies();
    fetchGroupData();
    fetchWindowData();
  }, []);

  useEffect(() => {
    const handleWindowClosed = (_: Electron.IpcRendererEvent, id: number) => {
      setWindowData(windowData =>
        windowData.map(window => (window.id === id ? {...window, status: 1} : window)),
      );
    };

    const handleWindowOpened = (_: Electron.IpcRendererEvent, id: number) => {
      if (id) {
        setWindowData(windowData =>
          windowData.map(window => (window.id === id ? {...window, status: 2} : window)),
        );
      } else {
        messageApi.error('Failed to open window');
      }
    };
    WindowBridge?.offWindowClosed(handleWindowClosed);
    WindowBridge?.offWindowOpened(handleWindowOpened);

    WindowBridge?.onWindowClosed(handleWindowClosed);
    WindowBridge?.onWindowOpened(handleWindowOpened);

    return () => {
      WindowBridge?.offWindowClosed(handleWindowClosed);
      WindowBridge?.offWindowOpened(handleWindowOpened);
    };
  }, []);

  const closeWindows = async (id?: number) => {
    setLoading(true);
    if (id) {
      await WindowBridge?.close(id);
      setLoading(false);
    } else {
      for (let index = 0; index < selectedRowKeys.length; index++) {
        const rowKey = selectedRowKeys[index];
        await WindowBridge?.close(rowKey);
      }
      fetchWindowData();
    }
  };

  const openWindows = async (id?: number) => {
    setLoading(true);
    if (id) {
      await WindowBridge?.open(id);
      setLoading(false);
    } else {
      for (let index = 0; index < selectedRowKeys.length; index++) {
        const rowKey = selectedRowKeys[index];
        await WindowBridge?.open(rowKey);
      }
      setLoading(false);
    }
  };

  const deleteWindows = () => {
    setDeleteModalVisible(true);
  };

  const onDeleteModalOk = async () => {
    const ids = selectedRow ? [selectedRow.id!] : selectedRowKeys;
    try {
      setLoading(true);
      await WindowBridge?.batchDelete(ids);
      setDeleteModalVisible(false);
      await fetchWindowData();
      messageApi.success('Deleted successfully');
      setLoading(false);
    } catch (error) {
      messageApi.error('Failed to delete');
    }
  };

  const onDeleteModalCancel = () => {
    setDeleteModalVisible(false);
  };

  const setCookie = async (window: DB.Window) => {
    const result = await WindowBridge.toogleSetCookie(window.id!);
    messageApi.open({
      type: result.success ? 'success' : 'error',
      content: result.message,
    });
  };

  const recorderAction = async (info: MenuInfo, recorder: DB.Window) => {
    switch (info.key) {
      case 'delete':
        setSelectedRow(recorder);
        deleteWindows();
        break;
      case 'edit':
        navigate(`/window/edit?id=${recorder.id}`);
        break;
      case 'proxy':
        setSelectedRow(recorder);
        setSelectedProxy(recorder.proxy_id ?? undefined);
        setProxySettingVisible(true);
        break;
      case 'set-cookie':
        setSelectedRow(recorder);
        await setCookie(recorder);
        break;

      default:
        break;
    }
  };

  const handleProxySettingSave = async () => {
    if (selectedRow) {
      await WindowBridge?.update(selectedRow.id!, {proxy_id: selectedProxy ? selectedProxy : null});
      setProxySettingVisible(false);
      messageApi.success('Update proxy successfully');
      fetchWindowData();
    }
  };

  useEffect(() => {
    const handleResize = _.debounce(() => {
      setTableScrollY(window.innerHeight - OFFSET); // Note: Adjust SOME_OFFSET based on your design
    }, 200);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleGroupChange = (value: number) => {
    if (value > -1) {
      setWindowData(
        [...windowDataCopy].filter(
          f => f.group_id === value, // Changed this line for tag check
        ),
      );
    } else {
      fetchWindowData();
    }
  };

  const onSearch: SearchProps['onSearch'] = (value: string) => {
    if (value) {
      const keyword = value.toLowerCase();
      setWindowData(
        [...windowDataCopy].filter(
          f =>
            containsKeyword(f.group_name, keyword) ||
            containsKeyword(f.name, keyword) ||
            containsKeyword(f.id, keyword) ||
            containsKeyword(f.ip, keyword) ||
            containsKeyword(f.profile_id, keyword) ||
            containsKeyword(f.proxy, keyword) ||
            (f.tags &&
              (f.tags instanceof Array &&
              f.tags.some(tag => containsKeyword(tagMap.get(tag)?.name, keyword)) ||
              f.tags.toString().split(',').some(tag => containsKeyword(tagMap.get(Number(tag))?.name, keyword)))), // Changed this line for tag check
        ),
      );
    } else {
      fetchWindowData();
    }
  };

  const debounceSearch = debounce(value => {
    onSearch(value);
  }, 500);

  const handleSearchValueChange = (value: string) => {
    setSearchValue(value.trim());
    debounceSearch(value.trim());
  };

  const filterProxyOption = (input: string, option?: DB.Proxy) => {
    return (
      (option?.ip ?? '').toLowerCase().includes(input.toLowerCase()) ||
      (option?.proxy ?? '').toLowerCase().includes(input.toLowerCase()) ||
      (option?.remark ?? '').toLowerCase().includes(input.toLowerCase())
    );
  };

  return (
    <>
      <div className="content-toolbar">
        {contextHolder}
        <Space size={16}>
          <Select
            defaultValue={-1}
            defaultActiveFirstOption={true}
            style={{width: 120}}
            fieldNames={{value: 'id', label: 'name'}}
            onChange={handleGroupChange}
            options={groupOptions}
          />
          <Input
            value={searchValue}
            className="content-toolbar-search"
            placeholder="Search"
            onChange={e => handleSearchValueChange(e.target.value)}
            prefix={<SearchOutlined />}
          />
          <Button
            type="default"
            className="font-black"
            onClick={async () => {
              await fetchWindowData();
              messageApi.success('Refreshed successfully');
            }}
            icon={<SyncOutlined />}
          ></Button>
        </Space>
        <Space
          size={8}
          className="content-toolbar-btns"
        >
          <Button
            icon={<ChromeOutlined />}
            onClick={() => openWindows()}
            type="primary"
          >
            {t('window_open')}
          </Button>
          <Button
            type="default"
            onClick={() => closeWindows()}
            icon={<CloseOutlined />}
          >
            {t('window_close')}
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
          dataSource={windowData}
          scroll={{x: 1500, y: tableScrollY}}
          pagination={{rootClassName: 'pagination-wrapper'}}
        />
      </Card>
      <Modal
        title={
          <>
            <ExclamationCircleFilled
              style={{color: '#faad14', fontSize: '22px', marginRight: '12px'}}
            ></ExclamationCircleFilled>
            <span>Delete Windows</span>
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
          <div>
            The current operation will keep the local cache, if you want to delete the local cache,
            please go to the cache directory to delete manually.
          </div>
        </div>
      </Modal>
      <Modal
        open={proxySettingVisible}
        centered
        title="Proxy Setting"
        onOk={handleProxySettingSave}
        onCancel={setProxySettingVisible.bind(null, false)}
        footer={[
          <Button
            key="back"
            onClick={setProxySettingVisible.bind(null, false)}
          >
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={loading}
            onClick={handleProxySettingSave}
          >
            Save
          </Button>,
        ]}
      >
        <Select
          placeholder="Proxy"
          options={proxies}
          size="large"
          className="w-full"
          value={selectedProxy}
          showSearch
          allowClear
          onChange={(value: number) => {
            setSelectedProxy(value);
          }}
          filterOption={filterProxyOption}
          fieldNames={{label: 'proxy', value: 'id'}}
          optionRender={option => {
            return (
              <Row justify="space-between">
                <Col span={2}>
                  <Text code>#{option.data.id}</Text>
                </Col>

                <Col span={16}>
                  <Space direction="vertical">
                    <Text
                      style={{width: 300}}
                      ellipsis={{tooltip: `${option.data.proxy}  ${option.data.remark}`}}
                    >
                      {option.data.proxy}
                    </Text>
                    {option.data.remark && (
                      <Text
                        mark
                        style={{width: 300}}
                        ellipsis={{tooltip: `${option.data.proxy}  ${option.data.remark}`}}
                      >
                        {option.data.remark}
                      </Text>
                    )}
                  </Space>
                </Col>
                <Col span={1}>
                  <span
                    role="img"
                    aria-label={option.data.proxy}
                  >
                    {option.data.usageCount}
                  </span>
                </Col>
              </Row>
            );
          }}
        ></Select>
      </Modal>
      <div className="content-footer"></div>
    </>
  );
};
export default Windows;
