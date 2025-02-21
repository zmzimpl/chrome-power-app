import { Button, Card, Col, Form, InputNumber, Row, Space, Table, Typography } from 'antd';
import { SyncBridge, WindowBridge } from '#preload';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import type { DB, SafeAny } from '../../../../shared/types/db';
import _ from 'lodash';
// import { BranchesOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

interface SyncConfig {
  mainPid: number;
  childPids: number[];
  spacing: number;
  columns: number;
  size: { width: number; height: number };
}

const Sync = () => {
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(localStorage.getItem('syncConfig') ? JSON.parse(localStorage.getItem('syncConfig') || '{}') : {
    mainPid: null,
    childPids: [],
    spacing: 10,
    columns: 3,
    size: { width: 0, height: 0 },
  });
  const OFFSET = 266;
  const [windows, setWindows] = useState<DB.Window[]>([]);
  const [tableScrollY, setTableScrollY] = useState(window.innerHeight - OFFSET); // Note: Set SOME_OFFSET based on your design
  const { t, i18n } = useTranslation();
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [form] = Form.useForm();

  const columns: ColumnsType<DB.Window> = useMemo(() => {
    // select all
    return [
      {
        title: 'ID',
        dataIndex: 'id',
        key: 'id',
      },
      {
        title: 'Profile ID',
        dataIndex: 'profile_id',
        key: 'profile_id',
      },
      {
        title: 'Group',
        dataIndex: 'group_name',
        key: 'group_name',
      },
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
      },
      // {
      //   title: '',
      //   key: 'operation',
      //   fixed: 'right',
      //   align: 'center',
      //   width: 40,
      //   render: (_, recorder) => {
      //     return (
      //       <div className="flex items-center justify-center cursor-pointer hover:text-blue-500" title="Set as main window" onClick={() => {
      //         setSyncConfig({
      //           ...syncConfig,
      //           mainPid: recorder.pid!,
      //         });
      //       }}>
      //         <BranchesOutlined className="text-lg" />
      //       </div>
      //     );
      //   }
      //   ,
      // },
    ];
  }, [i18n.language]);

  const fetchOpenedWindows = async () => {
    const windows = await WindowBridge.getOpenedWindows();
    setWindows(windows);
    if (windows.length > 0) {
      const config = {
        ...syncConfig,
        mainPid: windows[0].pid!,
        childPids: windows.filter((window: DB.Window) => window.pid !== windows[0].pid!).map((window: DB.Window) => window.pid!),
      };
      setSyncConfig(config);
    }
  };

  useEffect(() => {
    localStorage.setItem('syncConfig', JSON.stringify({
      mainPid: null,
      childPids: [],
      spacing: syncConfig.spacing,
      columns: syncConfig.columns,
      size: syncConfig.size,
    }));
  }, [syncConfig]);

  useEffect(() => {
    fetchOpenedWindows();
  }, []);

  const onSelectChange = (newSelectedRowKeys: React.Key[]) => {
    setSelectedRowKeys(newSelectedRowKeys as number[]);
  };
  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
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

  const handleArrangeWindows = () => {
    if (!windows.length || !syncConfig.mainPid) {
      return;
    }
    let config;
    if (selectedRowKeys.length > 0) {
      config = {
        ...syncConfig,
        mainPid: selectedRowKeys[0],
        childPids: selectedRowKeys.filter((pid: number) => pid !== selectedRowKeys[0]),
      };
    } else if (windows.length > 0) {
      config = {
        ...syncConfig,
        mainPid: windows[0].pid!,
        childPids: windows.filter((window: DB.Window) => window.pid !== windows[0].pid!).map((window: DB.Window) => window.pid!),
      };
    }
    SyncBridge.arrangeWindows(config as SyncConfig);
  };

  const onValuesChange = (_changedFields: 'columns' | 'spacing' | 'height', allFields: SafeAny) => {
    setSyncConfig({
      ...syncConfig,
      ...allFields,
      size: {
        width: syncConfig.size.width,
        height: allFields.height ?? syncConfig.size.height,
      },
    });
  };

  return (
    <>
      <div className="content-toolbar">
        <Row>
          <Col span={17}>
            <Space>

            </Space>
          </Col>
        </Row>
      </div>
      <Card
        className="content-card p-6"
      >
        <Row>
          <Col span={18}>
            <Table dataSource={windows} rowKey="pid" rowSelection={rowSelection}
              scroll={{ y: tableScrollY }} columns={columns} />
          </Col>
          <Col span={6} className="arrange-settings p-4 bg-white rounded-lg shadow-sm">
            <div className="mb-4">
              <Text strong className="text-lg">
                {t('arrange_settings')}
              </Text>
            </div>
            <Form
              form={form}
              layout="vertical"
              size="middle"
              initialValues={{
                columns: syncConfig.columns,
                spacing: syncConfig.spacing,
                height: undefined,
              }}
              onValuesChange={onValuesChange}
              className="space-y-4"
            >
              <Form.Item
                label={t('arrange_columns')}
                name="columns"
              >
                <InputNumber
                  min={1}
                  max={12}
                  className="w-full"
                />
              </Form.Item>

              <Form.Item
                label={t('arrange_spacing')}
                name="spacing"
              >
                <InputNumber
                  min={0}
                  max={50}
                  className="w-full"
                />
              </Form.Item>

              <Form.Item
                label={t('arrange_height')}
                name="height"
              >
                <InputNumber
                  className="w-full"
                />
              </Form.Item>
            </Form>

            <div className="mt-4">
              <Button
                block
                type="primary"
                onClick={handleArrangeWindows}
              >
                {t('arrange_windows')}
              </Button>
            </div>
          </Col>
        </Row>
      </Card>
    </>
  );
};
export default Sync;
