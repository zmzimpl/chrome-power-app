import {Button, Card} from 'antd';
import {SyncBridge} from '#preload';

const Sync = () => {
  const handleTileWindows = () => {
    SyncBridge.tileWindows();
  };

  // type FieldType = SettingOptions;

  return (
    <>
      <Card
        className="content-card p-6"
        bordered={false}
      >
        <Button
          type="primary"
          onClick={handleTileWindows}
        >
          Tile Windows
        </Button>
      </Card>
    </>
  );
};
export default Sync;
