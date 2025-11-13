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
  Badge,
  message,
  Tag,
  Tooltip,
  Select,
  Statistic,
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
  CheckCircleOutlined,
  CrownOutlined,
  DesktopOutlined,
  ThunderboltOutlined,
  LayoutOutlined,
} from '@ant-design/icons';
import type {ColumnsType} from 'antd/es/table';
import type {SyncOptions, MonitorInfo} from '../../../../preload/src/bridges/sync';

const {Text, Title} = Typography;

interface SyncConfig {
  // Window arrangement (legacy)
  mainPid: number | null;
  childPids: number[];
  spacing: number;
  columns: number;
  size: {width: number; height: number};

  // Multi-window sync (new)
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

  const OFFSET = 500;
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
        width: 100,
      },
      {
        title: 'Role',
        key: 'syncRole',
        width: 100,
        render: (_, record) => {
          if (record.id === syncConfig.masterWindowId) {
            return (
              <Tag color="blue" icon={<CrownOutlined />}>
                Master
              </Tag>
            );
          }
          if (syncStatus.isActive && syncStatus.slavePids.includes(record.pid!)) {
            return (
              <Tag color="green" icon={<ThunderboltOutlined />}>
                Slave
              </Tag>
            );
          }
          return <Tag color="default">Ready</Tag>;
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
            <Tooltip title={isMaster ? 'Already master' : 'Set as master window'}>
              <Button
                type={isMaster ? 'primary' : 'default'}
                size="small"
                icon={<CrownOutlined />}
                onClick={() => handleSetMaster(record.id!)}
                disabled={syncStatus.isActive || isMaster}
              >
                {isMaster ? 'Master' : 'Set Master'}
              </Button>
            </Tooltip>
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
          <Badge
            status={syncStatus.isActive ? 'processing' : 'default'}
            text={
              <Text strong>
                {syncStatus.isActive
                  ? `Syncing (${syncStatus.slavePids.length} slaves)`
                  : 'Not Syncing'}
              </Text>
            }
          />
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
            description={`All events from master window are being synchronized to ${syncStatus.slavePids.length} slave window(s). Click "Stop Synchronization" to stop.`}
            type="success"
            icon={<CheckCircleOutlined />}
            showIcon
            closable
          />
        </div>
      )}

      {/* Main Content - Control Cards */}
      <div className="px-6 pt-6">
        <Row gutter={[16, 16]}>
          {/* Master Window Selection Card */}
          <Col xs={24} lg={8}>
            <Card
              bordered={false}
              className="h-full"
              title={
                <Space>
                  <CrownOutlined />
                  <span>Master Window</span>
                </Space>
              }
            >
              {masterWindow ? (
                <Space direction="vertical" className="w-full" size="large">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <Space direction="vertical" size="small" className="w-full">
                      <Text type="secondary" style={{fontSize: 12}}>
                        Selected Master
                      </Text>
                      <Text strong style={{fontSize: 16}}>
                        {masterWindow.name}
                      </Text>
                      <Space size={16}>
                        <Text type="secondary">ID: {masterWindow.id}</Text>
                        <Text type="secondary">Profile: {masterWindow.profile_id}</Text>
                      </Space>
                    </Space>
                  </div>
                  <Statistic
                    title="Selected Windows"
                    value={selectedRowKeys.length}
                    suffix={`/ ${windows.length}`}
                  />
                  <Statistic
                    title="Slave Windows"
                    value={slaveCount}
                    valueStyle={{color: slaveCount > 0 ? '#3f8600' : undefined}}
                  />
                </Space>
              ) : (
                <Space direction="vertical" className="w-full text-center" size="large">
                  <div className="py-8">
                    <CrownOutlined style={{fontSize: 48, color: '#d9d9d9'}} />
                    <div className="mt-4">
                      <Text type="secondary">No master window selected</Text>
                    </div>
                    <div className="mt-2">
                      <Text type="secondary" style={{fontSize: 12}}>
                        Click "Set Master" button in the table below
                      </Text>
                    </div>
                  </div>
                </Space>
              )}
            </Card>
          </Col>

          {/* Sync Control Card */}
          <Col xs={24} lg={8}>
            <Card
              bordered={false}
              className="h-full"
              title={
                <Space>
                  <SyncOutlined />
                  <span>Sync Control</span>
                </Space>
              }
            >
              <Space direction="vertical" className="w-full" size="large">
                {/* Main Control Button */}
                {!syncStatus.isActive ? (
                  <Button
                    block
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
                    Start Synchronization
                  </Button>
                ) : (
                  <Button
                    block
                    danger
                    size="large"
                    icon={<StopOutlined />}
                    onClick={handleStopSync}
                  >
                    Stop Synchronization
                  </Button>
                )}

                <Divider style={{margin: 0}} />

                {/* Sync Options */}
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
                      <Form.Item name="enableKeyboardSync" valuePropName="checked" noStyle>
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
              </Space>
            </Card>
          </Col>

          {/* Window Arrangement Card */}
          <Col xs={24} lg={8}>
            <Card
              bordered={false}
              className="h-full"
              title={
                <Space>
                  <LayoutOutlined />
                  <span>Window Arrangement</span>
                </Space>
              }
            >
              <Form
                form={arrangeForm}
                layout="vertical"
                size="small"
                initialValues={{
                  columns: syncConfig.columns,
                  spacing: syncConfig.spacing,
                  height: syncConfig.size.height !== 0 ? syncConfig.size.height : undefined,
                }}
                onValuesChange={onArrangeValuesChange}
              >
                <Form.Item label="Display / Monitor">
                  <Select
                    value={selectedMonitorIndex}
                    onChange={setSelectedMonitorIndex}
                    options={monitors.map(monitor => ({
                      label: `${monitor.isPrimary ? '🖥️ Primary' : '🖥️ Secondary'} - ${monitor.width}x${monitor.height}`,
                      value: monitor.index,
                    }))}
                    disabled={monitors.length === 0}
                  />
                </Form.Item>

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

                <Button
                  block
                  icon={<DesktopOutlined />}
                  onClick={handleArrangeWindows}
                  disabled={selectedRowKeys.length === 0}
                >
                  Arrange Windows
                </Button>
              </Form>
            </Card>
          </Col>
        </Row>
      </div>

      {/* Window List Table */}
      <Card className="content-card" bordered={false}>
        <div className="mb-4">
          <Space>
            <Title level={5} style={{margin: 0}}>
              <DesktopOutlined /> Opened Windows
            </Title>
            <Text type="secondary">
              Select windows to sync, then click "Set Master" to choose the master window
            </Text>
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
        />
      </Card>

      {/* Advanced Settings Card */}
      <Card className="content-card" bordered={false}>
        <div className="mb-4">
          <Space>
            <SettingOutlined />
            <Title level={5} style={{margin: 0}}>
              Advanced Settings
            </Title>
          </Space>
        </div>
        <Form
          form={syncForm}
          layout="horizontal"
          size="small"
          labelCol={{span: 6}}
          wrapperCol={{span: 18}}
          initialValues={syncConfig.syncOptions}
          onValuesChange={onSyncOptionsChange}
        >
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item label="Wheel Throttle (ms)" name="wheelThrottleMs">
                <InputNumber
                  min={1}
                  max={200}
                  className="w-full"
                  disabled={syncStatus.isActive}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="CDP Sync" name="enableCdpSync" valuePropName="checked">
                <Switch disabled={syncStatus.isActive} />
              </Form.Item>
            </Col>
            {syncConfig.syncOptions.enableCdpSync && (
              <Col span={8}>
                <Form.Item label="CDP Interval (ms)" name="cdpSyncIntervalMs">
                  <InputNumber
                    min={50}
                    max={500}
                    className="w-full"
                    disabled={syncStatus.isActive}
                  />
                </Form.Item>
              </Col>
            )}
          </Row>
        </Form>
      </Card>
    </>
  );
};

export default Sync;
