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
  Collapse,
  message,
  Tag,
  Tooltip,
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
} from '@ant-design/icons';
import type {ColumnsType} from 'antd/es/table';
import type {SyncOptions} from '../../../../preload/src/bridges/sync';

const {Text, Title} = Typography;
const {Panel} = Collapse;

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
    mouseMoveThrottleMs: 10,
    mouseMoveThresholdPx: 2,
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
        // Merge with default config to ensure all fields exist
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

  const OFFSET = 266;
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

  const columns: ColumnsType<DB.Window> = useMemo(() => {
    return [
      {
        title: 'ID',
        dataIndex: 'id',
        key: 'id',
        width: 60,
      },
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        width: 200,
      },
      {
        title: 'Profile ID',
        dataIndex: 'profile_id',
        key: 'profile_id',
        width: 150,
      },
      {
        title: 'Group',
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
            return <Tag color="green">Slave</Tag>;
          }
          return <Tag>Ready</Tag>;
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
  }, [syncStatus, syncConfig.masterWindowId]);

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

  const saveSyncConfig = () => {
    localStorage.setItem('syncConfig', JSON.stringify(syncConfig));
  };

  useEffect(() => {
    fetchOpenedWindows();
    fetchSyncStatus();
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
    saveSyncConfig();
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
    // Validate master window
    if (!syncConfig.masterWindowId) {
      message.warning('Please set a master window first');
      return;
    }

    // Get selected windows
    if (selectedRowKeys.length === 0) {
      message.warning('Please select at least one window to sync');
      return;
    }

    // Master must be in selected windows
    if (!selectedRowKeys.includes(syncConfig.masterWindowId)) {
      message.warning('Master window must be selected');
      return;
    }

    // Get slave window IDs (all selected except master)
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
      message.success(
        `Synchronization started! Master: 1, Slaves: ${slaveWindowIds.length}`,
      );
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
  const selectedWindows = windows.filter(w => selectedRowKeys.includes(w.id!));
  const slaveCount = selectedRowKeys.filter(id => id !== syncConfig.masterWindowId).length;

  return (
    <>
      <div className="content-toolbar">
        <Row align="middle" justify="space-between">
          <Col>
            <Space size="large">
              <Badge
                status={syncStatus.isActive ? 'processing' : 'default'}
                text={
                  <Text strong>
                    {syncStatus.isActive
                      ? `🔄 Syncing: ${syncStatus.slavePids.length} slaves`
                      : '⏸ Not syncing'}
                  </Text>
                }
              />
              {masterWindow && (
                <Text type="secondary">
                  <CrownOutlined /> Master: {masterWindow.name} (ID: {masterWindow.id})
                </Text>
              )}
              {selectedRowKeys.length > 0 && (
                <Text type="secondary">
                  Selected: {selectedRowKeys.length} windows
                  {slaveCount > 0 && ` (${slaveCount} slaves)`}
                </Text>
              )}
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchOpenedWindows}>
                Refresh Windows
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Card className="content-card p-6">
        <Row gutter={24}>
          {/* Left: Window List */}
          <Col span={16}>
            <div className="mb-4">
              <Space>
                <Title level={5} style={{margin: 0}}>
                  <DesktopOutlined /> Opened Windows
                </Title>
                <Text type="secondary">
                  Select windows to sync, then click "Set Master" to choose master window
                </Text>
              </Space>
            </div>
            <Table
              dataSource={windows}
              rowKey="id"
              rowSelection={rowSelection}
              scroll={{y: tableScrollY}}
              columns={columns}
              size="small"
              pagination={false}
            />
          </Col>

          {/* Right: Control Panel */}
          <Col span={8}>
            <div className="bg-white rounded-lg shadow-sm p-4">
              {/* Sync Status Alert */}
              {syncStatus.isActive && (
                <Alert
                  message="🎮 Sync Active"
                  description={`All events from master window are being synchronized to ${syncStatus.slavePids.length} slave window(s).`}
                  type="success"
                  icon={<CheckCircleOutlined />}
                  showIcon
                  closable
                  className="mb-4"
                />
              )}

              {/* Sync Control */}
              <div className="mb-4">
                <Title level={5}>
                  <SyncOutlined /> Synchronization Control
                </Title>
                <Divider style={{margin: '12px 0'}} />

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

                  {/* Quick Info */}
                  <div className="p-3 bg-gray-50 rounded">
                    <Space direction="vertical" size="small" className="w-full">
                      <Text strong>Quick Info:</Text>
                      <Text type="secondary" style={{fontSize: 12}}>
                        • Select windows in table
                      </Text>
                      <Text type="secondary" style={{fontSize: 12}}>
                        • Click "Set Master" for one window
                      </Text>
                      <Text type="secondary" style={{fontSize: 12}}>
                        • Others become slaves automatically
                      </Text>
                      <Text type="secondary" style={{fontSize: 12}}>
                        • Click Start to begin syncing
                      </Text>
                    </Space>
                  </div>
                </Space>
              </div>

              <Divider />

              {/* Sync Options */}
              <Collapse ghost defaultActiveKey={['features']}>
                <Panel
                  header={
                    <Text strong>
                      <SettingOutlined /> Sync Features
                    </Text>
                  }
                  key="features"
                >
                  <Form
                    form={syncForm}
                    layout="vertical"
                    size="small"
                    initialValues={syncConfig.syncOptions}
                    onValuesChange={onSyncOptionsChange}
                  >
                    <Space direction="vertical" className="w-full">
                      <Form.Item
                        name="enableMouseSync"
                        valuePropName="checked"
                        style={{marginBottom: 8}}
                      >
                        <Switch
                          checkedChildren="🖱 Mouse Sync"
                          unCheckedChildren="🖱 Mouse Sync"
                          disabled={syncStatus.isActive}
                        />
                      </Form.Item>
                      <Form.Item
                        name="enableKeyboardSync"
                        valuePropName="checked"
                        style={{marginBottom: 8}}
                      >
                        <Switch
                          checkedChildren="⌨️ Keyboard Sync"
                          unCheckedChildren="⌨️ Keyboard Sync"
                          disabled={syncStatus.isActive}
                        />
                      </Form.Item>
                      <Form.Item
                        name="enableWheelSync"
                        valuePropName="checked"
                        style={{marginBottom: 8}}
                      >
                        <Switch
                          checkedChildren="🎡 Wheel Sync"
                          unCheckedChildren="🎡 Wheel Sync"
                          disabled={syncStatus.isActive}
                        />
                      </Form.Item>
                      <Form.Item name="enableCdpSync" valuePropName="checked" style={{marginBottom: 0}}>
                        <Switch
                          checkedChildren="🔄 CDP Scroll Sync"
                          unCheckedChildren="🔄 CDP Scroll Sync"
                          disabled={syncStatus.isActive}
                        />
                      </Form.Item>
                    </Space>

                    {/* Advanced Options */}
                    <Divider style={{margin: '12px 0'}} />
                    <Collapse ghost size="small">
                      <Panel
                        header={<Text type="secondary">⚙️ Advanced Settings</Text>}
                        key="advanced"
                      >
                        <Form.Item
                          label="Mouse Throttle (ms)"
                          name="mouseMoveThrottleMs"
                          style={{marginBottom: 12}}
                        >
                          <InputNumber
                            min={1}
                            max={100}
                            size="small"
                            className="w-full"
                            disabled={syncStatus.isActive}
                          />
                        </Form.Item>

                        <Form.Item
                          label="Mouse Threshold (px)"
                          name="mouseMoveThresholdPx"
                          style={{marginBottom: 12}}
                        >
                          <InputNumber
                            min={1}
                            max={10}
                            size="small"
                            className="w-full"
                            disabled={syncStatus.isActive}
                          />
                        </Form.Item>

                        <Form.Item
                          label="Wheel Throttle (ms)"
                          name="wheelThrottleMs"
                          style={{marginBottom: 12}}
                        >
                          <InputNumber
                            min={1}
                            max={200}
                            size="small"
                            className="w-full"
                            disabled={syncStatus.isActive}
                          />
                        </Form.Item>

                        {syncConfig.syncOptions.enableCdpSync && (
                          <Form.Item label="CDP Interval (ms)" name="cdpSyncIntervalMs">
                            <InputNumber
                              min={50}
                              max={500}
                              size="small"
                              className="w-full"
                              disabled={syncStatus.isActive}
                            />
                          </Form.Item>
                        )}
                      </Panel>
                    </Collapse>
                  </Form>
                </Panel>

                {/* Window Arrangement Panel */}
                <Panel
                  header={
                    <Text strong>
                      <DesktopOutlined /> Window Arrangement
                    </Text>
                  }
                  key="arrange"
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
                    <Form.Item label="Columns" name="columns">
                      <InputNumber min={1} max={12} size="small" className="w-full" />
                    </Form.Item>

                    <Form.Item label="Spacing (px)" name="spacing">
                      <InputNumber min={0} max={50} size="small" className="w-full" />
                    </Form.Item>

                    <Form.Item label="Height (0 = auto)" name="height">
                      <InputNumber min={0} size="small" className="w-full" />
                    </Form.Item>
                  </Form>

                  <Button block size="small" onClick={handleArrangeWindows}>
                    Arrange Windows
                  </Button>
                </Panel>
              </Collapse>
            </div>
          </Col>
        </Row>
      </Card>
    </>
  );
};

export default Sync;
