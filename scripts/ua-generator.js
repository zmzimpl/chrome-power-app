// 导入需要的模块
const fs = require('fs');
const path = require('path');
const UserAgent = require('user-agents');

function appendUAToFile() {
  const ua = new UserAgent({
    deviceCategory: 'desktop',
    platform: 'Win32',
  });

  const {userAgent: uaString} = ua.random().data;

  const filePath = path.join('assets', 'ua.txt');

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      fs.writeFile(filePath, uaString + '\n', err => {
        if (err) throw err;
        console.log('User-Agent string has been written to ua.txt');
      });
    } else {
      if (data.split('\n').indexOf(uaString) === -1) {
        fs.appendFile(filePath, uaString + '\n', err => {
          if (err) throw err;
          console.log('User-Agent string has been appended to ua.txt');
          setTimeout(appendUAToFile, 1000);
        });
      } else {
        console.log('User-Agent string already exists in ua.txt');
        setTimeout(appendUAToFile, 1000);
      }
    }
  });
}
appendUAToFile();