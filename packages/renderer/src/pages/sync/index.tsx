import {Button, Card, Col, Row, Space, Table} from 'antd';
import {SyncBridge, WindowBridge} from '#preload';
import {useTranslation} from 'react-i18next';
import {useEffect} from 'react';

const Sync = () => {
  const {t} = useTranslation();

  const fetchOpenedWindows = async () => {
    const windows = await WindowBridge.getOpenedWindows();
    console.log(windows);
  };

  useEffect(() => {
    fetchOpenedWindows();
  }, []);

  const handleTileWindows = () => {
    SyncBridge.tileWindows();
  };

  // type FieldType = SettingOptions;

  const handleGroupControl = () => {
    SyncBridge.startGroupControl();
  };

  return (
    <>
      <Card
        className="content-card p-6"
        bordered={false}
      >
        <Row>
          <Col span={17}>
            <Space>
              <Button
                type="primary"
                onClick={handleTileWindows}
              >
                {t('tile_windows')}
              </Button>
              <Button
                type="primary"
                onClick={handleGroupControl}
              >
                群控
              </Button>
            </Space>
            <Table></Table>
          </Col>
          <Col span={7}></Col>
        </Row>
      </Card>
    </>
  );
};
export default Sync;
