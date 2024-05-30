require('dotenv').config();

const express = require('express');
const app = express();
const port = process.env.PORT; // 포트번호 설정



app.use(express.json());

app.post('/data', async (req, res) => {
  try {
    console.log('알림수신')
    const fetch = await import('node-fetch').then(module => module.default);
    const tmp = req.body.text.split(/[\s\n]+/)

    // JSON 문자열에서 큰따옴표로 둘러싸인 문자열 추출
    const regex = /"([^"]*)"/g;
    const matches = req.body.text.match(regex);

    const author = tmp[0] // 작업자
    const type = tmp[1] // 행동 created, Added, added act-joinAssignee, modified, removed, moved
    let typeKor = '' 
    let what = '' // 작업 대상 card, member, swimlane, list 등
    let title =''
    let list = ''
    let swimlane = ''
    let board = ''
    let text = '' // 문구
    let path = '' // 경로

    if (type == 'created'){
        typeKor = '생성되었습니다'
        what = tmp[2]
        title = matches[0]
        if (what == 'board'){
            what = '보드'
            path = title
        }   
        if (what == 'swimlane'){
            board = matches[1]
            what = '스윔라인'
            path = board+" - "+title
        }
        if (what == 'card') {
            list = matches[1]
            swimlane = matches[2]
            board = matches[3]
            what = '카드'
            path = board+" / "+swimlane+" / "+list
        }
        text = title+what+"가 "+typeKor
    }
    else if (type == 'added' || type == 'Added'){
        typeKor = '추가되었습니다'
        let cardName = ''
        what = tmp[2]
        if (what == 'label'){
            what = '라벨이'
        }
        if (what == 'member'){
            what = '멤버가'
        }
        title = tmp[3]
        cardName = matches[0]
        list = matches[1]
        swimlane = matches[2]
        board = matches[3]

        text = title+' '+what+" "+cardName+"카드에 "+typeKor
        path = board+" / "+swimlane+" / "+list

        if (what == 'list'){
            what = '리스트'
            board = matches[1]
            text = title+' '+what+"가 "+board+"보드에 "+typeKor
            path = board
        }
    }
    else if (type == 'modified'){
        typeKor = '수정되었습니다'
        what = tmp[2]
        title = matches[0]
        if (what == 'received'){
            what = '수신시간'
        }   
        else if (what == 'start'){
            what = '시작시간'
        }
        else if (what == 'due') {
            what = '기한'
        }
        else if (what == 'end') {
            what = '종료시간'
        }
        text = what+"이 "+typeKor
    }
    else if (type == 'moved'){
        typeKor = ' 이동되었습니다'
        what = tmp[2]
        if (what == 'card'){
            what = ' 카드가'
        }
        cardName = matches[0]
        board = matches[1]
        list = matches[2]
        swimlane = matches[3]
        var Tolist = matches[4]
        var ToSwimlane = matches[5]
        text = cardName+what+typeKor
        path = board+" / "+ToSwimlane+" / "+Tolist
    }
    else if (type =='removed' || type == 'Removed'){
        typeKor = ' 삭제되었습니다'
        what = tmp[2]
        if (what == 'label'){
            what = '에서 라벨이'
        }
        if (what == 'member'){
            what = '에서 멤버가'
        }
        cardName = matches[0]
        list = matches[1]
        swimlane = matches[2]
        board = matches[3]
        text = cardName+what+typeKor
        path = board+" / "+swimlane+" / "+list
    }
    else if (type == 'Card'){
        typeKor = ' 카드가 삭제되었습니다'
        what = tmp[2]
        title = matches[0]
        list = matches[1]
        swimlane = matches[2]
        board = matches[3]
        text = title+typeKor
        path = board+" / "+swimlane+" / "+list
    }
    else if (type =='act-joinAssignee'){
        typeKor = '팀원을 Assignee했습니다'
        text = author+'님이 '+typeKor
    }
    else if (type == 'act-unjoinAssignee'){
        typeKor = 'Assigneed에서 팀원을 해제했습니다'
        text = author+'님이 '+typeKor
    }
    else if (type == 'act-changedSwimlaneTitle'){
        typeKor = '스윔라인명을 변경했습니다'
        text = author+'님이 '+typeKor
    }
    else if (type == 'act-changedListTitle'){
        typeKor = '리스트명을 변경했습니다'
        text = author+'님이 '+typeKor
    }
    else if (type == 'restored'){
        typeKor = ' 복구되었습니다'
        what = tmp[2]
        if (what == 'card'){
            what = ' 카드가'
        }
        title = matches[0]
        list = matches[1]
        swimlane = matches[2]
        board = matches[3]
        text = title+what+typeKor
        path = board+" / "+swimlane+" / "+list
    }

    let URL = tmp[tmp.length-1].replace('localhost', '12.4.110.104:33480')
    //console.log ("작성자: "+tmp[0])
    // req.body.text를 포함하는 새로운 JSON 객체 생성
    const payload = {
        attachments: [
          {
            fallback: "test",
            color: "#FF8000",
            text: "#### "+text,
            //title: what+' '+type,
            //title_link: URL,
            fields: [   
              {
                short: true,
                title: ":lower_left_fountain_pen: Author",
                value: author
              },
              {
                short: true,
                title: ":globe_with_meridians: 경로",
                value: path.replace(/"/g, "")
              },
              {
                short: false,
                title: ":file_folder: 링크",
                value: URL
              }
            ]
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

    res.json({ received: data });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error occurred while sending request');
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening at http://0.0.0.0:${port}`);
});