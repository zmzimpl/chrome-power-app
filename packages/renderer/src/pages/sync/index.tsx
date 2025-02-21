import { Button, Card, Col, Row, Space, Table } from 'antd';
import { SyncBridge, WindowBridge } from '#preload';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from 'react';
import type { DB } from '../../../../shared/types/db';
import _ from 'lodash';
// import { BranchesOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

interface SyncConfig {
  mainPid: number;
  childPids: number[];
  spacing: number;
  columns: number;
  size: { width: number; height: number };
}

const Sync = () => {
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    mainPid: 0,
    childPids: [],
    // 间距
    spacing: 10,
    columns: 3,
    size: { width: 0, height: 0 },
  });
  const OFFSET = 266;
  const [windows, setWindows] = useState<DB.Window[]>([]);
  const [tableScrollY, setTableScrollY] = useState(window.innerHeight - OFFSET); // Note: Set SOME_OFFSET based on your design
  const { t, i18n } = useTranslation();
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);

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
      console.log(config);
      setSyncConfig(config);
    }
  };

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

  const handleTileWindows = () => {
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

  return (
    <>
      <div className="content-toolbar">
        <Row>
          <Col span={17}>
            <Space>
              <Button
                type="primary"
                onClick={handleTileWindows}
              >
                {t('tile_windows')}
              </Button>
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
          <Col span={6}> </Col>
        </Row>
      </Card>
    </>
  );
};
export default Sync;
