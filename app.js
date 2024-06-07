require('dotenv').config();

const express = require('express');
const os = require('os');
const app = express();
const port = process.env.PORT; // 포트번호 설정
var hook_url = process.env.URL;

const { exec } = require('child_process');
const readline = require('readline');

// 정적 파일 제공을 위한 미들웨어 설정
app.use(express.static('public'));

// 기본 라우트 설정
app.get('/', (req, res) => {
  // index.html 파일을 제공
  res.sendFile(__dirname + '/public/index.html');
});

// 메세지 전송
//var Mattermost = require('node-mattermost');
//var mattermost = new Mattermost(hook_url);

// 중복메세지 방지용 변수
const userRequests = {}; // 사용자 요청을 추적하기 위한 객체
const REQUEST_LIMIT = 5; // 허용된 최대 요청 수
const TIME_WINDOW = 60 * 1000; // 시간 창 (1분)

// 사용자 정보를 저장하는 배열
const users = [];

// 앱 정보
const appInfo = {
  name: 'express-app',
  version: '4',
  author: '박성중'
};

// 중복메세지 사용자 리스트 관리
setInterval(() => {
  // 현재 시간
  const currentTime = Date.now();

  // 사용자 요청 객체 순회
  for (const user in userRequests) {
    for (const description in userRequests[user]) {
      // 마지막 요청 시간과 현재 시간의 차이가 1분 이상인 경우 초기화
      if (currentTime - userRequests[user][description].startTime >= TIME_WINDOW) {
        userRequests[user][description] = { count: 0, startTime: currentTime };
      }
    }
  }
}, TIME_WINDOW);

app.use(express.json());

