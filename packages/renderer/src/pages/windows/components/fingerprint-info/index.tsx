import './index.css';
import type {SafeAny} from '../../../../../../shared/types/db';
import {useEffect, useState} from 'react';

interface FingerprintProps {
  ua: string;
  timezone: string;
  location: string;
  language: string;
  screen: string;
  fonts: string;
  canvas: string;
  webRTC: string;
  webGLImage: string;
  audio: string;
}

const FingerprintInfo = ({fingerprints}: {fingerprints: SafeAny}) => {
  const [fingerprintDisplay, setFingerprintDisplay] = useState({
    ua: '',
    timezone: 'Based on IP address',
    location: 'Based on IP address',
    language: 'Based on IP address',
    screen: 'Default',
    fonts: 'Default',
    canvas: 'Noise',
    webRTC: 'Disabled',
    webGLImage: 'Noise',
    audio: 'Noise',
  });
  const fingerprinstLog: {title: string; field: keyof FingerprintProps}[] = [
    {
      title: 'User-Argent',
      field: 'ua',
    },
    {
      title: 'Timezone',
      field: 'timezone',
    },
    {
      title: 'WebRTC',
      field: 'webRTC',
    },
    {
      title: 'Location',
      field: 'location',
    },
    {
      title: 'Language',
      field: 'language',
    },
    {
      title: 'Screen Resolution',
      field: 'screen',
    },
    {
      title: 'Fonts',
      field: 'fonts',
    },
    {
      title: 'Canvas',
      field: 'canvas',
    },
    {
      title: 'WebGL Image',
      field: 'webGLImage',
    },
    {
      title: 'Audio Context',
      field: 'audio',
    },
  ];
  useEffect(() => {
    if (fingerprints) {
      setFingerprintDisplay({
        ...fingerprintDisplay,
        ua: fingerprints?.ua || window.navigator.userAgent,
      });
    }
  }, [fingerprints]);
  return (
    <div className="fingerprint-wrapper">
      {fingerprinstLog.map((item, index) => {
        return (
          <div
            className={`flex ${index > 0 && 'mt-2'}`}
            key={item.field}
          >
            <div className="fingerprint-title text-gray-500">{item.title}</div>
            <div className="fingerprint-value">
              {typeof fingerprintDisplay[item.field] !== 'object'
                ? fingerprintDisplay[item.field]
                : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FingerprintInfo;
