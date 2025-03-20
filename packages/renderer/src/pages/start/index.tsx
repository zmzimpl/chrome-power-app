import axios from 'axios';
import {useEffect, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {Card, Space, Badge} from 'antd';

export default function Start() {
  const [search] = useSearchParams();

  const [windowInfo, setWindowInfo] = useState({
    id: '',
    name: '',
    group_name: '',
    opened_at: '',
    profile_id: '',
    remark: '',
    tags_name: [],
  });
  const [moreInfo, setMoreInfo] = useState({
    ip: '',
    country: '',
    ll: [],
    userAgent: '',
    language: '',
    timeZone: '',
  });
  const PIN_URL = [
    {
      name: 'Google',
      n: 'GG',
    },
    {
      name: 'Discord',
      n: 'DC',
    },
    {
      name: 'Twitter',
      n: 'X',
    }
  ];
  const [pings, setPings] = useState<{status: string}[]>([]);
  const [checking, setChecking] = useState(false);

  const checkPing = async () => {
    const windowId = search.get('windowId');
    const serverPort = search.get('serverPort') || 49156;
    setChecking(true);
    try {
      const res = await axios.get(`http://localhost:${serverPort}/ip/ping`, {
        params: {
          windowId: windowId,
        },
      });
      const {pings} = res.data;
      setPings(pings);
      setChecking(false);
    } catch (error) {
      setChecking(false);
    }
  };

  function getStatus(status: string) {
    if (!status && !checking) return 'default';
    if (checking) return 'processing';
    return status === 'connected' ? 'success' : 'error';
  }

  const fetchInfo = async () => {
    const windowId = search.get('windowId');
    const serverPort = search.get('serverPort') || 49156;
    if (!windowId) return;
    try {
      const res = await axios.get(`http://localhost:${serverPort}/window/info`, {
        params: {
          windowId: windowId,
        },
      });
      const {windowData, ipInfo} = res.data;
      setWindowInfo(windowData);
      setMoreInfo({
        ...ipInfo,
        userAgent: windowData.ua,
      });
      if (ipInfo?.ip) {
        checkPing();
      }
    } catch (error) {
      console.log(error);
    }
  };
  useEffect(() => {
    fetchInfo();
  }, [search]);

  useEffect(() => {
    // 当 IP 信息更新时，更新标题
    const windowId = search.get('windowId');
    if (windowId) {
      document.title = `(#${windowId}) ${windowInfo.name || '未命名'} ${moreInfo.ip ? `| IP:${moreInfo.ip}` : ''} ｜ Chrome Power`;
    }
  }, [moreInfo.ip, windowInfo.name]);

  return (
    <main className="h-full bg-gradient-to-r from-purple-200 via-blue-300 to-pink-200 border-purple-200 w-full px-4 sm:px-6 md:px-8 lg:px-16 xl:px-32 2xl:px-48 overflow-auto">
      <header className="h-auto py-4 md:h-24 flex flex-col rounded-md items-center justify-center shadow-md bg-indigo-400">
        <h1 className="text-xl sm:text-2xl font-semibold text-white mb-2">
          IP: {moreInfo.ip || 'Disconnected'}
        </h1>
        <div className="flex justify-center text-white">
          <p className="text-sm sm:text-base">
            {moreInfo.country} - {moreInfo.timeZone}
          </p>
        </div>
      </header>
      <main className="py-4 sm:py-6 md:py-8">
        <Card
          styles={{
            header: {
              textAlign: 'center',
            },
          }}
          title={
            <Space size={[8, 12]} wrap className="justify-center">
              {PIN_URL?.map((m, index: number) => (
                <Badge
                  key={index}
                  classNames={{
                    indicator: `w-[8px] h-[8px] ${checking ? 'animate-ping' : ''}`,
                  }}
                  status={getStatus(pings[index]?.status)}
                  text={m.n}
                />
              ))}
            </Space>
          }
          className="bg-white mx-auto w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl text-black rounded-lg shadow-lg p-2 sm:p-4 transition-all duration-500 ease-in-out hover:shadow-2xl min-h-[400px] md:min-h-[600px] lg:min-h-[700px] xl:min-h-[800px] overflow-auto"
        >
          <div className="p-2 sm:p-4">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-gray-800">窗口信息</h2>
              <div className="mt-2">
                <div className="flex flex-col sm:flex-row sm:justify-between py-1">
                  <span className="text-gray-400">ID</span>
                  <span className="text-gray-800 break-all sm:break-normal">{windowInfo.id}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between py-1">
                  <span className="text-gray-400">名称</span>
                  <span className="text-gray-800 break-all sm:break-normal">{windowInfo.name}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between py-1">
                  <span className="text-gray-400">分组</span>
                  <span className="text-gray-800 break-all sm:break-normal">{windowInfo.group_name}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between py-1">
                  <span className="text-gray-400">启动时间</span>
                  <span className="text-gray-800 break-all sm:break-normal">{windowInfo.opened_at}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between py-1">
                  <span className="text-gray-400">缓存目录</span>
                  <span className="text-gray-800 break-all sm:break-normal">{windowInfo.profile_id}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between py-1">
                  <span className="text-gray-400">备注</span>
                  <span className="text-gray-800 break-all sm:break-normal">{windowInfo.remark}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between py-1">
                  <span className="text-gray-400">标签</span>
                  <div className="text-gray-800 flex flex-wrap">
                    {windowInfo.tags_name?.map((name, index) => {
                      return (
                        <span
                          key={name + '-' + index}
                          className="mr-2 mb-1 inline-block bg-cyan-400 px-2 text-stone-100 rounded-md"
                        >
                          {name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 sm:mt-8 md:mt-12">
              <h2 className="text-base sm:text-lg font-semibold text-gray-800">更多信息</h2>
              <div className="mt-2">
                <div className="flex flex-col sm:flex-row sm:justify-between py-1">
                  <span className="text-gray-400">地理坐标</span>
                  <span className="text-gray-800 break-all sm:break-normal">
                    {moreInfo?.ll?.length ? `[${moreInfo.ll?.[0]}, ${moreInfo.ll?.[1]}]` : ''}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between py-1">
                  <span className="text-gray-400">时区</span>
                  <span className="text-gray-800 break-all sm:break-normal">{moreInfo.timeZone}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </main>
    </main>
  );
}