app.post('/data', async (req, res) => {
  try {
    console.log('알림수신')
    const user = req.body.user;
    const description = req.body.description;

    const fetch = await import('node-fetch').then(module => module.default);

    // 사용자 및 행동 요청 수 초기화 또는 갱신
    if (!userRequests[user]) {
      userRequests[user] = {};
    }

    if (!userRequests[user][description]) {
      userRequests[user][description] = { count: 1, startTime: Date.now() };
    } else {
      userRequests[user][description].count += 1;
    }

    // 요청 제한 초과 시 차단 메시지 전송
    if (userRequests[user][description].count > REQUEST_LIMIT) {
      const currentTime = Date.now();
      if (currentTime - userRequests[user][description].startTime < TIME_WINDOW) {
        const payload = {
          attachments: [
            {
              fallback: "Too many requests",
              color: "#FF0000",
              text: "#### :x:" + user + "님이 짧은 시간에 같은 행동을 반복하셨습니다. 1분 후에 다시 시도해주세요:x:"
            }
          ]
        };

        const response = await fetch(process.env.URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const contentType = response.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        return res.json({ received: data });
      } else {
        // 시간 창이 경과한 경우 카운터 초기화
        userRequests[user][description] = { count: 1, startTime: currentTime };
      }
    }


    console.log(req.body);
    const tmp = req.body.text.split(/[\s\n]+/)

    // JSON 문자열에서 큰따옴표로 둘러싸인 문자열 추출
    const regex = /"([^"]*)"/g;
    const matches = req.body.text.match(regex);

    const author = req.body.user // 작업자
    const type = tmp[1] // 행동 created, Added, added act-joinAssignee, modified, removed, moved
    let typeKor = ''
    let what = '' // 작업 대상 card, member, swimlane, list 등
    let title = ''
    let list = ''
    let swimlane = ''
    let board = ''
    let text = '' // 문구
    let path = '' // 경로
    let cardName = ''


    // payload 작성 조건문
    switch (type) {
      case 'created':
        typeKor = '생성되었습니다';
        what = tmp[2];
        title = matches[0];
        if (what === 'board') {
          what = '보드';
          path = title;
        } else if (what === 'swimlane') {
          board = matches[1];
          what = '스윔라인';
          path = `${board} - ${title}`;
        } else if (what === 'card') {
          list = matches[1];
          swimlane = matches[2];
          board = matches[3];
          what = '카드';
          path = `${board} / ${swimlane} / ${list}`;
        }
        text = `${title}${what}가 ${typeKor}`;
        break;

      case 'added':
      case 'Added':
        typeKor = '추가되었습니다';
        what = tmp[2];
        title = tmp[3];
        cardName = matches[0];
        list = matches[1];
        swimlane = matches[2];
        board = matches[3];
        if (what === 'label') {
          what = '라벨이';
          text = `${what} ${cardName}카드에 ${typeKor}`;
        } else if (what === 'member') {
          what = '멤버가';
          text = `${title} ${what} ${cardName}카드에 ${typeKor}`;
        }
        path = `${board} / ${swimlane} / ${list}`;
        if (what === 'list') {
          what = '리스트';
          board = matches[1];
          text = `${title} ${what}가 ${board}보드에 ${typeKor}`;
          path = board;
        }
        break;

      case 'modified':
        typeKor = '수정되었습니다';
        what = tmp[2];
        title = matches[0];
        if (['received', 'start', 'due', 'end'].includes(what)) {
          what = { received: '수신시간', start: '시작시간', due: '기한', end: '종료시간' }[what];
        }
        text = `${what}이 ${typeKor}`;
        break;

      case 'moved':
        typeKor = ' 이동되었습니다';
        what = tmp[2];
        if (what === 'card') {
          what = ' 카드가';
        }
        cardName = matches[0];
        board = matches[1];
        list = matches[2];
        swimlane = matches[3];
        const Tolist = matches[4];
        const ToSwimlane = matches[5];
        text = `${cardName}${what}${typeKor}`;
        path = `${board} / ${ToSwimlane} / ${Tolist}`;
        break;

      case 'removed':
      case 'Removed':
        typeKor = ' 삭제되었습니다';
        what = tmp[2];
        if (what === 'label') {
          what = '에서 라벨이';
        } else if (what === 'member') {
          what = '에서 멤버가';
        }
        cardName = matches[0];
        list = matches[1];
        swimlane = matches[2];
        board = matches[3];
        text = `${cardName}${what}${typeKor}`;
        path = `${board} / ${swimlane} / ${list}`;
        break;

      case 'Card':
        typeKor = ' 카드가 삭제되었습니다';
        title = matches[0];
        list = matches[1];
        swimlane = matches[2];
        board = matches[3];
        text = `${title}${typeKor}`;
        path = `${board} / ${swimlane} / ${list}`;
        break;

      case 'act-joinAssignee':
        typeKor = '팀원을 Assignee했습니다';
        text = `${author}님이 ${typeKor}`;
        break;

      case 'act-unjoinAssignee':
        typeKor = 'Assigneed에서 팀원을 해제했습니다';
        text = `${author}님이 ${typeKor}`;
        break;

      case 'act-changedSwimlaneTitle':
        typeKor = '스윔라인명을 변경했습니다';
        text = `${author}님이 ${typeKor}`;
        break;

      case 'act-changedListTitle':
        typeKor = '리스트명을 변경했습니다';
        text = `${author}님이 ${typeKor}`;
        break;

      case 'restored':
        typeKor = ' 복구되었습니다';
        what = tmp[2];
        if (what === 'card') {
          what = ' 카드가';
        }
        title = matches[0];
        list = matches[1];
        swimlane = matches[2];
        board = matches[3];
        text = `${title}${what}${typeKor}`;
        path = `${board} / ${swimlane} / ${list}`;
        break;
    }

    let URL = tmp[tmp.length - 1].replace('localhost', '12.4.110.104:33480')
    //console.log ("작성자: "+tmp[0])
    // req.body.text를 포함하는 새로운 JSON 객체 생성

    const payload = {
      attachments: [
        {
          fallback: "test",
          color: "#FF8000",
          text: `#### ${text}`,
          fields: [
            {
              short: true,
              title: ":lower_left_fountain_pen: Author",
              value: author
            },
            {
              short: true,
              title: ":file_folder: 경로",
              value: path.replace(/"/g, "")
            },
            {
              short: false,
              title: ":globe_with_meridians: 링크",
              value: URL
            }
          ]
        }
      ]
    };
    const userObj = users.find(user => user.user === author);
    const isMuted = userObj ? userObj.value === 'true' : false;

    if (!isMuted) {
      //board가 '자료실'인 경우 카드가 생성될때에만 출력
      if (board === '"자료실"') {
        if (type === 'created' && tmp[2] === 'card') {
          const response = await fetch(process.env.URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const contentType = response.headers.get('content-type');
          const data = contentType && contentType.includes('application/json')
            ? await response.json()
            : await response.text();

          res.json({ received: data });
        } else {
          res.status(200).send('해당 메세지는 출력대상이 아닙니다.');
        }
      } else {
        // board가 '자료실'이 아닌 경우 요청을 보냄
        const response = await fetch(process.env.URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const contentType = response.headers.get('content-type');
        const data = contentType && contentType.includes('application/json')
          ? await response.json()
          : await response.text();

        res.json({ received: data });
      }
    }
    else {
      res.status(200).send('알림차단설정에 의해 차단되었습니다.');
    }

  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error occurred while sending request');
  }
});

// 클라이언트에게 사용자 정보를 전달하는 엔드포인트
app.get('/users', (req, res) => {
  // 현재 저장된 사용자 정보를 클라이언트에게 전송
  res.json({ users: users });
});

app.post('/set', async (req, res) => {
  // 요청에서 받은 데이터
  const { user, role, value } = req.body;

  // 사용자 정보를 담은 객체 생성
  const userInfo = {
    user: user,
    role: role,
    value: value
  };

  // 사용자가 이미 존재하는지 확인
  const existingUserIndex = users.findIndex(existingUser => existingUser.user === user);

  // 사용자가 이미 존재하는 경우 해당 사용자 정보를 갱신
  if (existingUserIndex !== -1) {
    users[existingUserIndex] = userInfo;
  } else {
    // 사용자가 존재하지 않는 경우 배열에 추가
    users.push(userInfo);
  }

  // 응답 보내기
  res.json({ success: true, message: 'Data received and saved successfully!', users: users });

})

// 서버의 IP 주소 가져오기
function getServerIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

app.listen(port, '0.0.0.0', () => {
  const ip = getServerIp();
  console.log(`Server listening at http://${ip}:${port}`);
  console.log(`
  
  ███████╗██╗  ██╗██████╗ ██████╗ ███████╗███████╗███████╗       █████╗ ██████╗ ██████╗ 
  ██╔════╝╚██╗██╔╝██╔══██╗██╔══██╗██╔════╝██╔════╝██╔════╝      ██╔══██╗██╔══██╗██╔══██╗
  █████╗   ╚███╔╝ ██████╔╝██████╔╝█████╗  ███████╗███████╗█████╗███████║██████╔╝██████╔╝
  ██╔══╝   ██╔██╗ ██╔═══╝ ██╔══██╗██╔══╝  ╚════██║╚════██║╚════╝██╔══██║██╔═══╝ ██╔═══╝ 
  ███████╗██╔╝ ██╗██║     ██║  ██║███████╗███████║███████║      ██║  ██║██║     ██║     
  ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝      ╚═╝  ╚═╝╚═╝     ╚═╝    
  v${appInfo.version} Author: ${appInfo.author} `)
  showMenu();
});

function showMenu() {
  console.log(`
  
  1. 서버 상태 확인
  2. 메시지 차단 설정
  3. 종료
  `);
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('옵션을 선택하세요: ', (answer) => {
    if (answer === '1') {
      checkServerStatus();
    } else if (answer === '2') {
      setMessageBlocking();
    } else if (answer === '3') {
      console.log('종료합니다.');
      rl.close();
      process.exit(0);
    } else {
      console.log('잘못된 입력입니다. 다시 시도하세요.');
      rl.close();
      showMenu();
    }
  });
}

function checkServerStatus() {
  console.log('서버가 실행 중입니다.');
  showMenu();
}

function setMessageBlocking(rl) {
  // value가 true인 사용자 목록 출력
  const mutedUsers = users.filter(user => user.value === 'true');
  
  if (mutedUsers.length > 0) {
    console.log('현재 메시지 차단된 사용자 목록:');
    mutedUsers.forEach(user => {
      console.log(`- ${user.user}`);
    });
  } else {
    console.log('현재 메시지 차단된 사용자가 없습니다.');
  }

  const rl2 = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl2.question('메시지 차단을 설정 또는 해제할 사용자 이름을 입력하세요: ', (username) => {
    const existingUserIndex = users.findIndex(user => user.user === username);

    if (existingUserIndex !== -1) {
      // 이미 사용자가 존재하는 경우 차단을 해제합니다.
      if (users[existingUserIndex].value === 'true') {
        users[existingUserIndex].value = 'false';
        console.log(`사용자 ${username}의 메시지 차단이 해제되었습니다.`);
      } else {
        console.log(`사용자 ${username}은(는) 이미 차단되지 않았습니다.`);
      }
    } else {
      // 새로운 사용자인 경우 차단을 설정합니다.
      const userInfo = {
        user: username,
        role: 'mute',
        value: 'true'
      };
      users.push(userInfo);
      console.log(`사용자 ${username}의 메시지 차단이 설정되었습니다.`);
    }

    rl2.close();
    showMenu();
  });
}