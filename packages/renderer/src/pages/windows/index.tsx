import type {MenuProps} from 'antd';
import {Button, Card, Dropdown, Input, Modal, Select, Space, Table, Tag, message} from 'antd';
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
  // ExportOutlined,
  ExclamationCircleFilled,
} from '@ant-design/icons';
import type {DB} from '../../../../shared/types/db';
import {CommonBridge, GroupBridge, ProxyBridge, TagBridge, WindowBridge} from '#preload';
import type {SearchProps} from 'antd/es/input';
import {containsKeyword} from '/@/utils/str';
import {useNavigate} from 'react-router-dom';
import {MESSAGE_CONFIG, WINDOW_STATUS} from '/@/constants';
import {setMembership} from '/@/slices/user-slice';
import {useDispatch} from 'react-redux';
import api from '../../../../shared/api/api';

const Windows = () => {
  const OFFSET = 266;
  const [searchValue, setSearchValue] = useState(''); // Note: Set SOME_OFFSET based on your design
  const [tableScrollY, setTableScrollY] = useState(window.innerHeight - OFFSET); // Note: Set SOME_OFFSET based on your design
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
  const dispatch = useDispatch();

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
      label: 'Delete',
      icon: <DeleteOutlined />,
    },
  ];
  const recorderDropdownItems: MenuProps['items'] = [
    {
      key: 'update',
      label: 'Update',
      icon: <EditOutlined />,
    },
    {
      key: 'proxy',
      label: 'Proxy Setting',
      icon: <GlobalOutlined />,
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      danger: true,
      label: 'Delete',
      icon: <DeleteOutlined />,
    },
  ];
  const columns: ColumnsType<DB.Window> = useMemo(() => {
    return [
      {
        title: '#',
        width: 60,
        dataIndex: 'id',
        key: 'id',
        fixed: 'left',
      },
      {
        title: 'Profile Id',
        width: 100,
        dataIndex: 'profile_id',
        key: 'profile_id',
        fixed: 'left',
      },
      {
        title: 'Group',
        width: 100,
        dataIndex: 'group_name',
        key: 'group_name',
        // fixed: 'left',
      },
      {
        title: 'Name',
        width: 100,
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: 'Remark',
        dataIndex: 'remark',
        key: 'remark',
        width: 150,
      },
      {
        title: 'Tags',
        dataIndex: 'tags',
        key: 'tags',
        width: 150,
        render: (_, recorder) => (
          <>
            {recorder.tags &&
              typeof recorder.tags === 'string' &&
              recorder.tags.split(',').map(tagId => {
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
        title: 'IP',
        dataIndex: 'ip',
        key: 'ip',
        width: 150,
      },
      {
        title: 'Last Open Time',
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
        title: 'Created Time',
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
        title: 'Action',
        key: 'operation',
        fixed: 'right',
        width: 100,
        align: 'center',
        render: (_, recorder) => (
          <Button
            icon={<ChromeOutlined />}
            disabled={recorder.status === WINDOW_STATUS.RUNNING}
            type="primary"
            onClick={() => openWindows(recorder.id)}
          >
            {recorder.status === 1 ? 'Open' : 'Running'}
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
  }, [tagMap]);

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
    proxies.splice(0, 0, {id: undefined, ip: 'No Proxy'});
    setProxies(proxies);
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

  const getMembership = async () => {
    try {
      const {data} = await api.get('/power-api/users/membership');
      dispatch(setMembership(data));
      await CommonBridge.share('membership', data);
    } catch (error) {
      console.log(error);
    }
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
      getMembership();
    } catch (error) {
      messageApi.error('Failed to delete');
    }
  };

  const onDeleteModalCancel = () => {
    setDeleteModalVisible(false);
  };

  const recorderAction = (info: MenuInfo, recorder: DB.Window) => {
    switch (info.key) {
      case 'delete':
        setSelectedRow(recorder);
        deleteWindows();
        break;
      case 'update':
        navigate(`/window/edit?id=${recorder.id}`);
        break;
      case 'proxy':
        setSelectedRow(recorder);
        setSelectedProxy(recorder.proxy_id ?? undefined);
        setProxySettingVisible(true);
        break;

      default:
        break;
    }
  };

  const handleProxySettingSave = () => {
    if (selectedRow && selectedProxy) {
      WindowBridge?.update(selectedRow.id!, {proxy_id: selectedProxy});
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
            (f.tags &&
              f.tags instanceof Array &&
              f.tags.some(tag => containsKeyword(tag, keyword))), // Changed this line for tag check
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
    return (option?.ip ?? '').toLowerCase().includes(input.toLowerCase());
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
            Open
          </Button>
          <Button
            type="default"
            onClick={() => closeWindows()}
            icon={<CloseOutlined />}
          >
            Close
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
          fieldNames={{label: 'ip', value: 'id'}}
        ></Select>
      </Modal>
      <div className="content-footer"></div>
    </>
  );
};
export default Windows;
