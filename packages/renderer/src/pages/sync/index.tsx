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
  message,
  Tag,
  Select,
} from 'antd';
import {SyncBridge, WindowBridge} from '#preload';
import {useTranslation} from 'react-i18next';
import {useEffect, useMemo, useState, useCallback} from 'react';
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
  WindowsOutlined,
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
  const {t} = useTranslation();

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
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [arrangeForm] = Form.useForm();
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
        width: 120,
      },
      {
        title: t('window_column_profile_id'),
        dataIndex: 'profile_id',
        key: 'profile_id',
        width: 100,
      },
      {
        title: t('window_column_group'),
        dataIndex: 'group_name',
        key: 'group_name',
        width: 100,
      },
      {
        title: 'Status',
        key: 'status',
        width: 100,
        render: (_, record) => {
          if (syncStatus.isActive && syncStatus.slavePids.includes(record.pid!)) {
            return (
              <Tag color="processing" icon={<SyncOutlined spin />}>
                {t('sync_status_syncing')}
              </Tag>
            );
          }
          if (record.id === syncConfig.masterWindowId) {
            return (
              <Tag color="blue" icon={<CrownOutlined />}>
                {t('sync_status_master')}
              </Tag>
            );
          }
          return (
            <Tag color="default" icon={<DesktopOutlined />}>
              {t('sync_status_ready')}
            </Tag>
          );
        },
      },
      {
        title: t('window_column_action'),
        key: 'action',
        width: 80,
        fixed: 'right',
        render: (_, record) => {
          const isMaster = record.id === syncConfig.masterWindowId;
          return (
            <Button
              type={isMaster ? 'primary' : 'default'}
              icon={<CrownOutlined />}
              onClick={() => handleSetMaster(record.id!)}
              disabled={syncStatus.isActive || isMaster}
            >
              {/* {isMaster ? t('sync_status_master') : t('sync_action_set_master')} */}
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
      setSelectedRowKeys(windows.map((w: DB.Window) => w.id!));
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

  const saveSyncConfig = (config?: SyncConfig) => {
    const configToSave = config || syncConfig;
    localStorage.setItem('syncConfig', JSON.stringify(configToSave));
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

  // Define sync control handlers with useCallback to ensure stable references
  const handleStartSync = useCallback(async () => {
    if (!syncConfig.masterWindowId) {
      message.warning(t('sync_msg_set_master_first'));
      return;
    }

    if (selectedRowKeys.length === 0) {
      message.warning(t('sync_msg_select_one'));
      return;
    }

    if (!selectedRowKeys.includes(syncConfig.masterWindowId)) {
      message.warning(t('sync_msg_master_selected'));
      return;
    }

    const slaveWindowIds = selectedRowKeys.filter(id => id !== syncConfig.masterWindowId);

    if (slaveWindowIds.length === 0) {
      message.warning(t('sync_msg_select_slave'));
      return;
    }

    const result = await SyncBridge.startSync({
      masterWindowId: syncConfig.masterWindowId,
      slaveWindowIds: slaveWindowIds,
      options: syncConfig.syncOptions,
    });

    if (result.success) {
      message.success(t('sync_msg_started', {count: slaveWindowIds.length}));
      await fetchSyncStatus();
    } else {
      message.error(t('sync_msg_start_failed', {error: result.error}));
    }
  }, [syncConfig.masterWindowId, syncConfig.syncOptions, selectedRowKeys, t]);

  const handleStopSync = useCallback(async () => {
    const result = await SyncBridge.stopSync();
    if (result.success) {
      message.success(t('sync_msg_stopped'));
      await fetchSyncStatus();
    }
  }, [t]);

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

  // Register global keyboard shortcuts from main process
  useEffect(() => {
    // Listen for Ctrl+Alt+S (start sync)
    const cleanupStart = SyncBridge.onShortcutStart(() => {
      if (!syncStatus.isActive) {
        handleStartSync();
      }
    });

    // Listen for Ctrl+Alt+D (stop sync)
    const cleanupStop = SyncBridge.onShortcutStop(() => {
      if (syncStatus.isActive) {
        handleStopSync();
      }
    });

    // Cleanup on unmount
    return () => {
      cleanupStart();
      cleanupStop();
    };
  }, [syncStatus.isActive, handleStartSync, handleStopSync]);

  const handleSetMaster = (windowId: number) => {
    const newConfig = {
      ...syncConfig,
      masterWindowId: windowId,
    };
    setSyncConfig(newConfig);
    localStorage.setItem('syncConfig', JSON.stringify(newConfig));
    message.success(t('sync_msg_master_set'));
  };

  const handleArrangeWindows = () => {
    if (!windows.length) {
      message.warning(t('sync_msg_no_windows'));
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
      message.warning(t('sync_msg_select_windows'));
      return;
    }

    SyncBridge.arrangeWindows(config as any);
    saveSyncConfig();
    message.success(t('sync_msg_arranged'));
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

  const onSelectChange = (newSelectedRowKeys: React.Key[]) => {
    setSelectedRowKeys(newSelectedRowKeys as number[]);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const masterWindow = windows.find(w => w.id === syncConfig.masterWindowId);
  const slaveCount = selectedRowKeys.filter(id => id !== syncConfig.masterWindowId).length;

  // Format master info text
  const masterInfoText = masterWindow
    ? t('sync_master_info', {name: masterWindow.name, count: slaveCount})
    : '';

  // Format sync status description
  const syncStatusDesc = t('sync_active_desc', {count: syncStatus.slavePids.length});

  return (
    <>
      {/* Toolbar */}
      <div className="content-toolbar">
        <Space size={16}>
          {!syncStatus.isActive ? (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleStartSync}
              disabled={
                !syncConfig.masterWindowId ||
                selectedRowKeys.length < 2 ||
                !selectedRowKeys.includes(syncConfig.masterWindowId)
              }
            >
              {t('sync_start')} (Ctrl+Alt+S)
            </Button>
          ) : (
            <Button danger size="large" icon={<StopOutlined />} onClick={handleStopSync}>
              {t('sync_stop')} (Ctrl+Alt+D)
            </Button>
          )}
          <Text type="secondary">
            {t('sync_selected')}: {selectedRowKeys.length}
          </Text>
        </Space>
        <Space size={8} className="content-toolbar-btns">
          <Button icon={<ReloadOutlined />} onClick={fetchOpenedWindows}>
            {t('refresh')}
          </Button>
        </Space>
      </div>

      {/* Sync Status Alert */}
      {/* {syncStatus.isActive && (
        <div style={{padding: '16px 0px 0'}}>
          <Alert
            message={t('sync_active_title')}
            description={syncStatusDesc}
            type="success"
            showIcon
            closable
          />
        </div>
      )} */}

      {/* Main Content */}
      <div style={{padding: '4px 0px'}}>
        <Row gutter={16}>
          {/* Left: Window List */}
          <Col span={16}>
            <Card bordered={false} style={{height: '100%'}}>
              <div style={{marginBottom: 16}}>
                <Space>
                  <Title level={5} style={{margin: 0}}>
                    <DesktopOutlined style={{marginRight: 8}} />
                    {t('sync_opened_windows')}
                  </Title>
                  {masterWindow && <Text type="secondary">{masterInfoText}</Text>}
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
          </Col>

          {/* Right: Control Panel */}
          <Col span={8}>
            <Card
              bordered={false}
              style={{height: '100%'}}
              title={
                <Space>
                  <SettingOutlined />
                  <span>{t('sync_control_panel')}</span>
                </Space>
              }
            >
              <Space direction="vertical" style={{width: '100%'}} size="middle">
                {/* Display Selection */}
                <div>
                  <Text strong style={{marginBottom: 8, display: 'block'}}>
                    {t('sync_display')}
                  </Text>
                  <Select
                    style={{width: '100%'}}
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

                {/* Arrange Settings */}
                <Form
                  form={arrangeForm}
                  layout="vertical"
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
                      <Form.Item label={t('arrange_columns')} name="columns">
                        <InputNumber min={1} max={12} style={{width: '100%'}} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label={t('arrange_spacing')} name="spacing">
                        <InputNumber min={0} max={50} style={{width: '100%'}} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item label={t('arrange_height')} name="height">
                    <InputNumber min={0} style={{width: '100%'}} />
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
                  {t('sync_arrange_button')}
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </div>
    </>
  );
};

export default Sync;
