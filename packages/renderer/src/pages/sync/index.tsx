import {Button, Card} from 'antd';
import {SyncBridge} from '#preload';
import { useTranslation } from 'react-i18next';

const Sync = () => {
  const {t} = useTranslation();
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
          {t('tile_windows')}
        </Button>
      </Card>
    </>
  );
};
export default Sync;
