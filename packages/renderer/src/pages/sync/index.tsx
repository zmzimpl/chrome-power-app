import {
  Button,
  Card,
  Col,
  Form,
  InputNumber,
  Row,
  Space,
  Table,
  Typography,
  Divider,
  Switch,
  Alert,
  message,
  Tag,
  Tooltip,
  Select,
  Radio,
  Tabs,
} from 'antd';
import {SyncBridge, WindowBridge} from '#preload';
import {useTranslation} from 'react-i18next';
import {useEffect, useMemo, useState} from 'react';
import type {DB} from '../../../../shared/types/db';
import _ from 'lodash';
import {
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  SettingOutlined,
  SyncOutlined,
  CrownOutlined,
  DesktopOutlined,
  ThunderboltOutlined,
  LayoutOutlined,
  WindowsOutlined,
  BorderOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import type {ColumnsType} from 'antd/es/table';
import type {SyncOptions, MonitorInfo} from '../../../../preload/src/bridges/sync';

const {Text, Title} = Typography;

interface SyncConfig {
  // Window arrangement
  mainPid: number | null;
  childPids: number[];
  spacing: number;
  columns: number;
  size: {width: number; height: number};

  // Multi-window sync
  masterWindowId: number | null;
  syncOptions: SyncOptions;
}

interface SyncStatus {
  isActive: boolean;
  masterPid: number | null;
  slavePids: number[];
}

const Sync = () => {
  const defaultSyncOptions: SyncOptions = {
    enableMouseSync: true,
    enableKeyboardSync: true,
    enableWheelSync: true,
    enableCdpSync: false,
    wheelThrottleMs: 50,
    cdpSyncIntervalMs: 100,
  };

  const defaultConfig: SyncConfig = {
    mainPid: null,
    childPids: [],
    spacing: 10,
    columns: 3,
    size: {width: 0, height: 0},
    masterWindowId: null,
    syncOptions: defaultSyncOptions,
  };

  const [syncConfig, setSyncConfig] = useState<SyncConfig>(() => {
    const saved = localStorage.getItem('syncConfig');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...defaultConfig,
          ...parsed,
          syncOptions: {
            ...defaultSyncOptions,
            ...(parsed.syncOptions || {}),
          },
        };
      } catch (e) {
        console.error('Failed to parse saved sync config:', e);
        return defaultConfig;
      }
    }
    return defaultConfig;
  });

  const OFFSET = 330;
  const [windows, setWindows] = useState<DB.Window[]>([]);
  const [tableScrollY, setTableScrollY] = useState(window.innerHeight - OFFSET);
  const {t} = useTranslation();
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [arrangeForm] = Form.useForm();
  const [syncForm] = Form.useForm();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isActive: false,
    masterPid: null,
    slavePids: [],
  });
  const [statusPolling, setStatusPolling] = useState<NodeJS.Timeout | null>(null);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [selectedMonitorIndex, setSelectedMonitorIndex] = useState<number>(0);
  const [arrangeMode, setArrangeMode] = useState<'grid' | 'cascade'>('grid');

  const columns: ColumnsType<DB.Window> = useMemo(() => {
    return [
      {
        title: 'ID',
        dataIndex: 'id',
        key: 'id',
        width: 60,
      },
      {
        title: t('window_column_name'),
        dataIndex: 'name',
        key: 'name',
        width: 200,
      },
      {
        title: t('window_column_profile_id'),
        dataIndex: 'profile_id',
        key: 'profile_id',
        width: 150,
      },
      {
        title: t('window_column_group'),
        dataIndex: 'group_name',
        key: 'group_name',
        width: 120,
      },
      {
        title: 'Status',
        key: 'status',
        width: 100,
        render: (_, record) => {
          if (syncStatus.isActive && syncStatus.slavePids.includes(record.pid!)) {
            return (
              <Tag color="processing" icon={<SyncOutlined spin />}>
                Syncing
              </Tag>
            );
          }
          if (record.id === syncConfig.masterWindowId) {
            return (
              <Tag color="blue" icon={<CrownOutlined />}>
                Master
              </Tag>
            );
          }
          return (
            <Tag color="default" icon={<DesktopOutlined />}>
              Ready
            </Tag>
          );
        },
      },
      {
        title: 'Action',
        key: 'action',
        width: 120,
        fixed: 'right',
        render: (_, record) => {
          const isMaster = record.id === syncConfig.masterWindowId;
          return (
            <Button
              type={isMaster ? 'primary' : 'default'}
              size="small"
              icon={<CrownOutlined />}
              onClick={() => handleSetMaster(record.id!)}
              disabled={syncStatus.isActive || isMaster}
            >
              {isMaster ? 'Master' : 'Set Master'}
            </Button>
          );
        },
      },
    ];
  }, [syncStatus, syncConfig.masterWindowId, t]);

  const fetchOpenedWindows = async () => {
    const windows = await WindowBridge.getOpenedWindows();
    setWindows(windows);

    // Auto-select first window as master if none set
    if (windows.length > 0 && !syncConfig.masterWindowId) {
      handleSetMaster(windows[0].id!);
    }

    // Auto-select all windows in table
    if (windows.length > 0) {
      setSelectedRowKeys(windows.map(w => w.id!));
    }
  };

  const fetchSyncStatus = async () => {
    const status = await SyncBridge.getSyncStatus();
    setSyncStatus(status);
  };

  const fetchMonitors = async () => {
    const result = await SyncBridge.getMonitors();
    if (result.success && result.monitors.length > 0) {
      setMonitors(result.monitors);
      setSelectedMonitorIndex(0);
    }
  };

  const saveSyncConfig = () => {
    localStorage.setItem('syncConfig', JSON.stringify(syncConfig));
  };

  useEffect(() => {
    fetchOpenedWindows();
    fetchSyncStatus();
    fetchMonitors();
  }, []);

  useEffect(() => {
    const handleResize = _.debounce(() => {
      setTableScrollY(window.innerHeight - OFFSET);
    }, 200);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (statusPolling) {
        clearInterval(statusPolling);
      }
    };
  }, [statusPolling]);

  // Start status polling when sync is active
  useEffect(() => {
    if (syncStatus.isActive && !statusPolling) {
      const interval = setInterval(fetchSyncStatus, 1000);
      setStatusPolling(interval);
    } else if (!syncStatus.isActive && statusPolling) {
      clearInterval(statusPolling);
      setStatusPolling(null);
    }
  }, [syncStatus.isActive]);

  const handleSetMaster = (windowId: number) => {
    const newConfig = {
      ...syncConfig,
      masterWindowId: windowId,
    };
    setSyncConfig(newConfig);
    localStorage.setItem('syncConfig', JSON.stringify(newConfig));
    message.success('Master window set successfully');
  };

  const handleArrangeWindows = () => {
    if (!windows.length) {
      message.warning('No windows available');
      return;
    }

    let config;
    if (selectedRowKeys.length > 0) {
      const selectedWindows = windows.filter(w => selectedRowKeys.includes(w.id!));
      config = {
        ...syncConfig,
        mainPid: selectedWindows[0].pid!,
        childPids: selectedWindows.slice(1).map(w => w.pid!),
        monitorIndex: selectedMonitorIndex,
      };
    } else {
      message.warning('Please select windows to arrange');
      return;
    }

    SyncBridge.arrangeWindows(config as any);
    saveSyncConfig();
    message.success('Windows arranged successfully');
  };

  const handleStartSync = async () => {
    if (!syncConfig.masterWindowId) {
      message.warning('Please set a master window first');
      return;
    }

    if (selectedRowKeys.length === 0) {
      message.warning('Please select at least one window to sync');
      return;
    }

    if (!selectedRowKeys.includes(syncConfig.masterWindowId)) {
      message.warning('Master window must be selected');
      return;
    }

    const slaveWindowIds = selectedRowKeys.filter(id => id !== syncConfig.masterWindowId);

    if (slaveWindowIds.length === 0) {
      message.warning('Please select at least one slave window (besides master)');
      return;
    }

    const result = await SyncBridge.startSync({
      masterWindowId: syncConfig.masterWindowId,
      slaveWindowIds: slaveWindowIds,
      options: syncConfig.syncOptions,
    });

    if (result.success) {
      message.success(`Synchronization started! Master: 1, Slaves: ${slaveWindowIds.length}`);
      await fetchSyncStatus();
    } else {
      message.error(`Failed to start sync: ${result.error}`);
    }
  };

  const handleStopSync = async () => {
    const result = await SyncBridge.stopSync();
    if (result.success) {
      message.success('Synchronization stopped');
      await fetchSyncStatus();
    }
  };

  const onArrangeValuesChange = (_: any, allFields: any) => {
    const newConfig = {
      ...syncConfig,
      ...allFields,
      size: {
        width: syncConfig.size.width,
        height: allFields.height ?? 0,
      },
    };
    setSyncConfig(newConfig);
  };

  const onSyncOptionsChange = (_: any, allFields: SyncOptions) => {
    const newConfig = {
      ...syncConfig,
      syncOptions: {
        ...syncConfig.syncOptions,
        ...allFields,
      },
    };
    setSyncConfig(newConfig);
    saveSyncConfig();
  };

  const onSelectChange = (newSelectedRowKeys: React.Key[]) => {
    setSelectedRowKeys(newSelectedRowKeys as number[]);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const masterWindow = windows.find(w => w.id === syncConfig.masterWindowId);
  const slaveCount = selectedRowKeys.filter(id => id !== syncConfig.masterWindowId).length;

  return (
    <>
      {/* Toolbar */}
      <div className="content-toolbar">
        <Space size={16}>
          {!syncStatus.isActive ? (
            <Button
              type="primary"
              size="large"
              icon={<PlayCircleOutlined />}
              onClick={handleStartSync}
              disabled={
                !syncConfig.masterWindowId ||
                selectedRowKeys.length < 2 ||
                !selectedRowKeys.includes(syncConfig.masterWindowId)
              }
            >
              Start Sync (Ctrl+Alt+S)
            </Button>
          ) : (
            <Button danger size="large" icon={<StopOutlined />} onClick={handleStopSync}>
              Stop Sync (Ctrl+Alt+R)
            </Button>
          )}
          <Text type="secondary">Selected: {selectedRowKeys.length}</Text>
        </Space>
        <Space size={8} className="content-toolbar-btns">
          <Button icon={<ReloadOutlined />} onClick={fetchOpenedWindows}>
            {t('refresh')}
          </Button>
        </Space>
      </div>

      {/* Sync Status Alert */}
      {syncStatus.isActive && (
        <div className="px-6 pt-6">
          <Alert
            message="Synchronization Active"
            description={`Events from master window are being synchronized to ${syncStatus.slavePids.length} slave window(s).`}
            type="success"
            showIcon
            closable
          />
        </div>
      )}

      {/* Main Content */}
      <div className="px-6 pt-6">
        <Row gutter={16}>
          {/* Left: Window List */}
          <Col span={16}>
            <Card bordered={false} className="h-full">
              <div className="mb-4">
                <Space>
                  <Title level={5} style={{margin: 0}}>
                    <DesktopOutlined /> Opened Windows
                  </Title>
                  {masterWindow && (
                    <Text type="secondary">
                      Master: {masterWindow.name} • Slaves: {slaveCount}
                    </Text>
                  )}
                </Space>
              </div>
              <Table
                className="content-table"
                dataSource={windows}
                rowKey="id"
                rowSelection={rowSelection}
                scroll={{y: tableScrollY}}
                columns={columns}
                pagination={false}
                size="small"
              />
            </Card>
          </Col>

          {/* Right: Control Panel */}
          <Col span={8}>
            <Card
              bordered={false}
              className="h-full"
              title={
                <Space>
                  <SettingOutlined />
                  <span>Control Panel</span>
                </Space>
              }
            >
              <Tabs
                defaultActiveKey="sync"
                items={[
                  {
                    key: 'sync',
                    label: (
                      <span>
                        <ThunderboltOutlined />
                        Sync Control
                      </span>
                    ),
                    children: (
                      <Space direction="vertical" className="w-full" size="middle">
                        {/* Sync Features */}
                        <div>
                          <Text strong className="mb-2 block">
                            Sync Features
                          </Text>
                          <Form
                            form={syncForm}
                            layout="vertical"
                            size="small"
                            initialValues={syncConfig.syncOptions}
                            onValuesChange={onSyncOptionsChange}
                          >
                            <Space direction="vertical" className="w-full">
                              <Form.Item name="enableMouseSync" valuePropName="checked" noStyle>
                                <div className="flex items-center justify-between py-2">
                                  <Text>Mouse Sync</Text>
                                  <Switch
                                    size="small"
                                    disabled={syncStatus.isActive}
                                    checked={syncConfig.syncOptions.enableMouseSync}
                                  />
                                </div>
                              </Form.Item>
                              <Form.Item
                                name="enableKeyboardSync"
                                valuePropName="checked"
                                noStyle
                              >
                                <div className="flex items-center justify-between py-2">
                                  <Text>Keyboard Sync</Text>
                                  <Switch
                                    size="small"
                                    disabled={syncStatus.isActive}
                                    checked={syncConfig.syncOptions.enableKeyboardSync}
                                  />
                                </div>
                              </Form.Item>
                              <Form.Item name="enableWheelSync" valuePropName="checked" noStyle>
                                <div className="flex items-center justify-between py-2">
                                  <Text>Wheel Sync</Text>
                                  <Switch
                                    size="small"
                                    disabled={syncStatus.isActive}
                                    checked={syncConfig.syncOptions.enableWheelSync}
                                  />
                                </div>
                              </Form.Item>
                            </Space>
                          </Form>
                        </div>

                        <Divider style={{margin: '8px 0'}} />

                        {/* Advanced Settings */}
                        <div>
                          <Text type="secondary" className="mb-2 block">
                            Advanced Settings
                          </Text>
                          <Form
                            form={syncForm}
                            layout="vertical"
                            size="small"
                            initialValues={syncConfig.syncOptions}
                            onValuesChange={onSyncOptionsChange}
                          >
                            <Form.Item label="Wheel Throttle (ms)" name="wheelThrottleMs">
                              <InputNumber
                                min={1}
                                max={200}
                                className="w-full"
                                disabled={syncStatus.isActive}
                              />
                            </Form.Item>
                            <Form.Item
                              label="CDP Scroll Sync"
                              name="enableCdpSync"
                              valuePropName="checked"
                            >
                              <Switch disabled={syncStatus.isActive} />
                            </Form.Item>
                            {syncConfig.syncOptions.enableCdpSync && (
                              <Form.Item label="CDP Interval (ms)" name="cdpSyncIntervalMs">
                                <InputNumber
                                  min={50}
                                  max={500}
                                  className="w-full"
                                  disabled={syncStatus.isActive}
                                />
                              </Form.Item>
                            )}
                          </Form>
                        </div>
                      </Space>
                    ),
                  },
                  {
                    key: 'arrange',
                    label: (
                      <span>
                        <LayoutOutlined />
                        Window Arrange
                      </span>
                    ),
                    children: (
                      <Space direction="vertical" className="w-full" size="middle">
                        {/* Display Selection */}
                        <div>
                          <Text strong className="mb-2 block">
                            Display / Monitor
                          </Text>
                          <Select
                            className="w-full"
                            value={selectedMonitorIndex}
                            onChange={setSelectedMonitorIndex}
                            options={monitors.map(monitor => ({
                              label: `${monitor.isPrimary ? '🖥️ Primary' : '🖥️ Extended'} - ${monitor.width}x${monitor.height}`,
                              value: monitor.index,
                            }))}
                            disabled={monitors.length === 0}
                          />
                        </div>

                        <Divider style={{margin: '8px 0'}} />

                        {/* Arrange Mode */}
                        <div>
                          <Text strong className="mb-2 block">
                            Arrange Mode
                          </Text>
                          <Radio.Group
                            value={arrangeMode}
                            onChange={e => setArrangeMode(e.target.value)}
                            className="w-full"
                          >
                            <Radio value="grid">
                              <AppstoreOutlined /> Grid Tile
                            </Radio>
                            <Radio value="cascade">
                              <BorderOutlined /> Cascade
                            </Radio>
                          </Radio.Group>
                        </div>

                        <Divider style={{margin: '8px 0'}} />

                        {/* Arrange Settings */}
                        <Form
                          form={arrangeForm}
                          layout="vertical"
                          size="small"
                          initialValues={{
                            columns: syncConfig.columns,
                            spacing: syncConfig.spacing,
                            height:
                              syncConfig.size.height !== 0 ? syncConfig.size.height : undefined,
                          }}
                          onValuesChange={onArrangeValuesChange}
                        >
                          <Row gutter={8}>
                            <Col span={12}>
                              <Form.Item label="Columns" name="columns">
                                <InputNumber min={1} max={12} className="w-full" />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item label="Spacing (px)" name="spacing">
                                <InputNumber min={0} max={50} className="w-full" />
                              </Form.Item>
                            </Col>
                          </Row>

                          <Form.Item label="Height (0 = auto)" name="height">
                            <InputNumber min={0} className="w-full" />
                          </Form.Item>
                        </Form>

                        {/* Arrange Button */}
                        <Button
                          block
                          type="primary"
                          icon={<WindowsOutlined />}
                          onClick={handleArrangeWindows}
                          disabled={selectedRowKeys.length === 0}
                        >
                          Arrange Windows (Ctrl+Alt+Z)
                        </Button>
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </div>
    </>
  );
};

export default Sync;
