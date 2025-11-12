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
  Select,
  Collapse,
  message,
  Tag,
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
  slaveWindowIds: number[];
  syncOptions: SyncOptions;
}

interface SyncStatus {
  isActive: boolean;
  masterPid: number | null;
  slavePids: number[];
}

const Sync = () => {
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(() => {
    const saved = localStorage.getItem('syncConfig');
    return saved
      ? JSON.parse(saved)
      : {
          mainPid: null,
          childPids: [],
          spacing: 10,
          columns: 3,
          size: {width: 0, height: 0},
          masterWindowId: null,
          slaveWindowIds: [],
          syncOptions: {
            enableMouseSync: true,
            enableKeyboardSync: true,
            enableWheelSync: true,
            enableCdpSync: false,
            mouseMoveThrottleMs: 10,
            mouseMoveThresholdPx: 2,
            wheelThrottleMs: 50,
            cdpSyncIntervalMs: 100,
          },
        };
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
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: 'Status',
        key: 'syncStatus',
        width: 100,
        render: (_, record) => {
          if (syncStatus.isActive) {
            if (record.pid === syncStatus.masterPid) {
              return <Tag color="blue">Master</Tag>;
            }
            if (syncStatus.slavePids.includes(record.pid!)) {
              return <Tag color="green">Slave</Tag>;
            }
          }
          return <Tag>Idle</Tag>;
        },
      },
    ];
  }, [syncStatus]);

  const fetchOpenedWindows = async () => {
    const windows = await WindowBridge.getOpenedWindows();
    setWindows(windows);

    // Auto-select first window as master and rest as slaves
    if (windows.length > 0 && !syncConfig.masterWindowId) {
      const config = {
        ...syncConfig,
        masterWindowId: windows[0].id!,
        slaveWindowIds: windows.slice(1).map(w => w.id!),
        mainPid: windows[0].pid!,
        childPids: windows.slice(1).map(w => w.pid!),
      };
      setSyncConfig(config);
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

  const handleArrangeWindows = () => {
    if (!windows.length || !syncConfig.mainPid) {
      message.warning('Please select windows to arrange');
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
    } else if (windows.length > 0) {
      config = {
        ...syncConfig,
        mainPid: windows[0].pid!,
        childPids: windows.slice(1).map(w => w.pid!),
      };
    }

    SyncBridge.arrangeWindows(config as any);
    saveSyncConfig();
    message.success('Windows arranged successfully');
  };

  const handleStartSync = async () => {
    if (!syncConfig.masterWindowId) {
      message.warning('Please select a master window');
      return;
    }

    if (syncConfig.slaveWindowIds.length === 0) {
      message.warning('Please select at least one slave window');
      return;
    }

    const result = await SyncBridge.startSync({
      masterWindowId: syncConfig.masterWindowId,
      slaveWindowIds: syncConfig.slaveWindowIds,
      options: syncConfig.syncOptions,
    });

    if (result.success) {
      message.success('Multi-window synchronization started!');
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

  const handleMasterWindowChange = (windowId: number) => {
    const newConfig = {
      ...syncConfig,
      masterWindowId: windowId,
      slaveWindowIds: syncConfig.slaveWindowIds.filter(id => id !== windowId),
    };
    setSyncConfig(newConfig);
    saveSyncConfig();
  };

  const handleSlaveWindowsChange = (windowIds: number[]) => {
    const newConfig = {
      ...syncConfig,
      slaveWindowIds: windowIds.filter(id => id !== syncConfig.masterWindowId),
    };
    setSyncConfig(newConfig);
    saveSyncConfig();
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

  const availableWindows = windows.map(w => ({
    label: `${w.name} (ID: ${w.id})`,
    value: w.id!,
  }));

  const masterWindowOptions = availableWindows;
  const slaveWindowOptions = availableWindows.filter(w => w.value !== syncConfig.masterWindowId);

  return (
    <>
      <div className="content-toolbar">
        <Row align="middle" justify="space-between">
          <Col>
            <Space>
              <Badge
                status={syncStatus.isActive ? 'processing' : 'default'}
                text={
                  syncStatus.isActive
                    ? `Syncing (${syncStatus.slavePids.length} slaves)`
                    : 'Not syncing'
                }
              />
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchOpenedWindows}>
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Card className="content-card p-6">
        <Row gutter={24}>
          {/* Left: Window List */}
          <Col span={14}>
            <Title level={5}>
              <SyncOutlined /> Opened Windows
            </Title>
            <Table
              dataSource={windows}
              rowKey="id"
              rowSelection={rowSelection}
              scroll={{y: tableScrollY}}
              columns={columns}
              size="small"
            />
          </Col>

          {/* Right: Control Panel */}
          <Col span={10}>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <Collapse defaultActiveKey={['sync']} ghost>
                {/* Multi-Window Sync Panel */}
                <Panel
                  header={
                    <Text strong className="text-lg">
                      <SyncOutlined /> Multi-Window Synchronization
                    </Text>
                  }
                  key="sync"
                >
                  {syncStatus.isActive && (
                    <Alert
                      message="Synchronization Active"
                      description="All mouse, keyboard, and wheel events from the master window are being synchronized to slave windows."
                      type="success"
                      icon={<CheckCircleOutlined />}
                      showIcon
                      closable
                      className="mb-4"
                    />
                  )}

                  <Form
                    form={syncForm}
                    layout="vertical"
                    size="middle"
                    initialValues={syncConfig.syncOptions}
                    onValuesChange={onSyncOptionsChange}
                  >
                    {/* Master Window Selection */}
                    <Form.Item label="Master Window" required>
                      <Select
                        placeholder="Select master window"
                        value={syncConfig.masterWindowId}
                        onChange={handleMasterWindowChange}
                        options={masterWindowOptions}
                        disabled={syncStatus.isActive}
                      />
                    </Form.Item>

                    {/* Slave Windows Selection */}
                    <Form.Item label="Slave Windows" required>
                      <Select
                        mode="multiple"
                        placeholder="Select slave windows"
                        value={syncConfig.slaveWindowIds}
                        onChange={handleSlaveWindowsChange}
                        options={slaveWindowOptions}
                        disabled={syncStatus.isActive}
                      />
                    </Form.Item>

                    <Divider />

                    {/* Sync Options */}
                    <Form.Item label="Sync Features" className="mb-2">
                      <Space direction="vertical" className="w-full">
                        <Form.Item name="enableMouseSync" valuePropName="checked" noStyle>
                          <Switch
                            checkedChildren="Mouse"
                            unCheckedChildren="Mouse"
                            disabled={syncStatus.isActive}
                          />
                        </Form.Item>
                        <Form.Item name="enableKeyboardSync" valuePropName="checked" noStyle>
                          <Switch
                            checkedChildren="Keyboard"
                            unCheckedChildren="Keyboard"
                            disabled={syncStatus.isActive}
                          />
                        </Form.Item>
                        <Form.Item name="enableWheelSync" valuePropName="checked" noStyle>
                          <Switch
                            checkedChildren="Wheel"
                            unCheckedChildren="Wheel"
                            disabled={syncStatus.isActive}
                          />
                        </Form.Item>
                        <Form.Item name="enableCdpSync" valuePropName="checked" noStyle>
                          <Switch
                            checkedChildren="CDP Scroll Sync"
                            unCheckedChildren="CDP Scroll Sync"
                            disabled={syncStatus.isActive}
                          />
                        </Form.Item>
                      </Space>
                    </Form.Item>

                    {/* Advanced Options */}
                    <Collapse ghost className="mb-4">
                      <Panel header={<Text type="secondary">⚙️ Advanced Options</Text>} key="advanced">
                        <Form.Item label="Mouse Move Throttle (ms)" name="mouseMoveThrottleMs">
                          <InputNumber min={1} max={100} className="w-full" disabled={syncStatus.isActive} />
                        </Form.Item>

                        <Form.Item label="Mouse Move Threshold (px)" name="mouseMoveThresholdPx">
                          <InputNumber min={1} max={10} className="w-full" disabled={syncStatus.isActive} />
                        </Form.Item>

                        <Form.Item label="Wheel Throttle (ms)" name="wheelThrottleMs">
                          <InputNumber min={1} max={200} className="w-full" disabled={syncStatus.isActive} />
                        </Form.Item>

                        {syncConfig.syncOptions.enableCdpSync && (
                          <Form.Item label="CDP Sync Interval (ms)" name="cdpSyncIntervalMs">
                            <InputNumber min={50} max={500} className="w-full" disabled={syncStatus.isActive} />
                          </Form.Item>
                        )}
                      </Panel>
                    </Collapse>
                  </Form>

                  {/* Control Buttons */}
                  <Space direction="vertical" className="w-full">
                    {!syncStatus.isActive ? (
                      <Button
                        block
                        type="primary"
                        size="large"
                        icon={<PlayCircleOutlined />}
                        onClick={handleStartSync}
                        disabled={!syncConfig.masterWindowId || syncConfig.slaveWindowIds.length === 0}
                      >
                        Start Sync
                      </Button>
                    ) : (
                      <Button
                        block
                        danger
                        size="large"
                        icon={<StopOutlined />}
                        onClick={handleStopSync}
                      >
                        Stop Sync
                      </Button>
                    )}
                  </Space>
                </Panel>

                {/* Window Arrangement Panel */}
                <Panel
                  header={
                    <Text strong className="text-lg">
                      <SettingOutlined /> Window Arrangement
                    </Text>
                  }
                  key="arrange"
                >
                  <Form
                    form={arrangeForm}
                    layout="vertical"
                    size="middle"
                    initialValues={{
                      columns: syncConfig.columns,
                      spacing: syncConfig.spacing,
                      height: syncConfig.size.height !== 0 ? syncConfig.size.height : undefined,
                    }}
                    onValuesChange={onArrangeValuesChange}
                  >
                    <Form.Item label="Columns" name="columns">
                      <InputNumber min={1} max={12} className="w-full" />
                    </Form.Item>

                    <Form.Item label="Spacing" name="spacing">
                      <InputNumber min={0} max={50} className="w-full" />
                    </Form.Item>

                    <Form.Item label="Height (0 = auto)" name="height">
                      <InputNumber min={0} className="w-full" />
                    </Form.Item>
                  </Form>

                  <Button block type="default" onClick={handleArrangeWindows}>
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
