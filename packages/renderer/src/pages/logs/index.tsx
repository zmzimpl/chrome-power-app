import {Card, Tabs} from 'antd';
import {CommonBridge} from '#preload';
import {useEffect} from 'react';
import React from 'react';
import './index.css';

interface logsDataOptions {
  name: string;
  content: Array<{
    level: string;
    message: string;
  }>;
}

const Logs = () => {
  const items = [
    {
      key: 'Main',
      label: 'Main',
    },
    {
      key: 'Window',
      label: 'Windows',
    },
    {
      key: 'Proxy',
      label: 'Proxy',
    },
    {
      key: 'Service',
      label: 'Service',
    },
    // {
    //   key: 'Api',
    //   label: 'Api',
    // },
  ];
  const [logsData, setLogsData] = React.useState<logsDataOptions[]>([]);

  const fetchLogs = async (logModule: 'Main' | 'Windows' | 'Proxy' | 'Api') => {
    const logs = await CommonBridge.getLogs(logModule);
    setLogsData(logs.reverse());
  };

  useEffect(() => {
    fetchLogs('Main');
  }, []);
  // type FieldType = SettingOptions;

  return (
    <>
      <Card
        className="content-card p-6 "
        bordered={false}
      >
        <Tabs
          onChange={(key: string) => fetchLogs(key as 'Main' | 'Windows' | 'Proxy' | 'Api')}
          size="small"
          items={items}
        />
        <aside className="log-aside text-white p-6 rounded-lg w-full log-container font-mono">
          <div className="flex justify-between items-center">
            <div className="flex space-x-2 text-red-500">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
          </div>
          <div className="mt-4">
            {logsData.map((logs, logsIndex) => {
              const reversedLogs = [...logs.content].reverse();
              return reversedLogs.map((log, index) => {
                if (log.level === 'error') {
                  return (
                    <p
                      key={`${logs.name}-${logsIndex}-${index}`}
                      className="text-amber-400"
                    >
                      {log.message}
                    </p>
                  );
                } else if (log.level === 'warn') {
                  return (
                    <p
                      key={`${logs.name}-${logsIndex}-${index}`}
                      className="text-yellow-400"
                    >
                      {log.message}
                    </p>
                  );
                } else if (log.level === 'info') {
                  return (
                    <p
                      key={`${logs.name}-${logsIndex}-${index}`}
                      className="text-green-400"
                    >
                      {log.message}
                    </p>
                  );
                }
              });
            })}
          </div>
        </aside>
      </Card>
    </>
  );
};
export default Logs;
