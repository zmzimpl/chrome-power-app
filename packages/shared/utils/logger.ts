import {existsSync, mkdirSync} from 'fs';
import * as winston from 'winston';
import {join} from 'path';
import {app} from 'electron';

const colorizer = winston.format.colorize();

export function createLogger(label: string) {
  const isDevelopment = import.meta.env.MODE === 'development';

  if (!winston.loggers.has(label)) {
    let transport;
    if (isDevelopment) {
      // 开发环境: 所有日志都输出到控制台
      transport = new winston.transports.Console({level: 'info'});
    } else {
      const logsPath = join(app.getPath('appData'), 'logs');
      if (!existsSync(logsPath)) {
        mkdirSync(logsPath, { recursive: true });
      }
      if (!existsSync(join(logsPath, label))) {
        mkdirSync(join(logsPath, label));
      }
      const date = new Date();

      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day
        .toString()
        .padStart(2, '0')}`;
      // 定义日志文件的位置，每天记录一个日志文件
      const logFile = join(logsPath, label, `${formattedDate}.log`);
      // 生产环境: 所有日志都输出到文件
      transport = new winston.transports.File({level: 'info', filename: logFile});
    }

    winston.loggers.add(label, {
      transports: [transport],
      format: winston.format.combine(
        winston.format.label({label}),
        winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
        winston.format.printf(info => {
          const {timestamp, level, message, [Symbol.for('splat')]: splat} = info;
          const metaString = splat && splat.length ? splat.map(JSON.stringify).join(' ') : '';
          const formattedMessage = `${message} ${metaString}`.trim();
          return isDevelopment
            ? colorizer.colorize(level, `${label} | ${timestamp} - ${level}: ${formattedMessage}`)
            : `${label} | ${timestamp} - ${level}: ${formattedMessage}`;
        }),
      ),
    });
  }
  return winston.loggers.get(label);
}
