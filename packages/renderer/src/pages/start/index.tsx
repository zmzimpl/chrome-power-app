import axios from 'axios';
import {useEffect, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {Card, Space, Badge} from 'antd';

export default function Start() {
  const [search] = useSearchParams();

  const [windowInfo, setWindowInfo] = useState({
    name: '--',
    group_name: '--',
    opened_at: '--',
    profile_id: '--',
    remark: '--',
    tags_name: [],
  });
  const [moreInfo, setMoreInfo] = useState({
    ip: '--',
    country: '--',
    ll: [],
    userAgent: '--',
    language: '--',
    timeZone: '--',
  });
  const PIN_URL = [
    {
      name: 'Google',
      n: 'GG',
    },
    {
      name: 'Wikipedia',
      n: 'Wiki',
    },
    {
      name: 'Facebook',
      n: 'FB',
    },
    {
      name: 'Detectme',
      n: 'Dm',
    },
    {
      name: 'Whoer',
      n: 'Wh',
    },
  ];
  const [pings, setPings] = useState<{status: string}[]>([]);
  const [checking, setChecking] = useState(false);

  const checkPing = async () => {
    const windowId = search.get('windowId');
    const serverPort = search.get('serverPort') || 2018;
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
    const serverPort = search.get('serverPort') || 2018;
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
      if (ipInfo.ip) {
        checkPing();
      }
    } catch (error) {
      console.log(error);
    }
  };
  useEffect(() => {
    fetchInfo();
  }, [search]);
  return (
    <main className="h-full bg-gradient-to-r from-purple-200 via-blue-300 to-pink-200 border-purple-200 mx-[25%]">
      <header className="h-24 flex flex-col rounded-md items-center justify-center shadow-md bg-indigo-400 ">
        <h1 className="text-2xl font-semibold text-white mb-2">
          IP: {moreInfo.ip || 'Disconnected'}
        </h1>
        <div className="flex justify-center text-white">
          <p>
            {moreInfo.country} - {moreInfo.timeZone}
          </p>
        </div>
      </header>
      <main className="py-8">
        <Card
          styles={{
            header: {
              textAlign: 'center',
            },
          }}
          title={
            <Space size={12}>
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
            // <div>
            //   {PIN_URL.map((pingUrl, index) => {
            //     return (
            //       <span
            //         key={index}
            //         className="mr-4"
            //       >
            //         <span className="relative inline-block h-3 w-3 mr-3">
            //           {checking && (
            //             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            //           )}
            //           <span
            //             className={`absolute inline-flex rounded-full h-3 w-3 bg-${getStatus(
            //               pings[index]?.status,
            //             )}-500`}
            //           ></span>
            //         </span>
            //         <span className="text-gray-800">{pingUrl.n}</span>
            //       </span>
            //     );
            //   })}
            // </div>
          }
          className="bg-white mx-auto max-w-2xl text-black rounded-lg shadow-lg p-4 transition-all duration-500 ease-in-out hover:shadow-2xl h-[800px]"
        >
          <div className="p-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">窗口信息</h2>
              <div className="mt-2">
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">名称</span>
                  <span className="text-gray-800">{windowInfo.name}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">分组</span>
                  <span className="text-gray-800">{windowInfo.group_name}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">启动时间</span>
                  <span className="text-gray-800">{windowInfo.opened_at}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">缓存目录</span>
                  <span className="text-gray-800">{windowInfo.profile_id}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">备注</span>
                  <span className="text-gray-800">{windowInfo.remark}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">标签</span>
                  <span className="text-gray-800">
                    {windowInfo.tags_name?.map((name, index) => {
                      return (
                        <span
                          key={name + '-' + index}
                          className="mr-2 inline-block bg-cyan-400 px-2 text-stone-100 rounded-md"
                        >
                          {name}
                        </span>
                      );
                    })}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-12">
              <h2 className="text-lg font-semibold text-gray-800">更多信息</h2>
              <div className="mt-2">
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">User Agent</span>
                  <span className="text-gray-800 max-w-xs	text-right">{moreInfo.userAgent}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">地理坐标</span>
                  <span className="text-gray-800">
                    {moreInfo?.ll?.length ? `[${moreInfo.ll?.[0]}, ${moreInfo.ll?.[1]}]` : ''}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">时区</span>
                  <span className="text-gray-800">{moreInfo.timeZone}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </main>
    </main>
  );
}
